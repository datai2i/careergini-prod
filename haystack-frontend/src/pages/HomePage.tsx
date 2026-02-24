import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, FileText, Briefcase, GraduationCap, TrendingUp, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [resumesCount, setResumesCount] = useState(0);
    const [coursesCompleted, setCoursesCompleted] = useState(0);

    useEffect(() => {
        const fetchMetrics = async () => {
            if (!user?.id) {
                console.log("[HomePage] No user.id found, skipping metrics fetch.");
                return;
            }
            console.log("[HomePage] Fetching metrics for user:", user.id);
            try {
                // Fetch resumes count
                const resumeRes = await fetch(`/api/resume/sessions/${user.id}`);
                console.log("[HomePage] Resume API status:", resumeRes.status);
                if (resumeRes.ok) {
                    const data = await resumeRes.json();
                    console.log("[HomePage] Resume API data:", data);
                    if (data && data.sessions) {
                        setResumesCount(data.sessions.length);
                    }
                }

                // Fetch learning progress
                const learnRes = await fetch(`/api/learning/progress?user_id=${user.id}`);
                console.log("[HomePage] Learning API status:", learnRes.status);
                if (learnRes.ok) {
                    const data = await learnRes.json();
                    if (Array.isArray(data)) {
                        setCoursesCompleted(data.filter((item: any) => item.is_completed).length);
                    }
                }
            } catch (err) {
                console.error("[HomePage] Failed to fetch metrics", err);
            }
        };

        fetchMetrics();
    }, [user]);

    const quickActions = [
        {
            icon: MessageSquare,
            title: 'GINI Chat',
            description: 'Get personalized career guidance and advice from GINI',
            color: 'from-blue-500 to-blue-600',
            path: '/gini-chat'
        },
        {
            icon: FileText,
            title: 'Resume Builder',
            description: 'Create and optimize your professional resume',
            color: 'from-purple-500 to-purple-600',
            path: '/resume-builder'
        },
        {
            icon: Briefcase,
            title: 'Job Search',
            description: 'Discover opportunities matching your profile',
            color: 'from-green-500 to-green-600',
            path: '/jobs'
        },
        {
            icon: GraduationCap,
            title: 'Learning Hub',
            description: 'Upskill with courses and certifications',
            color: 'from-orange-500 to-orange-600',
            path: '/learning'
        }
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-4 md:p-6 text-white shadow-md">
                <div className="flex items-center gap-3 mb-1">
                    <Sparkles size={20} className="text-yellow-300" />
                    <h1 className="text-xl md:text-2xl font-bold">Welcome back{user?.full_name ? `, ${user.full_name}` : ''}!</h1>
                </div>
                <p className="text-sm md:text-base text-blue-100 max-w-2xl">
                    Your AI-powered career companion. Get personalized guidance, build standout resumes,
                    and discover opportunities faster.
                </p>
            </div>

            {/* Quick Actions Grid */}
            <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quickActions.map((action, index) => (
                        <button
                            key={index}
                            onClick={() => navigate(action.path)}
                            className="group bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md hover:border-blue-200 transition-all duration-200 text-left flex items-center gap-4"
                        >
                            <div className={`w-12 h-12 shrink-0 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform`}>
                                <action.icon size={20} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {action.title}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                    {action.description}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Overview */}
            <div className="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-100 dark:border-dark-border">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Your Progress</h2>
                <div className="grid grid-cols-2 gap-4 divide-x divide-gray-100 dark:divide-gray-800">
                    <div className="flex flex-col items-center justify-center text-center px-4">
                        <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mb-2">
                            <FileText className="text-purple-600 dark:text-purple-400" size={16} />
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white mb-0.5">{resumesCount}</div>
                        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Resumes Created</div>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center px-4">
                        <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center mb-2">
                            <GraduationCap className="text-green-600 dark:text-green-400" size={16} />
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white mb-0.5">{coursesCompleted}</div>
                        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Courses</div>
                    </div>
                </div>
            </div>

            {/* Tips Section */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">💡 Career Tip of the Day</h3>
                <p className="text-gray-700 dark:text-gray-300">
                    Start your job search by updating your profile with your latest skills and experience.
                    A complete profile increases your chances of getting noticed by recruiters by 40%!
                </p>
            </div>
        </div>
    );
};
