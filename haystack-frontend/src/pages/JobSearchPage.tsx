import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useJobMatch } from '../hooks/useEnhancements';
import JobMatchBadge from '../components/JobMatchBadge';
import { Search, MapPin, DollarSign, Briefcase, ExternalLink, Activity } from 'lucide-react';

export const JobSearchPage: React.FC = () => {
    const { user } = useAuth();
    const [selectedJob, setSelectedJob] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const userProfile = {
        skills: user?.skills || [],
        location: user?.location || '',
        experience: [],
        education: []
    };

    const fetchJobs = async (queryParam = '') => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const skillsStr = userProfile.skills.join(',');
            const locStr = userProfile.location;

            // If no search query, use recommendations endpoint for personalized feed
            const endpoint = queryParam
                ? `/api/jobs?query=${encodeURIComponent(queryParam)}&skills=${encodeURIComponent(skillsStr)}&location=${encodeURIComponent(locStr)}`
                : `/api/jobs/recommendations?skills=${encodeURIComponent(skillsStr)}&location=${encodeURIComponent(locStr)}`;

            const res = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setJobs(Array.isArray(data) ? data : data.jobs || []);
            }
        } catch (error) {
            console.error('Failed to fetch jobs', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchJobs();
        }
    }, [user]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchJobs(searchQuery);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 transition-colors">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Job Search</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Discover global opportunities matching your skills and profile.
                    </p>
                </div>

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 sm:p-6 mb-8 transition-colors">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by role, keyword, or company..."
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button type="submit" disabled={loading} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:-translate-y-0 flex items-center justify-center">
                            {loading ? <Activity className="w-5 h-5 animate-spin" /> : 'Search Jobs'}
                        </button>
                    </div>
                </form>

                {/* Job Listings Area */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left: Job List */}
                    <div className="lg:col-span-5 xl:col-span-4 space-y-4 max-h-[800px] overflow-y-auto custom-scrollbar pr-2">
                        {loading && jobs.length === 0 ? (
                            <div className="space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-6 animate-pulse border border-gray-100 dark:border-slate-700/50">
                                        <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded w-3/4 mb-4"></div>
                                        <div className="h-4 bg-gray-100 dark:bg-slate-700/50 rounded w-1/2 mb-2"></div>
                                        <div className="h-4 bg-gray-100 dark:bg-slate-700/50 rounded w-1/3"></div>
                                    </div>
                                ))}
                            </div>
                        ) : jobs.length > 0 ? (
                            jobs.map((job) => (
                                <JobCard
                                    key={job.id}
                                    job={job}
                                    userProfile={userProfile}
                                    onSelect={() => setSelectedJob(job)}
                                    isSelected={selectedJob?.id === job.id}
                                />
                            ))
                        ) : (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-10 text-center border border-gray-200 dark:border-slate-700">
                                <Briefcase className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">No jobs found</h3>
                                <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Try adjusting your search terms or expanding your query.</p>
                            </div>
                        )}
                    </div>

                    {/* Right: Job Details */}
                    <div className="lg:col-span-7 xl:col-span-8">
                        {selectedJob ? (
                            <JobDetails job={selectedJob} userProfile={userProfile} />
                        ) : (
                            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center text-center h-[600px] sticky top-8">
                                <div className="w-20 h-20 bg-gray-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6">
                                    <Search className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Select a job</h3>
                                <p className="text-gray-500 dark:text-gray-400">Click on a job card from the list to view its full details, match breakdown, and application link.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Job Card Component
const JobCard: React.FC<any> = ({ job, userProfile, onSelect, isSelected }) => {
    // Determine skills arrays
    const requiredSkills = job.tags || job.required_skills || [];

    // We only simulate match fetch if we have enough profile data ideally, but the hook handles it
    const { data: matchData } = useJobMatch(userProfile, { ...job, description: job.description || job.title });

    return (
        <div
            onClick={onSelect}
            className={`bg-white dark:bg-slate-800 rounded-2xl p-6 cursor-pointer transition-all border ${isSelected
                    ? 'border-purple-500 shadow-md ring-1 ring-purple-500'
                    : 'border-gray-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-500/50 hover:shadow-sm'
                }`}
        >
            <div className="flex justify-between items-start mb-3 gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{job.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">{job.company}</p>
                </div>
                {matchData && (
                    <div className="shrink-0 mt-1">
                        <JobMatchBadge score={matchData.overall_score} compact={true} />
                    </div>
                )}
            </div>

            <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400 mb-4">
                <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{job.location || 'Remote'} {job.isRemote ? '(Remote)' : ''}</span>
                </div>
                {job.salary_min && (
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5 shrink-0" />
                        <span>${job.salary_min.toLocaleString()} - ${job.salary_max?.toLocaleString()}</span>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-1.5">
                {requiredSkills.slice(0, 3).map((skill: string) => (
                    <span
                        key={skill}
                        className="px-2 py-0.5 bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-gray-300 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-gray-200 dark:border-slate-700"
                    >
                        {skill}
                    </span>
                ))}
                {requiredSkills.length > 3 && (
                    <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-bold rounded-md">
                        +{requiredSkills.length - 3}
                    </span>
                )}
            </div>
        </div>
    );
};

// Job Details Component
const JobDetails: React.FC<any> = ({ job, userProfile }) => {
    const { data: matchData, isLoading } = useJobMatch(userProfile, { ...job, description: job.description || job.title });

    // Sanitize HTML in description if needed, or just render it
    const createMarkup = (html: string) => ({ __html: html || 'No description provided.' });

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden sticky top-8 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-8 border-b border-gray-100 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/20">
                <div className="flex justify-between items-start gap-6">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">{job.title}</h2>
                        <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4" />{job.company}</span>
                            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{job.location || 'Worldwide'}</span>
                            {job.salary_min && <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4" />${job.salary_min.toLocaleString()}</span>}
                        </div>
                    </div>
                    <a
                        href={job.url || job.apply_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-purple-500/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                    >
                        Apply Now <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                {/* AI Match Analysis */}
                <div className="mb-8">
                    {isLoading ? (
                        <div className="bg-purple-50 dark:bg-purple-900/10 rounded-2xl p-8 flex flex-col items-center justify-center border border-purple-100 dark:border-purple-900/30">
                            <Activity className="w-8 h-8 text-purple-500 animate-spin mb-3" />
                            <p className="text-sm font-semibold text-purple-900 dark:text-purple-300">GINI is analyzing your match...</p>
                        </div>
                    ) : matchData ? (
                        <JobMatchBadge
                            score={matchData.overall_score}
                            matchLevel={matchData.match_level}
                            breakdown={matchData.breakdown}
                            explanation={matchData.explanation}
                            recommendation={matchData.recommendation}
                            compact={false}
                        />
                    ) : null}
                </div>

                {/* Job Description */}
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        Job Description
                    </h3>
                    <div
                        className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed job-description-html"
                        dangerouslySetInnerHTML={createMarkup(job.description)}
                    />
                </div>
            </div>
        </div>
    );
};

export default JobSearchPage;
