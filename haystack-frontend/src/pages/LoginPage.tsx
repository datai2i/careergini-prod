import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, BrainCircuit, Target, MessageSquare, Star, ShieldCheck, Zap, Check, X, Globe, BookOpen, Compass, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
    const AUTH_URL = `/api/profile/auth`;
    const { isAuthenticated, loading } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // If auth is still loading AND we have a token, show a blank loading screen
    // so the full login page never flashes for already-authenticated users
    if (loading && localStorage.getItem('auth_token')) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                    <p className="text-sm text-gray-500 font-medium">Signing you in...</p>
                </div>
            </div>
        );
    }

    // Already authenticated — RootRedirect will navigate away, show nothing
    if (isAuthenticated) return null;

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
            title: "Industry-Specific Tailoring",
            description: "Dominate your niche. Adapt your resume vocabulary specifically for Tech/SaaS, Finance, Healthcare, Creative Agencies, and more."
        },
        {
            icon: <Zap className="w-8 h-8 text-amber-500" />,
            title: "Strategic Tone Control",
            description: "Choose your narrative pitch. Scale from 'Standard ATS Optimization' to 'Metrics & Revenue Focused', or 'Leadership & Strategy'."
        },
        {
            icon: <ShieldCheck className="w-8 h-8 text-green-500" />,
            title: "ATS Score Regeneration",
            description: "Get instant ATS scoring feedback on your tailored drafts, with the one-click ability to continuously regenerate for a higher match."
        },
        {
            icon: <MessageSquare className="w-8 h-8 text-indigo-500" />,
            title: "Context-Aware GINI Chat",
            description: "Chat with an AI career coach that truly knows you. GINI remembers your skills, goals, and experience to provide actionable advice."
        },
        {
            icon: <Star className="w-8 h-8 text-pink-500" />,
            title: "Full Editing Control",
            description: "Review your full baseline profile and edit AI-generated bullets before finalizing. Export beautiful, hyperlinked PDFs in seconds."
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
                    <div className="flex items-center gap-4">
                        <img src="/logo.png" alt="CareerGini Logo" className="h-14 md:h-18 w-auto mix-blend-multiply dark:mix-blend-normal" />
                        <span className="hidden sm:flex items-center gap-2.5 border-l border-gray-300 dark:border-gray-600 pl-4">
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold tracking-wide">by</span>
                            <img src="/datai2i-logo.png" alt="DATAi2i" className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity mix-blend-multiply dark:mix-blend-normal" />
                        </span>
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

            {/* --- Global Stats Bar --- */}
            <div className="py-12 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
                        {[
                            { value: '98%', label: 'Fortune 500s use ATS filters', sub: 'We help you pass them.' },
                            { value: '3x', label: 'More interviews', sub: 'vs. untailored resumes' },
                            { value: '150+', label: 'Countries supported', sub: 'Global job markets' },
                            { value: '<5 min', label: 'From upload to tailored PDF', sub: 'AI-powered speed' }
                        ].map((stat, i) => (
                            <div key={i} className="space-y-1">
                                <p className="text-4xl font-extrabold tracking-tight">{stat.value}</p>
                                <p className="text-sm font-semibold text-white/90">{stat.label}</p>
                                <p className="text-xs text-white/60">{stat.sub}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- Pricing Section --- */}
            <div id="pricing" className="py-24 bg-white dark:bg-slate-900">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-6">
                        <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800 mb-6">Simple, Transparent Pricing</span>
                        <h2 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">Pay Once. Use Forever.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">No Subscriptions. No Surprises.</span></h2>
                        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                            Buy resume build credits once — they <strong>never expire</strong>. Whether you're a fresh graduate in Nairobi, a senior engineer in Berlin, or pivoting careers in Toronto, just pay for what you use.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 items-stretch">

                        {/* Free Plan */}
                        <div className="relative flex flex-col p-8 rounded-3xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className="mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                                    <Globe className="w-6 h-6 text-gray-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Free</h3>
                                <div className="flex items-end gap-1 mt-3">
                                    <span className="text-5xl font-extrabold text-gray-900 dark:text-white">$0</span>
                                    <span className="text-gray-500 dark:text-gray-400 mb-2">forever</span>
                                </div>
                                <div className="mt-3 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg inline-block">
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">1 resume build included · No card needed</span>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Try it once. See what a truly AI-tailored, ATS-optimised resume feels like — completely free, forever.</p>
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {[
                                    { text: '1 AI-tailored resume build', included: true },
                                    { text: 'PDF export with hyperlinks', included: true },
                                    { text: 'ATS score & feedback', included: true },
                                    { text: 'Upload or manually draft profile', included: true },
                                    { text: 'Gini Guide recommendations', included: false },
                                    { text: 'GINI Chat career coach', included: false },
                                    { text: 'Hyper-personalized job search', included: false },
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        {item.included ? <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" /> : <X className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />}
                                        <span className={`text-sm ${item.included ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 line-through'}`}>{item.text}</span>
                                    </li>
                                ))}
                            </ul>

                            <button onClick={() => handleLogin('google')} className="w-full py-3 px-6 rounded-xl border-2 border-gray-900 dark:border-white text-gray-900 dark:text-white font-bold hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-gray-900 transition-all duration-200">
                                Start for Free
                            </button>
                        </div>

                        {/* Basic Plan */}
                        <div className="relative flex flex-col p-8 rounded-3xl border-2 border-blue-500 bg-white dark:bg-slate-800 shadow-2xl shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/40">
                                    <Zap className="w-3.5 h-3.5" /> Most Popular
                                </span>
                            </div>
                            <div className="mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mb-4">
                                    <BookOpen className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Basic</h3>
                                <div className="flex items-end gap-2 mt-3">
                                    <span className="text-5xl font-extrabold text-blue-600">$5</span>
                                    <span className="text-gray-500 dark:text-gray-400 mb-2">one-time</span>
                                </div>
                                <div className="mt-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg inline-flex items-center gap-2">
                                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300">10 builds · just $0.50 each</span>
                                    <span className="text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">50% off</span>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Pay once, use whenever. Perfect for active job hunters targeting multiple roles across different industries simultaneously.</p>
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {[
                                    { text: '10 AI-tailored resume builds', included: true },
                                    { text: 'Industry & tone tailoring engine', included: true },
                                    { text: 'ATS score & 1-click regeneration', included: true },
                                    { text: 'Beautiful PDF with clickable hyperlinks', included: true },
                                    { text: 'Gini Guide — Top 3 personalised role picks', included: true },
                                    { text: 'Credits never expire — use at your pace', included: true },
                                    { text: 'GINI Chat AI career coach', included: false },
                                    { text: 'Hyper-personalised job search & Learning Hub', included: false },
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        {item.included ? <Check className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" /> : <X className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />}
                                        <span className={`text-sm ${item.included ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-400 dark:text-gray-500 line-through'}`}>{item.text}</span>
                                    </li>
                                ))}
                            </ul>

                            <button onClick={() => handleLogin('google')} className="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 transition-all duration-200">
                                Get 10 Builds — Pay Just $5
                            </button>
                        </div>

                        {/* Premium Plan */}
                        <div className="relative flex flex-col p-8 rounded-3xl border-2 border-purple-500 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 dark:bg-slate-800 shadow-lg hover:shadow-purple-500/20 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/40">
                                    <Star className="w-3.5 h-3.5" /> Full Power
                                </span>
                            </div>
                            <div className="mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center mb-4">
                                    <Compass className="w-6 h-6 text-purple-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Premium</h3>
                                <div className="flex items-end gap-2 mt-3">
                                    <span className="text-5xl font-extrabold text-purple-600">$25</span>
                                    <span className="text-gray-500 dark:text-gray-400 mb-2">one-time</span>
                                </div>
                                <div className="mt-3 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg inline-flex items-center gap-2">
                                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300">100 builds · just $0.25 each</span>
                                    <span className="text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">75% off</span>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">The complete career acceleration engine — every AI tool unlocked. Pay once, use for as long as your career journey demands.</p>
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {[
                                    { text: '100 AI-tailored resume builds', included: true },
                                    { text: 'Industry & tone tailoring engine', included: true },
                                    { text: 'ATS score & unlimited regeneration', included: true },
                                    { text: 'Beautiful PDF with clickable hyperlinks', included: true },
                                    { text: 'Full Gini Guide suite — personalised career roadmap', included: true },
                                    { text: 'Hyper-personalised global job search', included: true },
                                    { text: 'Learning Hub — close skill gaps with curated courses', included: true },
                                    { text: 'GINI Chat — unlimited AI career coach sessions', included: true },
                                    { text: 'Credits never expire — use at your pace', included: true },
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <Check className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{item.text}</span>
                                    </li>
                                ))}
                            </ul>

                            <button onClick={() => handleLogin('google')} className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:-translate-y-0.5 transition-all duration-200">
                                Unlock Everything — Pay Just $25
                            </button>
                        </div>

                    </div>

                    {/* Pay-as-you-go callout */}
                    <div className="mt-12 p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-center max-w-2xl mx-auto">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-2 flex-wrap">
                            <Zap className="w-4 h-4 flex-shrink-0" />
                            <span>Prefer to pay as you go? Each additional resume build is just <strong className="text-amber-900 dark:text-amber-200">$1</strong> — charged only when you use it. No commitment required.</span>
                        </p>
                    </div>

                    {/* Global trust note */}
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                        <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-500" /> No credit card to start</span>
                        <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-blue-500" /> Available worldwide — 150+ countries</span>
                        <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500" /> Credits never expire</span>
                    </p>
                </div>
            </div>

            {/* --- FAQ Section --- */}
            <div className="py-20 bg-gray-50 dark:bg-slate-800/50 border-y border-gray-100 dark:border-gray-800">
                <div className="max-w-3xl mx-auto px-6">
                    <h2 className="text-3xl font-extrabold text-center mb-12">Frequently Asked Questions</h2>
                    {([
                        {
                            q: 'Can I really build a resume for free?',
                            a: 'Absolutely. The Free plan gives you one complete AI-tailored resume build — from uploading your profile to downloading a beautiful PDF with hyperlinks — at zero cost and no credit card required. It\'s a full end-to-end experience, not a teaser.'
                        },
                        {
                            q: 'What does "one-time" mean? Is there a subscription?',
                            a: 'There is no subscription, no monthly charge, and no auto-renewal. You pay once for a bundle of resume build credits. Those credits never expire. Use them today, next month, or next year — whenever your career journey demands it.'
                        },
                        {
                            q: 'How much does each build actually cost me?',
                            a: 'Free: $0 for your first build. Basic ($5): each of your 10 builds costs just $0.50 — 50% off. Premium ($25): each of your 100 builds costs just $0.25 — 75% off the standard $1 rate. If you ever run out of credits, just top up at $1 per build, no plan required.'
                        },
                        {
                            q: 'What makes the Industry-Specific Tailoring different?',
                            a: 'When you choose a target industry (e.g., Finance/Banking vs. Healthcare/MedTech), the AI restructures vocabulary, metrics, and emphasis to match what hiring managers and ATS systems in that sector specifically look for — not just keyword stuffing.'
                        },
                        {
                            q: 'What is the ATS Score and why does it matter?',
                            a: 'Over 98% of Fortune 500 companies use Applicant Tracking Systems that auto-reject resumes before a human ever reads them. Our ATS score shows you how well your tailored resume matches the job description. If it\'s low, hit Regenerate and watch it improve in seconds.'
                        },
                        {
                            q: 'Can I upgrade or downgrade my plan anytime?',
                            a: 'Yes — no long-term contracts, no lock-ins. Upgrade when your job search heats up, downgrade when you land the role. It\'s your career, your pace.'
                        },
                        {
                            q: 'What is GINI Chat? Is it like ChatGPT?',
                            a: 'GINI Chat is an AI career coach that has read your entire resume, work history, and goals. Unlike generic chatbots, it gives you hyper-contextual advice: specific cover letter paragraphs, salary negotiation scripts, and skills you should add for your target role.'
                        },
                    ] as { q: string, a: string }[]).map((item, i) => (
                        <div key={i} className="border-b border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                className="w-full py-5 flex items-center justify-between text-left gap-4 group"
                            >
                                <span className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.q}</span>
                                {openFaq === i ? <ChevronUp className="w-5 h-5 text-blue-500 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                            </button>
                            {openFaq === i && (
                                <p className="pb-5 text-gray-600 dark:text-gray-400 leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200">{item.a}</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900">
                {/* Top footer row: product nav */}
                <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-500" />
                        <span className="font-bold text-lg text-gray-900 dark:text-white">CareerGini</span>
                        <span className="text-gray-400 dark:text-gray-600 text-xs ml-1">by DATAi2i</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                        <a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</a>
                        <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Contact</a>
                    </div>

                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        By signing in, you agree to our{' '}
                        <a href="#" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">Terms</a>
                        {' & '}
                        <a href="#" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</a>.
                    </div>
                </div>

                {/* Bottom footer row: DATAi2i brand + copyright */}
                <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-slate-950">
                    <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <img src="/datai2i-logo.png" alt="DATAi2i Private Limited" className="h-7 w-auto mix-blend-multiply dark:mix-blend-normal opacity-80" />
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">DATAi2i Private Limited</span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                            © {new Date().getFullYear()} DATAi2i Private Limited. All rights reserved. CareerGini is a product of DATAi2i Private Limited.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};
