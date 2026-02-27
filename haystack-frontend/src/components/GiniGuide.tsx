import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Briefcase, PlayCircle, ExternalLink, Activity } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Job {
    id: string;
    title: string;
    company: string;
    location: string;
    url?: string;
    isRemote?: boolean;
}

interface Course {
    id: string;
    title: string;
    platform: string;
    url: string;
}

interface GuideData {
    summary: string;
    top_skills: string[];
    missing_skills: string[];
    target_role: string;
}

export const GiniGuide: React.FC = () => {
    const { user } = useAuth();
    const [guide, setGuide] = useState<GuideData | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGiniData = async () => {
            if (!user?.id) return;
            setLoading(true);
            try {
                // 1. Fetch AI Summary & Skill Analysis
                const token = localStorage.getItem('auth_token');
                if (!token) return;

                const guideRes = await fetch(`/api/resume/gini-guide/${user.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (guideRes.ok) {
                    const data = await guideRes.json();
                    if (data.status === 'success' && data.guide) {
                        setGuide(data.guide);

                        // 2. Fetch Job Recommendations based on Top Skills & Title & Location
                        const jobQuery = data.guide.target_role || data.guide.top_skills[0] || 'Software';
                        const jobSkills = user.skills ? user.skills.join(',') : data.guide.top_skills.join(',');
                        const location = user.location || '';

                        fetch(`/api/jobs/recommendations?title=${encodeURIComponent(jobQuery)}&skills=${encodeURIComponent(jobSkills)}&location=${encodeURIComponent(location)}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        })
                            .then(res => res.json())
                            .then(jobData => {
                                const jobList = Array.isArray(jobData) ? jobData : (jobData.jobs || []);
                                setJobs(jobList.slice(0, 3));
                            })
                            .catch(err => console.error("Job fetch error:", err));

                        // 3. Fetch Learning Recommendations based on All Missing Skills
                        const missingSkillsString = data.guide.missing_skills.join(',');

                        if (missingSkillsString) {
                            fetch(`/api/learning/recommendations?skills=${encodeURIComponent(missingSkillsString)}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            })
                                .then(res => res.json())
                                .then(courseData => {
                                    const courseList = Array.isArray(courseData) ? courseData : (courseData.courses || []);
                                    setCourses(courseList.slice(0, 3));
                                })
                                .catch(err => console.error("Course fetch error:", err));
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to load GINI Guide", err);
            } finally {
                setLoading(false);
            }
        };

        fetchGiniData();
    }, [user]);

    if (!user) return null;

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 rounded-2xl shadow-lg border border-purple-500/30 p-6 h-full min-h-[400px] flex flex-col items-center justify-center text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
                <div className="relative z-10 flex flex-col items-center">
                    <Activity className="animate-spin text-purple-400 mb-4" size={40} />
                    <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-fuchsia-200 mb-2">
                        GINI is analyzing your profile...
                    </h3>
                    <p className="text-sm text-purple-200/70 text-center max-w-sm">
                        Reviewing your skills, identifying targeted opportunities, and mapping your personalized career trajectory.
                    </p>
                </div>
            </div>
        );
    }

    if (!guide) {
        return (
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-200 dark:border-dark-border p-6 h-full flex flex-col items-center justify-center text-center">
                <Sparkles className="text-blue-500 mb-3" size={32} />
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Welcome to GINI Guide</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Complete your profile or upload a resume to unlock your hyper-personalized career analysis.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden h-full flex flex-col">
            {/* Header Area */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                        <Sparkles className="text-yellow-300" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Your GINI Guide</h2>
                        <p className="text-sm text-indigo-100 font-medium">Hyper-personalized AI career analysis</p>
                    </div>
                </div>
            </div>

            <div className="p-5 flex-1 flex flex-col gap-5 overflow-y-auto custom-scrollbar">

                {/* AI Summary */}
                <div className="prose prose-sm max-w-none dark:prose-invert text-gray-700 dark:text-gray-300 leading-relaxed bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                    <ReactMarkdown>{guide.summary}</ReactMarkdown>
                </div>

                {/* Skill Chips */}
                {guide.missing_skills.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 tracking-wider uppercase">Focus Areas for {guide.target_role}</h4>
                        <div className="flex flex-wrap gap-2">
                            {guide.missing_skills.map((skill, i) => (
                                <span key={i} className="px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-xs font-semibold border border-red-200 dark:border-red-800/50 flex items-center gap-1">
                                    <Activity size={12} /> {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {/* Recommended Jobs */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">
                            <Briefcase size={16} className="text-green-500" />
                            <h4 className="font-semibold text-sm">Targeted Roles</h4>
                        </div>
                        <div className="space-y-2">
                            {jobs.length > 0 ? jobs.map(job => (
                                <a key={job.id} href={job.url || '/jobs'} target={job.url ? "_blank" : "_self"} rel="noopener noreferrer"
                                    className="block p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700 group">
                                    <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{job.title}</h5>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 flex-1">{job.company}</p>
                                        <ExternalLink size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                                    </div>
                                </a>
                            )) : (
                                <p className="text-xs text-gray-500 p-2 text-center bg-gray-50 dark:bg-gray-800/30 rounded-lg">No exact matches found yet.</p>
                            )}
                        </div>
                    </div>

                    {/* Recommended Learning */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">
                            <PlayCircle size={16} className="text-red-500" />
                            <h4 className="font-semibold text-sm">Skill Updates</h4>
                        </div>
                        <div className="space-y-2">
                            {courses.length > 0 ? courses.map(course => (
                                <a key={course.id} href={course.url} target="_blank" rel="noopener noreferrer"
                                    className="block p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700 group">
                                    <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors">{course.title}</h5>
                                    <div className="flex justify-between items-center mt-1.5">
                                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{course.platform}</p>
                                        <PlayCircle size={12} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                                    </div>
                                </a>
                            )) : (
                                <p className="text-xs text-gray-500 p-2 text-center bg-gray-50 dark:bg-gray-800/30 rounded-lg">All caught up on priority skills!</p>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
