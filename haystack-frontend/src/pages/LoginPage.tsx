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
            title: "Hyper-Personalized Resume Builds",
            description: "Upload your resume or draft from scratch. CareerGini's AI rewrites your bullet points to precisely match any target job description — not just stuffing keywords, but mirroring the employer's exact language and priorities."
        },
        {
            icon: <Target className="w-8 h-8 text-purple-500" />,
            title: "Industry-Specific ATS Tailoring",
            description: "Whether you're applying to a FinTech startup, a Fortune 500 healthcare system, or a creative agency — the AI adapts your vocabulary, metrics and structure to what that industry's ATS and hiring managers specifically look for."
        },
        {
            icon: <Zap className="w-8 h-8 text-amber-500" />,
            title: "ATS Score + 1-Click Regeneration",
            description: "See your live ATS match score the moment your resume is built. If it's not high enough, hit Regenerate and the AI tweaks the entire document instantly. Stop guessing — know you pass the filter before you apply."
        },
        {
            icon: <ShieldCheck className="w-8 h-8 text-green-500" />,
            title: "Cover Letters That Actually Connect",
            description: "Auto-generate a tailored cover letter alongside your resume in seconds. Each one mirrors the job's tone, references the company's specific needs, and sounds authentically like you — not a template."
        },
        {
            icon: <MessageSquare className="w-8 h-8 text-indigo-500" />,
            title: "Gini Chat — Your Personal Career Mentor",
            description: "Chat with an AI coach that has read your entire resume, job history, and skill set. Ask for salary negotiation tactics, career pivot advice, or specific cover letter paragraphs — Gini already knows your story."
        },
        {
            icon: <Star className="w-8 h-8 text-pink-500" />,
            title: "Beautiful PDFs, Full Editing Control",
            description: "Review every AI-generated bullet before finalizing. Edit, approve, and export a professionally formatted PDF with clickable hyperlinks — LinkedIn, portfolio, GitHub — ready for any global job market in seconds."
        }
    ];

    const reviews = [
        {
            name: "Sarah Jenkins",
            role: "Senior Product Designer, EMEA",
            content: "I applied for 12 roles. 9 got back to me within 48 hours. The ATS score feature changed everything — I knew my resume would be seen before a human even touched it.",
            rating: 5
        },
        {
            name: "David Chen",
            role: "Full-Stack Software Engineer",
            content: "Gini Chat is unlike any chatbot I've used. It read my entire work history and gave me specific talking points for my salary negotiation. I got $18k more than the initial offer.",
            rating: 5
        },
        {
            name: "Adesola Okafor",
            role: "Healthcare Project Manager, Lagos",
            content: "I had no updated resume at all. Within 10 minutes of uploading my old CV, I had a professionally formatted, industry-tailored resume ready to go. CareerGini is genuinely magic.",
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
                        <span>Your AI Career Coach — Free to Try. Built to Accelerate.</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight animate-fade-in-up animation-delay-100">
                        Your Résumé. Tailored by AI. <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 animate-gradient-x">
                            Designed to Get You Hired.
                        </span>
                    </h1>

                    <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in-up animation-delay-200">
                        CareerGini reads your profile and the job description — then writes a hyper-personalized, ATS-beating resume in under 5 minutes. <strong>Start completely free. No card needed.</strong>
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-300">
                        <button
                            onClick={() => handleLogin('google')}
                            className="w-full sm:w-auto px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-lg hover:shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
                            <span>Try CareerGini Free →</span>
                        </button>

                        <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 ml-0 sm:ml-4">
                            <ShieldCheck className="w-5 h-5 text-green-500" />
                            <span>1 full resume build included. No credit card, ever.</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Features Section --- */}
            <div className="py-24 bg-white/50 dark:bg-slate-800/50 border-y border-gray-200 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for Job Seekers Who Refuse to Settle</h2>
                        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                            Every feature built around one goal: helping you get more interviews, faster — no matter where you are in the world.
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
                            { value: '98%', label: 'Fortune 500s filter with ATS', sub: 'Gini helps you beat the bots.' },
                            { value: '3x', label: 'More interview callbacks', sub: 'vs. untailored resumes' },
                            { value: '< 5 min', label: 'Upload to polished PDF', sub: 'From raw resume to ATS-ready' },
                            { value: '$0', label: 'To start — forever free', sub: 'No card. No lock-in. No risk.' }
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
                        <h2 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">Pay Once. Use Forever.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Your Credits Never Expire.</span></h2>
                        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                            Start completely free — no card, no trial, no catch. When you're ready to do more, pay once for a bundle of AI resume build credits that <strong>never expire</strong>. Whether you're a fresh grad in Nairobi, a senior engineer in Berlin, or pivoting careers in Toronto — use them at your own pace.
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
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">1 full AI resume build · No card ever</span>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Experience the full power of AI resume tailoring — from uploading to downloading a beautiful, hyperlinked PDF — completely free. Not a preview. The real thing.</p>
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {[
                                    { text: '1 complete AI-tailored resume build', included: true },
                                    { text: 'ATS score & real-time feedback', included: true },
                                    { text: 'Professional PDF with clickable hyperlinks', included: true },
                                    { text: 'Upload resume or draft your profile manually', included: true },
                                    { text: 'Industry-specific tailoring engine', included: false },
                                    { text: 'Cover letter auto-generation', included: false },
                                    { text: 'Gini Chat AI career mentor', included: false },
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        {item.included ? <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" /> : <X className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />}
                                        <span className={`text-sm ${item.included ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 line-through'}`}>{item.text}</span>
                                    </li>
                                ))}
                            </ul>

                            <button onClick={() => handleLogin('google')} className="w-full py-3 px-6 rounded-xl border-2 border-gray-900 dark:border-white text-gray-900 dark:text-white font-bold hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-gray-900 transition-all duration-200">
                                Start Free — No Card Needed
                            </button>
                        </div>

                        {/* Starter Plan */}
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
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Starter</h3>
                                <div className="flex items-end gap-2 mt-3">
                                    <span className="text-5xl font-extrabold text-blue-600">$5</span>
                                    <span className="text-gray-500 dark:text-gray-400 mb-2">one-time</span>
                                </div>
                                <div className="mt-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg inline-flex items-center gap-2">
                                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300">5 builds · just $1.00 each</span>
                                    <span className="text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">Credits Never Expire</span>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">You loved the free build — now go further. Unlock industry-specific tailoring that restructures your resume for the exact sector you're targeting. Cover letters included. Pay once, use at your pace.</p>
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {[
                                    { text: '5 AI-tailored resume builds', included: true },
                                    { text: 'Industry-specific tailoring (Tech, Finance, Healthcare & more)', included: true },
                                    { text: 'ATS score + 1-click regeneration until you pass', included: true },
                                    { text: 'Professional PDF with clickable hyperlinks', included: true },
                                    { text: 'Cover letter auto-generation for every application', included: true },
                                    { text: 'Credits never expire — use whenever you need', included: true },
                                    { text: 'Gini Chat AI career mentor', included: false },
                                    { text: 'Hyper-personalised job search & Learning Hub', included: false },
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        {item.included ? <Check className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" /> : <X className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />}
                                        <span className={`text-sm ${item.included ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-400 dark:text-gray-500 line-through'}`}>{item.text}</span>
                                    </li>
                                ))}
                            </ul>

                            <button onClick={() => handleLogin('google')} className="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 transition-all duration-200">
                                Get 5 Builds for $5 →
                            </button>
                        </div>

                        {/* Premium Plan */}
                        <div className="relative flex flex-col p-8 rounded-3xl border-2 border-purple-500 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 dark:bg-slate-800 shadow-lg hover:shadow-purple-500/20 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/40">
                                    <Star className="w-3.5 h-3.5" /> Full Power Unlocked
                                </span>
                            </div>
                            <div className="mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center mb-4">
                                    <Compass className="w-6 h-6 text-purple-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Premium</h3>
                                <div className="flex items-end gap-2 mt-3">
                                    <span className="text-5xl font-extrabold text-purple-600">$20</span>
                                    <span className="text-gray-500 dark:text-gray-400 mb-2">one-time</span>
                                </div>
                                <div className="mt-3 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg inline-flex items-center gap-2">
                                    <span className="text-xs font-bold text-purple-700 dark:text-blue-300">20 builds · just $1.00 each</span>
                                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-full">Gini Chat Unlocked</span>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">The complete career acceleration engine. Get Gini Chat mentorship that knows your full history, hyper-personalized global job search, and the Learning Hub to keep your skills ahead of the market — all for a single one-time payment.</p>
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {[
                                    { text: '20 AI-tailored resume builds', included: true },
                                    { text: 'Industry-specific tailoring + advanced tone control', included: true },
                                    { text: 'ATS score + unlimited 1-click regeneration', included: true },
                                    { text: 'Professional PDF with clickable hyperlinks', included: true },
                                    { text: 'Gini Chat — unlimited sessions with your personal AI mentor', included: true },
                                    { text: 'Hyper-personalised global job search across 150+ countries', included: true },
                                    { text: 'Learning Hub — curated skills, courses & career roadmap', included: true },
                                    { text: 'Credits never expire — use them at your pace', included: true },
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <Check className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{item.text}</span>
                                    </li>
                                ))}
                            </ul>

                            <button onClick={() => handleLogin('google')} className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:-translate-y-0.5 transition-all duration-200">
                                Unlock Full Power — $20 One-Time
                            </button>
                        </div>

                    </div>

                    {/* Pay-as-you-go callout */}
                    <div className="mt-12 p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-center max-w-2xl mx-auto">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-2 flex-wrap">
                            <Zap className="w-4 h-4 flex-shrink-0" />
                            <span>Already have credits? Top up anytime. Each additional resume build is just <strong className="text-amber-900 dark:text-amber-200">$1</strong> — no subscription, no commitment, no expiry.</span>
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
                            q: 'Can I really build a full resume for free?',
                            a: 'Absolutely. The Free plan gives you one complete AI-tailored resume build — from uploading your profile to downloading a beautiful, hyperlinked PDF — at zero cost and with no credit card required ever. This is not a preview or a teaser; it is the full end-to-end experience.'
                        },
                        {
                            q: 'What does "one-time" mean? Is there a subscription?',
                            a: 'There is no subscription, no monthly charge, and no auto-renewal — ever. You pay once for a bundle of resume build credits. Those credits never expire. Use them today, next month, or next year — whenever your career journey demands it.'
                        },
                        {
                            q: 'How much does each resume build actually cost?',
                            a: 'Free: $0 for your very first full build. Starter ($5): 5 builds at $1.00 each. Premium ($20): 20 builds at $1.00 each, with your full Gini Chat mentor and global job search unlocked. After using your credits, top up at $1 per build — no plan required.'
                        },
                        {
                            q: 'What makes the Industry-Specific Tailoring different from just adding keywords?',
                            a: 'When you choose a target industry (e.g., Finance/Banking vs. Healthcare/MedTech vs. Creative/Design), the AI doesn\'t just add buzzwords. It restructures your entire resume — vocabulary, metrics, bullet order, and emphasis — to match what ATS systems and hiring managers in that specific industry are trained to look for.'
                        },
                        {
                            q: 'What is the ATS Score and why does it matter?',
                            a: 'Over 98% of Fortune 500 companies and a growing number of SMEs use Applicant Tracking Systems that auto-reject resumes before a human ever reads them. Our live ATS score shows how closely your tailored resume matches the target job description. Too low? Hit Regenerate and watch it improve instantly.'
                        },
                        {
                            q: 'What is Gini Chat and what can it actually help me with?',
                            a: 'Gini Chat is your personal AI career mentor — and unlike generic chatbots, it has already read your full resume, job history, skills, and goals before you even say hello. Ask for a tailored cover letter paragraph, salary negotiation scripts, advice on pivoting industries, or which skills to prioritize for your next role. Gini gives specific, contextual answers — not templates.'
                        },
                        {
                            q: 'Can I upgrade or downgrade my plan at any time?',
                            a: 'Yes — no lock-in, no long-term contracts. Upgrade when your job search intensifies, or simply use your existing credits at your own pace. It\'s your career, your timeline.'
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
