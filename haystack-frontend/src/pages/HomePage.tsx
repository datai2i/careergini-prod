import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, FileText, Briefcase, GraduationCap, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import { GiniGuide } from '../components/GiniGuide';

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
                        setCoursesCompleted(data.filter((item: { is_completed: boolean }) => item.is_completed).length);
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
            icon: FileText,
            title: 'Resume Builder',
            description: 'Optimize your professional profile',
            color: 'from-purple-500 to-purple-600',
            path: '/resume-builder'
        },
        {
            icon: Briefcase,
            title: 'Job Search',
            description: 'Discover opportunities',
            color: 'from-green-500 to-green-600',
            path: '/jobs'
        },
        {
            icon: GraduationCap,
            title: 'Learning Hub',
            description: 'Upskill & get certified',
            color: 'from-orange-500 to-orange-600',
            path: '/learning'
        },
        {
            icon: MessageSquare,
            title: 'GINI Chat',
            description: 'Get personalized career guidance',
            color: 'from-blue-500 to-blue-600',
            path: '/gini-chat'
        }
    ];

    return (
        <div className="max-w-7xl mx-auto w-full space-y-6 animate-fadeIn">
            {/* Hero Section */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-4 text-white shadow-md">
                <Sparkles size={20} className="text-yellow-300" />
                <h1 className="text-lg md:text-xl font-bold">Welcome back{user?.full_name ? `, ${user.full_name}` : ''}!</h1>
            </div>

            {/* Top Row: Workspace & Progress */}
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
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">
                                        {action.description}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Overview */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-dark-border">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Your Progress</h2>
                    <div className="grid grid-cols-2 gap-4 divide-x divide-gray-100 dark:divide-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl h-[calc(100%-2rem-16px)]">
                        <div className="flex flex-col items-center justify-center text-center px-4">
                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-2">
                                <FileText className="text-purple-600 dark:text-purple-400" size={16} />
                            </div>
                            <div className="text-2xl font-black text-gray-900 dark:text-white mb-0.5">{resumesCount}</div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Resumes Created</div>
                        </div>
                        <div className="flex flex-col items-center justify-center text-center px-4">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-2">
                                <GraduationCap className="text-green-600 dark:text-green-400" size={16} />
                            </div>
                            <div className="text-2xl font-black text-gray-900 dark:text-white mb-0.5">{coursesCompleted}</div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Courses Finished</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row: GINI Guide Full Width */}
            <div className="flex flex-col h-[600px] lg:h-[700px]">
                <GiniGuide />
            </div>
        </div>
    );
};
