import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    Home,
    MessageSquare,
    User,
    Briefcase,
    GraduationCap,
    FileText,
    Settings,
    LogOut,
    Target,
    Mic,
    Map,
    Zap,
    BarChart3,
    LayoutDashboard,
    ChevronUp,
    ChevronDown,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

const navItems = [
    { icon: Home, label: 'Home', path: '/home' },
    { icon: FileText, label: 'Resume Builder', path: '/resume-builder' },
    { icon: Briefcase, label: 'Job Search', path: '/jobs' },
    { icon: GraduationCap, label: 'Learning Hub', path: '/learning' },
];

const aiToolItems = [
    { icon: MessageSquare, label: 'GINI Chat', path: '/gini-chat' },
    { icon: Target, label: 'Skill Gaps', path: '/skill-gaps' },
    { icon: Mic, label: 'Interview Prep', path: '/interview-practice' },
    { icon: Map, label: 'Career Roadmap', path: '/career-roadmap' },
    { icon: Zap, label: 'Advisor', path: '/advisor' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: LayoutDashboard, label: 'Applications', path: '/applications' },
];

import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Sidebar: React.FC = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <aside className="hidden md:flex flex-col w-72 bg-white dark:bg-dark-card border-r border-gray-200 dark:border-dark-border">
            <div className="p-6 pb-2 border-b border-gray-100 dark:border-dark-border/50">
                <div className="flex items-center justify-center">
                    <img src="/logo.png" alt="CareerGini Logo" className="h-14 md:h-16 w-auto mix-blend-multiply dark:mix-blend-normal drop-shadow-sm" />
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Menu
                </div>
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            clsx(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                                isActive
                                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-border/50 hover:text-gray-900 dark:hover:text-gray-200"
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon size={20} className={clsx("transition-transform group-hover:scale-110", isActive && "text-blue-600 dark:text-blue-400")} />
                                <span>{item.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}

                <div className="px-4 pt-4 pb-2 text-xs font-semibold text-purple-400 uppercase tracking-wider">
                    AI Tools
                </div>
                {aiToolItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            clsx(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                                isActive
                                    ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-border/50 hover:text-gray-900 dark:hover:text-gray-200"
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon size={20} className={clsx("transition-transform group-hover:scale-110", isActive && "text-purple-600 dark:text-purple-400")} />
                                <span>{item.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-100 dark:border-dark-border relative" ref={menuRef}>
                {isMenuOpen && (
                    <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden animate-fadeIn">
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                navigate('/settings');
                            }}
                            className="flex items-center gap-3 px-4 py-3 w-full text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border/50 transition-colors text-sm"
                        >
                            <Settings size={18} />
                            <span>Settings</span>
                        </button>
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                navigate('/profile');
                            }}
                            className="flex items-center gap-3 px-4 py-3 w-full text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border/50 transition-colors text-sm"
                        >
                            <User size={18} />
                            <span>Profile</span>
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                        <button
                            onClick={logout}
                            className="flex items-center gap-3 px-4 py-3 w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
                        >
                            <LogOut size={18} />
                            <span>Logout</span>
                        </button>
                    </div>
                )}

                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center justify-between w-full p-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold border border-blue-200 dark:border-blue-800">
                            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-medium truncate max-w-[120px]">
                                {user?.full_name || 'User'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Settings</p>
                        </div>
                    </div>
                    {isMenuOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
            </div>
        </aside>
    );
};
