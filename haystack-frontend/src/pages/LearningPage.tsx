import React, { useState, useEffect } from 'react';
import { BookOpen, Star, Clock, Award, ExternalLink, Search, PlayCircle } from 'lucide-react';
import YouTube from 'react-youtube';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Course {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    url: string;
    instructor: string;
    platform: string;
    level: string;
    duration: string;
    rating: number | null;
    price: string;
    source: string;
}

interface ProgressItem {
    id: number;
    course_id: string;
    course_data: Course;
    progress_seconds: number;
    is_completed: boolean;
}

export const LearningPage: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [levelFilter, setLevelFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('Software Engineering'); // Default topic

    // Video Tracking State
    const [activeVideo, setActiveVideo] = useState<{ id: string; startTime: number } | null>(null);
    const [progressList, setProgressList] = useState<ProgressItem[]>([]);

    const fetchProgress = async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`/api/learning/progress?user_id=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setProgressList(data);
            }
        } catch (err) {
            console.error("Failed to fetch learning progress", err);
        }
    };

    useEffect(() => {
        const fetchContextAndCourses = async () => {
            fetchProgress();
            try {
                const token = localStorage.getItem('auth_token');
                if (token) {
                    const profileRes = await fetch('/api/profile/me', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (profileRes.ok) {
                        const profile = await profileRes.json();
                        const skillsStr = Array.isArray(profile.skills) ? profile.skills.join(',') : '';
                        const titleStr = profile.headline || profile.title || 'Software Engineering';

                        setSearchQuery(titleStr);
                        await fetchCourses(titleStr, skillsStr);
                        return;
                    }
                }
            } catch (err) {
                console.error("Failed to fetch profile context for learning", err);
            }
            await fetchCourses(searchQuery);
        };
        fetchContextAndCourses();
    }, [user, categoryFilter]); // Add categoryFilter to trigger refetch on change

    const fetchCourses = async (query: string = '', skillsParam: string = '') => {
        setLoading(true);
        try {
            // Build query string
            const params = new URLSearchParams();
            if (query) params.append('topic', query);
            if (skillsParam) params.append('skills', skillsParam);
            if (categoryFilter !== 'all') params.append('platform', categoryFilter);

            const response = await fetch(`/api/learning/courses?${params.toString()}`);
            const data = await response.json();

            // Handle array response from backend
            if (Array.isArray(data)) {
                setCourses(data);
            } else {
                setCourses(data.courses || []);
            }
        } catch (error) {
            console.error('Error fetching courses:', error);
            // keep mock data just in case
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchCourses(searchQuery);
    };

    const handleVideoProgress = async (courseId: string, currentTime: number, duration: number) => {
        if (!user?.id || currentTime < 5) return; // Only track after 5 seconds

        try {
            await fetch('/api/learning/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    course_id: courseId,
                    course_data: courses.find(c => c.id === courseId) || progressList.find(p => p.course_id === courseId)?.course_data || {},
                    progress_seconds: Math.floor(currentTime),
                    is_completed: (currentTime / duration) > 0.90 // 90% is marked complete
                })
            });
            fetchProgress(); // Silently reload queue
            if ((currentTime / duration) > 0.90) {
                showToast('Course completed! 🎉', 'success');
            } else if (currentTime > 5) {
                showToast('Progress saved', 'info');
            }
        } catch (e) {
            console.error("Failed to save progress", e);
        }
    };

    const activeProgressQueue = progressList.filter(p => !p.is_completed);
    const completedCourses = progressList.filter(p => p.is_completed);

    // Filter out completed courses from the main recommendations
    const completedCourseIds = new Set(completedCourses.map(p => p.course_id));
    const recommendedCourses = courses.filter(c => !completedCourseIds.has(c.id));

    return (
        <div className="max-w-7xl mx-auto w-full space-y-6 animate-fadeIn">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Learning Hub</h1>
                <p className="text-gray-600 dark:text-gray-400">Discover free courses and tutorials to advance your career</p>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search for a skill (e.g., Python, React, Data Science)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300 min-w-[150px]"
                    >
                        <option value="all">All Formats</option>
                        <option value="YouTube">Video Only</option>
                        <option value="Coursera">Coursera</option>
                        <option value="edX">edX</option>
                    </select>
                    <button
                        type="submit"
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        Search
                    </button>
                </div>
            </form>

            {/* Resume Watching Queue */}
            {activeProgressQueue.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Resume Watching</h2>
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                        {activeProgressQueue.map((progress) => (
                            <button
                                key={progress.course_id}
                                onClick={() => setActiveVideo({ id: progress.course_id, startTime: progress.progress_seconds })}
                                className="flex-none w-72 bg-white dark:bg-dark-card rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-dark-border text-left hover:shadow-md transition-all group"
                            >
                                <div className="relative h-40 bg-gray-200 dark:bg-gray-800">
                                    <img src={progress.course_data?.thumbnail} alt="" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                            <PlayCircle className="text-white fill-white" size={24} />
                                        </div>
                                    </div>
                                    {/* Progress Bar (assuming 1 hour average if duration missing) */}
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600">
                                        <div
                                            className="h-full bg-blue-500"
                                            style={{ width: `${Math.min((progress.progress_seconds / 3600) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="p-3">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 mb-1">{progress.course_data?.title || 'Unknown Course'}</h3>
                                    <p className="text-xs text-gray-500">{Math.floor(progress.progress_seconds / 60)} min watched</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Course Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-3 text-center py-12 text-gray-500">Loading courses...</div>
                ) : recommendedCourses.length === 0 ? (
                    <div className="col-span-3 text-center py-12 text-gray-500">No new recommended courses found. Check your search criteria or completed catalog.</div>
                ) : (
                    recommendedCourses.map(course => (
                        <div key={course.id} className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4 flex flex-col hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 pr-2">
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-0.5 line-clamp-2 leading-tight">{course.title}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{course.platform}</p>
                                </div>
                                {course.rating && (
                                    <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded shrink-0">
                                        <Star size={12} className="text-yellow-600 dark:text-yellow-500 fill-current" />
                                        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">{course.rating}</span>
                                    </div>
                                )}
                            </div>

                            <div className="relative w-full h-32 mb-3 rounded-md overflow-hidden bg-gray-100 shrink-0">
                                {course.thumbnail ? (
                                    <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                                )}
                            </div>

                            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3 line-clamp-2 flex-grow">{course.description}</p>

                            <div className="flex flex-wrap gap-1.5 mb-3">
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[10px] font-medium tracking-wide uppercase">
                                    {course.platform}
                                </span>
                                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-[10px] font-medium tracking-wide uppercase">
                                    {course.level}
                                </span>
                            </div>

                            <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-4">
                                <div className="flex items-center gap-1.5">
                                    <Clock size={14} />
                                    <span>{course.duration || 'Self-paced'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Award size={14} />
                                    <span className="truncate max-w-[80px]" title={course.instructor}>{course.instructor}</span>
                                </div>
                            </div>

                            <div className="mt-auto">
                                {course.platform === 'YouTube' ? (
                                    <button
                                        onClick={() => setActiveVideo({ id: course.id, startTime: 0 })}
                                        className="flex items-center justify-center gap-2 w-full px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                                    >
                                        <PlayCircle size={16} /> Play Video
                                    </button>
                                ) : (
                                    <a
                                        href={course.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => handleVideoProgress(course.id, 9999, 10000)} // Mark external as complete on click
                                        className="flex items-center justify-center gap-2 w-full px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                                    >
                                        Open {course.platform} <ExternalLink size={14} />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Watched Videos Catalog */}
            {completedCourses.length > 0 && (
                <div className="mt-12">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Watched Catalog</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-75 hover:opacity-100 transition-opacity">
                        {completedCourses.map((progress) => (
                            <div key={progress.course_id} className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-green-200 dark:border-green-900/50 p-6 flex flex-col">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">{progress.course_data?.title || 'Unknown Course'}</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{progress.course_data?.platform || 'Unknown'}</p>
                                    </div>
                                    <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded text-green-700 dark:text-green-400 text-xs font-semibold">
                                        COMPLETED
                                    </div>
                                </div>
                                <div className="relative w-full h-40 mb-4 rounded-lg overflow-hidden bg-gray-100 grayscale hover:grayscale-0 transition-all">
                                    {progress.course_data?.thumbnail ? (
                                        <img src={progress.course_data.thumbnail} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                                    )}
                                </div>
                                {progress.course_data?.platform === 'YouTube' ? (
                                    <button
                                        onClick={() => setActiveVideo({ id: progress.course_id, startTime: 0 })}
                                        className="mt-auto flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <PlayCircle size={18} /> Watch Again
                                    </button>
                                ) : (
                                    <a
                                        href={progress.course_data?.url || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-auto flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Open Course <ExternalLink size={16} />
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Video Modal */}
            {activeVideo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="relative w-full max-w-5xl bg-black rounded-xl overflow-hidden shadow-2xl">
                        <button
                            onClick={() => {
                                setActiveVideo(null);
                                fetchProgress(); // Reload queue immediately when closing
                            }}
                            className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/30 text-white rounded-full transition-colors"
                        >
                            <span className="sr-only">Close</span>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="relative pt-[56.25%] w-full">
                            <YouTube
                                videoId={activeVideo.id}
                                opts={{
                                    width: '100%',
                                    height: '100%',
                                    playerVars: {
                                        autoplay: 1,
                                        start: activeVideo.startTime
                                    }
                                }}
                                className="absolute top-0 left-0 w-full h-full"
                                onStateChange={(e) => {
                                    // Track progress on pause (2), buffering (3), or ends (0)
                                    if ([0, 2, 3].includes(e.data)) {
                                        handleVideoProgress(activeVideo.id, e.target.getCurrentTime(), e.target.getDuration());
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
