import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Search, MapPin, Briefcase, DollarSign, Clock, ExternalLink, Star, Globe, Wifi, Tag, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Job {
    id: string;
    title: string;
    company: string;
    location: string;
    type: string;
    salary: string | null;
    posted: string;
    description: string;
    url?: string;
    logo?: string;
    source?: string;
    isRemote?: boolean;
    relevanceScore?: number;
    tags?: string[];
}

// Common keyword presets for quick search
const KEYWORD_PRESETS = [
    'React', 'Python', 'Node.js', 'Java', 'TypeScript', 'AWS', 'Machine Learning',
    'Data Science', 'DevOps', 'Full Stack', 'Frontend', 'Backend', 'Android', 'iOS', 'SQL'
];

export const JobsPage: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [recommendations, setRecommendations] = useState<Job[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [remoteOnly, setRemoteOnly] = useState(false);
    const [activeKeywords, setActiveKeywords] = useState<string[]>([]);
    const [userSkills, setUserSkills] = useState<string[]>([]);
    const [isIndiaUser, setIsIndiaUser] = useState(false);

    useEffect(() => {
        const fetchContextAndJobs = async () => {
            try {
                const token = localStorage.getItem('auth_token');
                if (token) {
                    const profileRes = await fetch('/api/profile/me', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (profileRes.ok) {
                        const profile = await profileRes.json();
                        const skillsArr = Array.isArray(profile.skills) ? profile.skills : [];
                        const skillsStr = skillsArr.join(',');
                        const titleStr = profile.headline || profile.title || '';
                        const locStr = profile.location || '';

                        setUserSkills(skillsArr);
                        setSearchQuery(titleStr);
                        setLocationFilter(locStr);

                        const indiaKeywords = ['india', 'andhra', 'visakhapatnam', 'vizag', 'bangalore', 'hyderabad', 'mumbai', 'delhi', 'pune', 'chennai', 'kolkata'];
                        const indiaUser = indiaKeywords.some(k => locStr.toLowerCase().includes(k));
                        setIsIndiaUser(indiaUser);
                        if (indiaUser) setRemoteOnly(true); // Default remote ON for India users

                        // Chips start empty — user opts in by clicking chips
                        // Pre-selecting chips was silently filtering out most jobs
                        setActiveKeywords([]);

                        await Promise.all([
                            fetchJobs(titleStr, skillsStr, locStr, indiaUser),
                            fetchRecommendations(titleStr, skillsStr)
                        ]);
                        return;
                    }
                }
            } catch (err) {
                console.error("Failed to fetch profile context for jobs", err);
            }
            await fetchJobs();
        };
        fetchContextAndJobs();
    }, [user]);

    // Build effective skills string — always include active keywords
    const buildSkillsParam = () => {
        const combined = [...new Set([...userSkills, ...activeKeywords])];
        return combined.join(',');
    };

    const fetchJobs = async (queryParam = '', skillsParam = '', locParam = '', forceRemote = false) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();

            // Use the query or fall back to broad keyword mix for non-empty results
            const effectiveQuery = queryParam || activeKeywords[0] || KEYWORD_PRESETS[0];
            params.append('query', effectiveQuery);
            if (skillsParam) params.append('skills', skillsParam);

            // Location: if Remote toggle is on or forceRemote, don't restrict location
            if (!forceRemote && !remoteOnly && locParam) {
                params.append('location', locParam);
            }

            const response = await fetch(`/api/jobs?${params.toString()}`);
            const data = await response.json();
            let jobsArr = Array.isArray(data) ? data : (data.jobs || []);

            // Safety net: if still empty, fetch with no restrictions
            if (jobsArr.length === 0) {
                console.log('No jobs returned, broadening search...');
                const broadParams = new URLSearchParams();
                broadParams.append('query', queryParam || 'software developer');
                const broadRes = await fetch(`/api/jobs?${broadParams.toString()}`);
                const broadData = await broadRes.json();
                jobsArr = Array.isArray(broadData) ? broadData : (broadData.jobs || []);
            }

            setJobs(jobsArr);
        } catch (error) {
            console.error('Error fetching jobs:', error);
            setJobs([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecommendations = async (title = '', skills = '') => {
        try {
            const params = new URLSearchParams();
            if (title) params.append('title', title);
            if (skills) params.append('skills', skills);
            const res = await fetch(`/api/jobs/recommendations?${params.toString()}`);
            const data = await res.json();
            setRecommendations(Array.isArray(data) ? data.slice(0, 6) : []);
        } catch (e) {
            console.error('Failed to load recommendations:', e);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        // Clear old recommendations first to show reactivity
        setRecommendations([]);
        await Promise.all([
            fetchJobs(searchQuery, buildSkillsParam(), remoteOnly ? '' : locationFilter, remoteOnly),
            fetchRecommendations(searchQuery, buildSkillsParam())
        ]);
        showToast('Job search updated', 'info');
    };

    const toggleKeyword = async (kw: string) => {
        const next = activeKeywords.includes(kw)
            ? activeKeywords.filter(k => k !== kw)
            : [...activeKeywords, kw];
        setActiveKeywords(next);
        // Immediately re-search with new keywords
        const combinedSkills = [...new Set([...userSkills, ...next])].join(',');
        await fetchJobs(searchQuery, combinedSkills, remoteOnly ? '' : locationFilter);
    };

    const toggleRemote = async () => {
        const newVal = !remoteOnly;
        setRemoteOnly(newVal);
        if (newVal) setLocationFilter(''); // Clear location when going remote
        await fetchJobs(searchQuery, buildSkillsParam(), newVal ? '' : locationFilter, newVal);
        showToast(newVal ? '🌐 Showing remote jobs worldwide' : 'Showing all locations', 'info');
    };

    // Smart local filter: remote/worldwide jobs always pass when Remote toggle is on
    const filteredJobs = jobs.filter(job => {
        // We removed `matchesSearch` local string matching. 
        // The backend ALREADY filters and ranks jobs by relevance to the query. 
        // If the backend returns it (e.g. "AI Engineer" for "Data Scientist"), we show it.

        // Keyword chip filter: ONLY apply if user has explicitly clicked chips
        // Strip HTML and match against title + plain text description + tags
        const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&[^;]+;/g, ' ');
        const matchesKeywords = activeKeywords.length === 0 ||
            activeKeywords.some(kw => {
                const kwLower = kw.toLowerCase();
                const jobTitle = (job.title || '').toLowerCase();
                const jobTags = (job.tags || []).join(' ').toLowerCase();
                const jobDesc = stripHtml(job.description || '').toLowerCase();
                return jobTitle.includes(kwLower) || jobTags.includes(kwLower) || jobDesc.includes(kwLower);
            });

        // Location filter removed: The backend fetches Remote/Global jobs, 
        // so we don't want to hide them on the frontend just because the 
        // string "remote" is missing from the location field or doesn't match the user's city exactly.

        return matchesKeywords;
    });

    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays}d ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
            return d.toLocaleDateString();
        } catch { return dateStr; }
    };

    const JobCard: React.FC<{ job: Job; compact?: boolean }> = ({ job, compact }) => {
        const isRemoteJob = job.isRemote || (job.location || '').toLowerCase().includes('remote') ||
            (job.location || '').toLowerCase().includes('worldwide');
        return (
            <div className={`bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border hover:shadow-md transition-shadow ${compact ? 'p-4' : 'p-5'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        {job.logo && (
                            <img src={job.logo} alt={job.company} className="w-9 h-9 rounded-lg object-contain shrink-0 border border-gray-100 dark:border-gray-700" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <div className="min-w-0">
                            <h3 className={`font-semibold text-gray-900 dark:text-white line-clamp-1 ${compact ? 'text-sm' : 'text-base'}`}>{job.title}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{job.company}</p>
                        </div>
                    </div>
                    <a href={job.url || '#'} target="_blank" rel="noopener noreferrer"
                        className="ml-2 shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1">
                        Apply <ExternalLink size={11} />
                    </a>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className={`flex items-center gap-1 ${isRemoteJob ? 'text-green-600 dark:text-green-400 font-semibold' : ''}`}>
                        {isRemoteJob ? <Globe size={11} /> : <MapPin size={11} />}
                        {job.location || 'Remote'}
                    </span>
                    <span className="flex items-center gap-1"><Briefcase size={11} />{job.type}</span>
                    {job.salary && <span className="flex items-center gap-1"><DollarSign size={11} />{job.salary}</span>}
                    <span className="flex items-center gap-1"><Clock size={11} />{formatDate(job.posted)}</span>
                    {job.source && <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px] font-medium">{job.source}</span>}
                </div>

                {job.tags && job.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {job.tags.slice(0, 5).map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-[9px] font-medium">{tag}</span>
                        ))}
                    </div>
                )}

                {!compact && job.description && (
                    <div className="prose prose-xs dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 line-clamp-3 text-xs leading-relaxed">
                        <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{ a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" /> }}>
                            {job.description.slice(0, 400) + (job.description.length > 400 ? '...' : '')}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
        );
    };

    // Get keyword chips: user's own skills first, then presets not already in skills
    const keywordChips = [
        ...userSkills.slice(0, 10),
        ...KEYWORD_PRESETS.filter(p => !userSkills.some(s => s.toLowerCase() === p.toLowerCase())).slice(0, 8)
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Job Search</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Remote &amp; India-friendly opportunities matched to your profile</p>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-200 dark:border-dark-border p-5 space-y-4">
                {/* Row 1: Search + Location + Remote toggle */}
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                        <input
                            type="text"
                            placeholder="Job title, role or company..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        {/* Location input — hidden when Remote is ON */}
                        {!remoteOnly && (
                            <div className="relative flex-1 min-w-[160px]">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                                <input
                                    type="text"
                                    placeholder="City or country..."
                                    value={locationFilter}
                                    onChange={(e) => setLocationFilter(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                        )}

                        {/* Remote toggle button */}
                        <button
                            type="button"
                            onClick={toggleRemote}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all shrink-0 ${remoteOnly
                                ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-green-500 hover:text-green-600'
                                }`}
                        >
                            <Wifi size={15} />
                            Remote
                            {remoteOnly && <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">ON</span>}
                        </button>

                        <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shrink-0">
                            Search
                        </button>
                    </div>
                </div>

                {/* Row 2: Keyword filter chips */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Tag size={13} className="text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Filter by keyword</span>
                        {activeKeywords.length > 0 && (
                            <button type="button" onClick={() => { setActiveKeywords([]); fetchJobs(searchQuery, userSkills.join(','), remoteOnly ? '' : locationFilter); }}
                                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-0.5 ml-auto">
                                <X size={11} /> Clear all
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {keywordChips.map(kw => (
                            <button
                                key={kw}
                                type="button"
                                onClick={() => toggleKeyword(kw)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${activeKeywords.includes(kw)
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:text-blue-600'
                                    }`}
                            >
                                {kw}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Search Clarity & India Hints */}
                <div className="flex flex-col gap-1.5 mt-2">
                    {searchQuery && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 bg-blue-50/50 dark:bg-blue-900/10 p-1.5 rounded-lg border border-blue-100/50 dark:border-blue-800/30">
                            <Search size={10} className="text-blue-500" />
                            Showing broader matches for <strong className="text-gray-700 dark:text-gray-300">"{searchQuery}"</strong> to ensure you see relevant opportunities.
                        </p>
                    )}
                    {isIndiaUser && (
                        <p className="text-[11px] text-green-600 dark:text-green-500 flex items-center gap-1.5 bg-green-50/50 dark:bg-green-900/10 p-1.5 rounded-lg border border-green-100/50 dark:border-green-800/30">
                            <Globe size={10} />
                            India profile detected — Remote &amp; Worldwide jobs are prioritised.
                        </p>
                    )}
                </div>
            </form>

            {/* Profile-Based Recommendations */}
            {recommendations.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Star size={16} className="text-yellow-500 fill-yellow-400" />
                        <h2 className="text-base font-bold text-gray-900 dark:text-white">Recommended for You</h2>
                        <span className="text-xs text-gray-400">based on your profile</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {recommendations.map(job => <JobCard key={`rec_${job.id}`} job={job} compact />)}
                    </div>
                </div>
            )}

            {/* All Jobs */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">
                        {remoteOnly ? '🌐 Remote Jobs' : 'All Jobs'}
                        {activeKeywords.length > 0 && <span className="ml-2 text-blue-600 font-normal text-sm">· {activeKeywords.join(', ')}</span>}
                    </h2>
                    {!loading && (
                        <span className="text-sm text-gray-500">
                            {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
                        </span>
                    )}
                </div>

                <div className="space-y-3">
                    {loading ? (
                        <div className="text-center py-16 text-gray-500 bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border">
                            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
                            <p className="text-sm">Searching across job boards...</p>
                        </div>
                    ) : filteredJobs.length === 0 ? (
                        <div className="text-center py-16 text-gray-500 bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border">
                            <Globe size={36} className="mx-auto mb-3 text-gray-300" />
                            <p className="font-semibold mb-1 text-gray-700 dark:text-gray-300">No matching jobs found</p>
                            <p className="text-sm mb-4">Try enabling Remote mode or clearing keyword filters</p>
                            <div className="flex gap-2 justify-center">
                                <button onClick={toggleRemote}
                                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-1.5">
                                    <Wifi size={14} /> Enable Remote
                                </button>
                                {activeKeywords.length > 0 && (
                                    <button onClick={() => setActiveKeywords([])}
                                        className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 flex items-center gap-1.5">
                                        <X size={14} /> Clear Filters
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        filteredJobs.map(job => <JobCard key={job.id} job={job} />)
                    )}
                </div>
            </div>
        </div>
    );
};
