import React from 'react';
import { Bell, Moon, Sun, Search, LogIn, User as UserIcon, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate, Link } from 'react-router-dom';

export const Header: React.FC = () => {
    const { user, logout, isAuthenticated } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    return (
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-dark-card/80 backdrop-blur-md border-b border-gray-200/50 dark:border-dark-border/50">
            {/* Search Bar */}
            <div className="relative w-96 hidden md:block group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                <input
                    type="text"
                    placeholder="Search jobs, skills, or resources..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-all"
                />
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-4">
                <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border rounded-full transition-colors relative">
                    <Bell size={20} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-dark-card"></span>
                </button>

                <button
                    onClick={toggleTheme}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border rounded-full transition-colors"
                    aria-label="Toggle theme"
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-dark-border">
                    {isAuthenticated && user ? (
                        <>
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.full_name || 'User'}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                            </div>
                            <div className="relative group cursor-pointer">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="Profile" className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-800" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white dark:ring-gray-800">
                                        {user.full_name?.[0] || 'U'}
                                    </div>
                                )}

                                {/* Dropdown */}
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-card rounded-xl shadow-lg border border-gray-100 dark:border-dark-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right z-50">
                                    <div className="p-2">
                                        <Link to="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-bg rounded-lg">
                                            <UserIcon size={16} /> Profile
                                        </Link>
                                        {user?.role === 'admin' && (
                                            <Link to="/admin" className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                                                <Shield size={16} /> Admin Portal
                                            </Link>
                                        )}
                                        <button
                                            onClick={logout}
                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                        >
                                            <LogOut size={16} /> Logout
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-500/30"
                        >
                            <LogIn size={18} />
                            <span>Login</span>
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};
