import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, FileText, Briefcase, GraduationCap, Sparkles, Zap, ChevronRight, Star, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GiniGuide } from '../components/GiniGuide';

const PLAN_META: Record<string, { label: string; maxBuilds: number; color: string; upgradePlans: { key: string; label: string; price: string }[] }> = {
    free: { label: 'Free', maxBuilds: 1, color: 'text-gray-600', upgradePlans: [{ key: 'starter', label: 'Starter', price: '$5' }, { key: 'premium', label: 'Premium', price: '$20' }] },
    basic: { label: 'Starter', maxBuilds: 5, color: 'text-blue-600', upgradePlans: [{ key: 'premium', label: 'Premium', price: '$20' }] },
    premium: { label: 'Premium', maxBuilds: 20, color: 'text-purple-600', upgradePlans: [] },
};

const PLAN_FEATURES: Record<string, string[]> = {
    free: ['1 AI resume build', 'ATS score & feedback', 'PDF export'],
    basic: ['5 AI resume builds', 'Industry-specific tailoring', 'Cover letter auto-generation', 'ATS score + regeneration'],
    premium: ['20 AI resume builds', 'Gini Chat AI mentor (unlimited)', 'Hyper-personalised job search', 'Learning Hub', 'All Starter features'],
};

export const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [resumesCount, setResumesCount] = useState(0);
    const [coursesCompleted, setCoursesCompleted] = useState(0);

    const plan = user?.plan || 'free';
    const meta = PLAN_META[plan] || PLAN_META.free;
    const buildCount = user?.resume_count || 0;
    const maxBuilds = meta.maxBuilds;
    const progressPct = Math.min(100, Math.round((buildCount / maxBuilds) * 100));

    useEffect(() => {
        const fetchMetrics = async () => {
            if (!user?.id) return;
            try {
                const resumeRes = await fetch(`/api/resume/sessions/${user.id}`);
                if (resumeRes.ok) {
                    const data = await resumeRes.json();
                    if (data?.sessions) setResumesCount(data.sessions.length);
                }
                const learnRes = await fetch(`/api/learning/progress?user_id=${user.id}`);
                if (learnRes.ok) {
                    const data = await learnRes.json();
                    if (Array.isArray(data)) setCoursesCompleted(data.filter((item: { is_completed: boolean }) => item.is_completed).length);
                }
            } catch (err) {
                console.error('[HomePage] Failed to fetch metrics', err);
            }
        };
        fetchMetrics();
    }, [user]);

    const quickActions = [
        { icon: FileText, title: 'Resume Builder', description: 'Optimize your professional profile', color: 'from-purple-500 to-purple-600', path: '/resume-builder' },
        { icon: Briefcase, title: 'Job Search', description: 'Discover opportunities', color: 'from-green-500 to-green-600', path: '/jobs' },
        { icon: GraduationCap, title: 'Learning Hub', description: 'Upskill & get certified', color: 'from-orange-500 to-orange-600', path: '/learning' },
        { icon: MessageSquare, title: 'GINI Chat', description: 'Get personalized career guidance', color: 'from-blue-500 to-blue-600', path: '/gini-chat' },
    ];

    return (
        <div className="max-w-7xl mx-auto w-full space-y-6 animate-fadeIn">
            {/* Hero Section */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-4 text-white shadow-md">
                <Sparkles size={20} className="text-yellow-300" />
                <h1 className="text-lg md:text-xl font-bold">Welcome back{user?.full_name ? `, ${user.full_name}` : ''}!</h1>
            </div>

            {/* Top Row: Workspace & Plan Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick Actions Grid */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-dark-border">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Workspace Tools</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {quickActions.map((action, index) => (
                            <button
                                key={index}
                                onClick={() => navigate(action.path)}
                                className="group bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 shadow-sm border border-transparent hover:border-blue-200 transition-all duration-200 text-left flex items-start sm:items-center gap-3"
                            >
                                <div className={`w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform`}>
                                    <action.icon size={18} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {action.title}
                                    </h3>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">{action.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Plan Status Card */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-dark-border flex flex-col gap-4">
                    {/* Plan Badge + Title */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your Plan</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Current usage & available features</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold bg-opacity-10 ${plan === 'premium' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                            plan === 'basic' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                            {plan === 'premium' ? <span className="flex items-center gap-1"><Star size={10} /> {meta.label}</span> :
                                plan === 'basic' ? <span className="flex items-center gap-1"><Zap size={10} /> {meta.label}</span> :
                                    <span className="flex items-center gap-1"><Globe size={10} /> {meta.label}</span>}
                        </span>
                    </div>

                    {/* Build Usage */}
                    <div>
                        <div className="flex justify-between text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                            <span>Resume Builds Used</span>
                            <span className={buildCount >= maxBuilds ? 'text-red-500' : meta.color}>{buildCount} / {maxBuilds}</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${buildCount >= maxBuilds ? 'bg-red-500' :
                                    progressPct >= 80 ? 'bg-orange-500' :
                                        plan === 'premium' ? 'bg-purple-600' : plan === 'basic' ? 'bg-blue-600' : 'bg-gray-500'
                                    }`}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>

                    {/* Features on current plan */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Your plan includes</p>
                        <div className="grid grid-cols-1 gap-1">
                            {(PLAN_FEATURES[plan] || []).map((f, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                    <div className="w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-2.5 h-2.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    {f}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Upgrade CTA or Contact */}
                    {meta.upgradePlans.length > 0 ? (
                        <div className="mt-auto flex flex-col gap-2">
                            {meta.upgradePlans.map(up => (
                                <button
                                    key={up.key}
                                    onClick={() => navigate(`/payment?plan=${up.key}`)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-white text-sm font-bold hover:-translate-y-0.5 hover:shadow-lg transition-all ${up.key === 'premium'
                                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600'
                                            : 'bg-gradient-to-r from-blue-500 to-blue-600'
                                        }`}
                                >
                                    <span>Upgrade to {up.label} — {up.price} one-time</span>
                                    <ChevronRight size={16} />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-auto p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 text-xs text-purple-700 dark:text-purple-300 font-medium text-center">
                            {buildCount >= maxBuilds
                                ? '🔋 20 builds used. Contact team@datai2i.com to reload credits.'
                                : '🌟 You\'re on the full Premium plan. Enjoy all features!'}
                        </div>
                    )}

                    {/* Stats sub-row */}
                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100 dark:border-gray-800">
                        <div className="text-center">
                            <div className="text-xl font-black text-gray-900 dark:text-white">{resumesCount}</div>
                            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Total Sessions</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-black text-gray-900 dark:text-white">{coursesCompleted}</div>
                            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Courses Done</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gini Guide */}
            <div className="flex flex-col h-[600px] lg:h-[700px]">
                <GiniGuide />
            </div>
        </div>
    );
};
