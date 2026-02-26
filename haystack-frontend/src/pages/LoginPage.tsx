import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, BrainCircuit, Target, MessageSquare, Star, ShieldCheck, Zap } from 'lucide-react';

export const LoginPage: React.FC = () => {
    // The backend authentication URL 
    const AUTH_URL = `/api/profile/auth`;
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLogin = (provider: string) => {
        window.location.href = `${AUTH_URL}/${provider}?source=haystack`;
    };

    const features = [
        {
            icon: <BrainCircuit className="w-8 h-8 text-blue-500" />,
            title: "Hyper-Personalized Resumes",
            description: "Our AI analyzes your unique experience to instantly draft and tailor resumes that perfectly match target job descriptions."
        },
        {
            icon: <Target className="w-8 h-8 text-purple-500" />,
            title: "Intelligent Job Matching",
            description: "Stop scrolling endlessly. CareerGini scans thousands of remote and global listings to find the roles you're actually qualified for."
        },
        {
            icon: <MessageSquare className="w-8 h-8 text-indigo-500" />,
            title: "Context-Aware GINI Chat",
            description: "Chat with an AI career coach that truly knows you. GINI remembers your skills, goals, and experience to provide actionable advice."
        }
    ];

    const reviews = [
        {
            name: "Sarah Jenkins",
            role: "Senior Product Designer",
            content: "CareerGini completely transformed my job hunt. The AI tailored my resume so perfectly that I started getting interviews within days instead of months.",
            rating: 5
        },
        {
            name: "David Chen",
            role: "Software Engineer",
            content: "The GINI Chat feels like talking to a mentor who has my entire resume memorized. The job matching is spot on, filtering out all the noise.",
            rating: 5
        },
        {
            name: "Elena Rodriguez",
            role: "Marketing Manager",
            content: "I didn't even have a resume ready. The 'Draft Manually' tool built a professional profile for me in minutes. Pure magic.",
            rating: 5
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-sans selection:bg-blue-500/30">

            {/* --- Sticky Navbar --- */}
            <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 py-3 shadow-sm' : 'bg-transparent py-5'}`}>
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center">
                        <img src="/logo.png" alt="CareerGini Logo" className="h-12 md:h-16 w-auto mix-blend-multiply dark:mix-blend-normal" />
                    </div>

                    <div>
                        <button
                            onClick={() => handleLogin('google')}
                            className="group relative flex items-center gap-3 px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-full font-semibold hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-4 h-4" alt="Google" />
                            <span>Sign In</span>
                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* --- Hero Section --- */}
            <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                {/* Animated Background Orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/20 dark:bg-blue-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] animate-blob"></div>
                    <div className="absolute top-20 -right-20 w-[500px] h-[500px] bg-purple-500/20 dark:bg-purple-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000"></div>
                    <div className="absolute -bottom-40 left-1/2 w-[600px] h-[600px] bg-indigo-500/20 dark:bg-indigo-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] animate-blob animation-delay-4000"></div>

                    {/* Grid Pattern */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
                </div>

                <div className="relative max-w-7xl mx-auto px-6 text-center z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium text-sm mb-8 border border-blue-200 dark:border-blue-800/50 shadow-sm animate-fade-in-up">
                        <Zap className="w-4 h-4" />
                        <span>The Next Generation of Career Advancement</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight animate-fade-in-up animation-delay-100">
                        Unlock Your Potential with an <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 animate-gradient-x">
                            AI-Powered Career Coach
                        </span>
                    </h1>

                    <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in-up animation-delay-200">
                        Stop agonizing over resumes and endless job boards. Let CareerGini tailor your profile, find your perfect roles, and guide your next big leap.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-300">
                        <button
                            onClick={() => handleLogin('google')}
                            className="w-full sm:w-auto px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-lg hover:shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
                            <span>Start Building for Free</span>
                        </button>

                        <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 ml-0 sm:ml-4">
                            <ShieldCheck className="w-5 h-5 text-green-500" />
                            <span>No credit card required. Secure login.</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Features Section --- */}
            <div className="py-24 bg-white/50 dark:bg-slate-800/50 border-y border-gray-200 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Land the Job</h2>
                        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                            A complete suite of AI tools designed specifically to fast-track your career growth.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {features.map((feature, idx) => (
                            <div key={idx} className="group p-8 rounded-3xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-800 shadow-lg hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-2">
                                <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                                    {feature.icon}
                                </div>
                                <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{feature.title}</h3>
                                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- Social Proof / Reviews Section --- */}
            <div className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-50 dark:bg-blue-900/10 -skew-y-3 transform origin-top-left -z-10 border-y border-blue-100 dark:border-blue-900/30"></div>

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Loved by Professionals</h2>
                        <p className="text-lg text-gray-600 dark:text-gray-400">Join thousands of others who accelerated their careers with CareerGini.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {reviews.map((review, idx) => (
                            <div key={idx} className="p-8 rounded-3xl bg-white dark:bg-slate-800 shadow-md border border-gray-100 dark:border-gray-700/50">
                                <div className="flex items-center gap-1 mb-6">
                                    {[...Array(review.rating)].map((_, i) => (
                                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                                    ))}
                                </div>
                                <p className="text-gray-700 dark:text-gray-300 text-lg mb-6 leading-relaxed italic">
                                    "{review.content}"
                                </p>
                                <div className="flex items-center gap-4 border-t border-gray-100 dark:border-gray-700 pt-6">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                                        {review.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">{review.name}</h4>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">{review.role}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- Footer --- */}
            <footer className="py-12 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2 opacity-80">
                        <Sparkles className="w-5 h-5 text-blue-500" />
                        <span className="font-bold text-lg">CareerGini</span>
                    </div>

                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        © {new Date().getFullYear()} CareerGini. All rights reserved.
                    </p>

                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        <p>
                            By continuing, you agree to our{' '}
                            <a href="#" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">Terms of Service</a>
                            {' '}and{' '}
                            <a href="#" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</a>.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};
