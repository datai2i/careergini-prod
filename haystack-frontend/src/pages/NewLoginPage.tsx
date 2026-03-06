import React, { useEffect, useState } from 'react';
import { Sparkles, BrainCircuit, Target, MessageSquare, Star, ShieldCheck, Zap, Check, X, Globe, BookOpen, TrendingUp, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export const NewLoginPage: React.FC = () => {
    const AUTH_URL = `/api/profile/auth`;
    const { isAuthenticated, loading } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [activeFeature, setActiveFeature] = useState(0);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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
    if (isAuthenticated) return <Navigate to="/" replace />;

    const handleLogin = () => { window.location.href = `${AUTH_URL}/google?source=haystack`; };

    // 6 unique CareerGini features, properly named from the codebase
    const features = [
        {
            icon: <BrainCircuit className="w-6 h-6" />,
            name: "AI Resume Builder",
            badge: "Core",
            badgeColor: "bg-blue-100 text-blue-700",
            iconBg: "bg-blue-500",
            headline: "Hyper-Personalized Résumés in Under 5 Minutes",
            body: "Upload your existing CV or draft from scratch. Our 5-step AI flow parses your full history, lets you pick a professional template, and tailors every bullet point to your target job description — producing an ATS-ready PDF automatically.",
            highlights: ["5-step guided AI flow", "Multiple professional templates", "Industry-specific tailoring", "ATS-optimized PDF download"]
        },
        {
            icon: <MessageSquare className="w-6 h-6" />,
            name: "Gini Chat",
            badge: "Premium",
            badgeColor: "bg-purple-100 text-purple-700",
            iconBg: "bg-purple-500",
            headline: "Your Personal AI Career Mentor — Always On",
            body: "Gini Chat is not a generic chatbot. It reads your complete resume, work history, and career goals before your first message. Ask for salary negotiation scripts specific to your role, interview prep based on your actual experience, or a cover letter that references your projects by name.",
            highlights: ["Knows your full career history", "Streaming real-time responses", "Interview prep & salary coaching", "Tailored cover letter writing"]
        },
        {
            icon: <Target className="w-6 h-6" />,
            name: "Gini Guide",
            badge: "Premium",
            badgeColor: "bg-indigo-100 text-indigo-700",
            iconBg: "bg-indigo-500",
            headline: "Proactive Career Nudges — Gini Guides You",
            body: "Gini Guide is your proactive advisor. It monitors your job search activity and sends smart, priority-ranked nudges: 'Follow up on your Google application', 'Your Amazon interview is in 2 days — practice now', or 'Docker is a critical skill gap for your target role'. It keeps your momentum going automatically.",
            highlights: ["Priority-ranked smart nudges", "Interview & application reminders", "Skill gap alerts", "Networking & follow-up prompts"]
        },
        {
            icon: <Globe className="w-6 h-6" />,
            name: "Global Job Matching",
            badge: "Premium",
            badgeColor: "bg-emerald-100 text-emerald-700",
            iconBg: "bg-emerald-500",
            headline: "Closest Remote Jobs — Matched to Your Profile",
            body: "Gini reads your resume profile and immediately surfaces the closest-matching remote and local jobs across 150+ countries. Your skills, title, and location are automatically used to find you roles before you even search. India-based users get remote-first results automatically.",
            highlights: ["Profile-based automatic matching", "Remote-first for global users", "Keyword chip filters", "150+ countries coverage"]
        },
        {
            icon: <BookOpen className="w-6 h-6" />,
            name: "Smart Learning Hub",
            badge: "Premium",
            badgeColor: "bg-amber-100 text-amber-700",
            iconBg: "bg-amber-500",
            headline: "Gini Designs Your Tailored Learning Plan",
            body: "The Learning Hub is not just a course list — Gini maps your skill gaps against the job market and automatically surfaces the most relevant YouTube videos, Coursera, and edX courses. It tracks your progress in real time, picks up right where you left off, and updates your skill roadmap as your goals evolve.",
            highlights: ["Gap-Based course recommendations", "YouTube, Coursera & edX integrated", "Real-time progress tracking", "Resume-aware curation"]
        },
        {
            icon: <TrendingUp className="w-6 h-6" />,
            name: "ATS Scoring & Gap Analysis",
            badge: "Core",
            badgeColor: "bg-pink-100 text-pink-700",
            iconBg: "bg-pink-500",
            headline: "Beat the Bots Before a Human Sees Your Name",
            body: "CareerGini calculates a live ATS match score between your resume and any job description. Below the threshold? Gini pinpoints exactly what's missing — skills, keywords, certifications — and lets you regenerate until you pass with a single click.",
            highlights: ["Live ATS match scoring", "Keyword gap identification", "1-click ATS regeneration", "Certification & skill gap hints"]
        },
    ];

    const stats = [
        { value: '98%', label: 'Fortune 500s use ATS', sub: 'Beat the bots, guaranteed.' },
        { value: '3×', label: 'More interview callbacks', sub: 'vs. untailored resumes.' },
        { value: '< 5m', label: 'To a polished ATS PDF', sub: 'From upload to complete.' },
        { value: '6', label: 'Unique AI-powered tools', sub: 'All in one $0 login.' }
    ];

    const reviews = [
        { name: "Sarah Jenkins", role: "Senior Product Designer", content: "I applied for 12 roles. 9 got back to me within 48 hours. The ATS score feature changed everything — I knew my resume would be seen before a human even touched it.", rating: 5 },
        { name: "David Chen", role: "Full-Stack Software Engineer", content: "Gini Chat is unlike any chatbot I've used. It read my entire work history and gave me specific talking points for my salary negotiation. I got $18k more than the initial offer.", rating: 5 },
        { name: "Adesola Okafor", role: "Healthcare Project Manager", content: "Within 10 minutes of uploading my old CV, I had a professionally formatted, industry-tailored resume ready. Gini Guide reminded me to follow up exactly when I needed to.", rating: 5 }
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-sans selection:bg-blue-500/30 overflow-x-hidden">

            {/* --- Sticky Navbar --- */}
            <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 py-3 shadow-sm' : 'bg-transparent py-5'}`}>
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
                    {/* Dual Logo */}
                    <div className="flex items-center gap-4">
                        <img src="/logo.png" alt="CareerGini" className="h-10 md:h-12 w-auto mix-blend-multiply dark:mix-blend-normal" />
                        <span className="hidden sm:flex items-center gap-2 border-l border-gray-300 dark:border-gray-700 pl-4">
                            <span className="text-xs font-semibold text-gray-400 tracking-wide">by</span>
                            <img src="/datai2i-logo.png" alt="DATAi2i" className="h-6 w-auto opacity-80 mix-blend-multiply dark:mix-blend-normal" />
                        </span>
                    </div>

                    {/* Nav links */}
                    <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-600 dark:text-gray-300">
                        <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a>
                        <a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</a>
                        <a href="#faq" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">FAQ</a>
                    </div>

                    {/* CTA */}
                    <button onClick={handleLogin} className="flex items-center gap-2.5 px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-4 h-4 bg-white rounded-full p-[1px]" alt="G" />
                        Sign In
                    </button>
                </div>
            </nav>

            {/* --- Hero --- */}
            <div className="relative overflow-hidden pt-32 pb-24 lg:pt-48 lg:pb-36">
                {/* Animated Background Orbs */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/20 dark:bg-blue-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] animate-blob"></div>
                    <div className="absolute top-20 -right-20 w-[500px] h-[500px] bg-purple-500/20 dark:bg-purple-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000"></div>
                    <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-indigo-500/20 dark:bg-indigo-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] animate-blob animation-delay-4000"></div>
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
                </div>

                <div className="relative max-w-7xl mx-auto px-6 z-10 grid lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-8 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 font-semibold text-sm border border-gray-200 dark:border-gray-700 shadow-sm">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            6 AI Career Tools — One Platform
                        </div>

                        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
                            Your Complete<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400">AI Career Engine.</span>
                        </h1>

                        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                            From a hyper-tailored ATS résumé to Gini Chat mentorship, smart job matching, and a personalized learning plan — CareerGini handles your entire job search under one roof, powered by 100% AI automation.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                            <button onClick={handleLogin} className="w-full sm:w-auto px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-all flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl hover:-translate-y-1">
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="G" />
                                Start Free with Google
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-5 text-sm font-semibold text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-500" /> No card ever</span>
                            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-blue-500" /> 1 full free build</span>
                            <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-indigo-500" /> 150+ countries</span>
                        </div>
                    </div>

                    {/* Right: Feature preview card */}
                    <div className="hidden lg:block relative">
                        <div className="w-full rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700 shadow-2xl overflow-hidden">
                            {/* Tab bar */}
                            <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
                                {['Resume AI', 'Gini Chat', 'Jobs', 'Learning'].map((tab, i) => (
                                    <button key={i} onClick={() => setActiveFeature(i)} className={`flex-1 py-3 text-xs font-bold whitespace-nowrap transition-colors ${activeFeature === i ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                        {tab}
                                    </button>
                                ))}
                            </div>
                            {/* Content panels */}
                            <div className="p-6 min-h-[280px]">
                                {activeFeature === 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">AI Resume Builder — 5-Step Journey</h3>
                                            <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">ATS: 94%</span>
                                        </div>
                                        {/* Step 1: 3 entry options */}
                                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0">1</span>
                                                <span className="text-xs font-bold text-blue-800 dark:text-blue-300">Upload</span>
                                            </div>
                                            <div className="flex gap-2 ml-8">
                                                {['📄 Upload CV', '✏️ Draft Manually', '⚡ Fast Track'].map((opt, j) => (
                                                    <span key={j} className="text-[10px] font-semibold px-2 py-1 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-700">{opt}</span>
                                                ))}
                                            </div>
                                        </div>
                                        {[{ label: 'Review', note: 'Edit & confirm your AI-parsed profile' }, { label: 'Style & Tailor', note: 'Choose template + paste job description' }, { label: 'Finalise', note: 'Review AI-tailored content, ATS score' }, { label: 'Done', note: 'Download PDF + Cover Letter' }].map(({ label, note }, idx) => (
                                            <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium ${idx < 2 ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300' : 'bg-gray-50 dark:bg-gray-800/50 text-gray-400'}`}>
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${idx < 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-500'}`}>{idx + 2}</span>
                                                <div>
                                                    <p className="text-xs font-bold leading-none">{label}</p>
                                                    <p className="text-[10px] mt-0.5 opacity-70">{note}</p>
                                                </div>
                                                {idx < 2 && <Check className="w-3.5 h-3.5 ml-auto text-blue-500 flex-shrink-0" />}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {activeFeature === 1 && (
                                    <div className="space-y-3">
                                        <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-4">Gini Chat — Your AI Mentor</h3>
                                        <div className="flex gap-3">
                                            <div className="w-7 h-7 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">U</div>
                                            <div className="bg-blue-600 text-white text-xs rounded-xl rounded-tl-none p-3 max-w-[80%] font-medium">"How do I negotiate salary based on my 6 years of Python experience?"</div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="w-7 h-7 rounded-full bg-purple-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">G</div>
                                            <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-xs rounded-xl rounded-tl-none p-3 font-medium leading-relaxed">Based on your 6 years as a Senior Python Developer and your AWS + ML stack, market data puts you in the $145K–$175K band for Staff roles at FAANG. Here's a 3-step script to anchor high...</div>
                                        </div>
                                    </div>
                                )}
                                {activeFeature === 2 && (
                                    <div className="space-y-3">
                                        <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-4">AI Job Matching — Closest Remote Roles</h3>
                                        {[
                                            { title: 'Senior ML Engineer', company: 'Stripe (Remote)', match: '96%', color: 'text-green-600' },
                                            { title: 'Full Stack Architect', company: 'Notion (Remote)', match: '91%', color: 'text-green-600' },
                                            { title: 'Platform Engineer', company: 'Atlassian (Remote)', match: '87%', color: 'text-amber-500' }
                                        ].map((job, i) => (
                                            <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                                <div className="w-8 h-8 rounded bg-slate-200 dark:bg-slate-700 flex-shrink-0"></div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{job.title}</p>
                                                    <p className="text-xs text-gray-500">{job.company}</p>
                                                </div>
                                                <span className={`text-sm font-black ${job.color}`}>{job.match}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {activeFeature === 3 && (
                                    <div className="space-y-3">
                                        <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-4">Learning Hub — Gini's Recommended Plan</h3>
                                        {[
                                            { title: 'AWS Solutions Architect', platform: 'Coursera', progress: 65, level: 'Intermediate' },
                                            { title: 'System Design Interviews', platform: 'YouTube', progress: 30, level: 'Advanced' },
                                            { title: 'Docker & Kubernetes', platform: 'edX', progress: 0, level: 'Beginner' },
                                        ].map((c, i) => (
                                            <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                                <div className="flex justify-between mb-1">
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white">{c.title}</p>
                                                    <span className="text-xs text-gray-400">{c.platform}</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${c.progress}%` }}></div>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-1">{c.progress}% complete</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Stats Bar --- */}
            <div className="border-y border-gray-200/60 dark:border-gray-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    {stats.map((s, i) => (
                        <div key={i} className="space-y-1">
                            <p className="text-4xl lg:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">{s.value}</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{s.label}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{s.sub}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- Features Deep Dive --- */}
            <div id="features" className="py-24 bg-white dark:bg-slate-900">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 mb-4">What CareerGini Does</span>
                        <h2 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">9 AI Tools. One Mission: <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Get You Hired.</span></h2>
                        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Built from the ground up around hyper-personalization. Every tool knows who you are and what you want before you open it.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feat, idx) => (
                            <div key={idx} className="group p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                                <div className="flex items-start justify-between mb-5">
                                    <div className={`w-12 h-12 rounded-xl ${feat.iconBg} text-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform`}>
                                        {feat.icon}
                                    </div>
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${feat.badgeColor}`}>{feat.badge}</span>
                                </div>
                                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">{feat.name}</h3>
                                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">{feat.headline}</p>
                                <ul className="space-y-2 mt-auto">
                                    {feat.highlights.map((h, j) => (
                                        <li key={j} className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                                            <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /> {h}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- Reviews --- */}
            <div className="py-24 bg-slate-50 dark:bg-slate-800/30 border-y border-slate-100 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">Real People. Real Offers. Real Money.</h2>
                        <p className="text-lg text-gray-500 dark:text-gray-400">Professionals from 150+ countries trust CareerGini to run their job search.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {reviews.map((r, i) => (
                            <div key={i} className="p-8 rounded-2xl bg-white dark:bg-slate-800 shadow border border-gray-100 dark:border-gray-700 flex flex-col">
                                <div className="flex gap-1 mb-5">{[...Array(r.rating)].map((_, j) => <Star key={j} className="w-5 h-5 fill-yellow-400 text-yellow-400" />)}</div>
                                <p className="text-gray-700 dark:text-gray-300 italic mb-8 flex-1">"{r.content}"</p>
                                <div className="flex items-center gap-3 mt-auto pt-5 border-t border-gray-100 dark:border-gray-700">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-black text-sm">{r.name.charAt(0)}</div>
                                    <div>
                                        <p className="font-bold text-sm text-gray-900 dark:text-white">{r.name}</p>
                                        <p className="text-xs text-gray-500">{r.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- Pricing --- */}
            <div id="pricing" className="py-24 bg-white dark:bg-slate-900">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-extrabold mb-4 tracking-tight">Clear Pricing.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Your Credits Never Expire.</span></h2>
                        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Start free — the full experience, not a teaser. Pay once for credits that last forever. No lock-in, no subscription, no risk.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
                        {/* Free */}
                        <div className="flex flex-col p-8 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg transition-all">
                            <h3 className="text-2xl font-bold mb-2">Free Proof</h3>
                            <div className="flex items-baseline gap-1 mb-6"><span className="text-5xl font-black">$0</span><span className="text-gray-400 font-medium">forever</span></div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">1 complete AI resume build from upload to PDF download — at zero cost forever, no card required.</p>
                            <ul className="space-y-3 mb-8 flex-1 text-sm">
                                {['1 AI-tailored resume build', 'ATS job scoring', 'PDF download', 'Gini Resume Parser', 'Gini Guide (basic nudges)'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /><span className="text-gray-700 dark:text-gray-300 font-medium">{item}</span></li>
                                ))}
                                {['Gini Chat mentor', 'Global Job Matching', 'Learning Hub'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3"><X className="w-4 h-4 text-gray-300 flex-shrink-0" /><span className="text-gray-400 line-through text-xs">{item}</span></li>
                                ))}
                            </ul>
                            <button onClick={handleLogin} className="w-full py-3.5 rounded-xl border-2 border-gray-900 dark:border-white text-gray-900 dark:text-white font-bold hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-gray-900 transition-colors">Start Free</button>
                        </div>
                        {/* Starter */}
                        <div className="relative flex flex-col p-8 rounded-2xl border-2 border-blue-500 bg-white dark:bg-slate-800 shadow-xl shadow-blue-500/10 md:-translate-y-4 md:h-[calc(100%+2rem)]">
                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                                <span className="px-4 py-1 rounded-full text-xs font-black bg-blue-600 text-white shadow-md uppercase tracking-wider">Most Popular</span>
                            </div>
                            <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">Starter</h3>
                            <div className="flex items-baseline gap-1 mb-6"><span className="text-5xl font-black">$5</span><span className="text-gray-400 font-medium">one-time</span></div>
                            <p className="text-sm text-blue-700 dark:text-blue-200 mb-8 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl font-medium">5 AI builds at $1.00 each. Credits never expire. Unlock covers, industry tailoring, and job matching.</p>
                            <ul className="space-y-3 mb-8 flex-1 text-sm">
                                {['5 AI-tailored resume builds', 'Industry-specific tailoring', 'ATS + 1-click regeneration', 'Cover letter generation', 'Global Job Matching', 'Credits never expire'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3"><Check className="w-4 h-4 text-blue-500 flex-shrink-0" /><span className="text-gray-700 dark:text-gray-300 font-medium">{item}</span></li>
                                ))}
                                {['Gini Chat AI mentor', 'Learning Hub'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3"><X className="w-4 h-4 text-blue-300/50 flex-shrink-0" /><span className="text-gray-400 line-through text-xs">{item}</span></li>
                                ))}
                            </ul>
                            <button onClick={handleLogin} className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg transition-colors">Get 5 Builds →</button>
                        </div>
                        {/* Premium */}
                        <div className="flex flex-col p-8 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800/80 shadow-sm hover:shadow-lg transition-all">
                            <div className="absolute hidden"><span className="px-4 py-1 rounded-full text-xs font-black bg-purple-600 text-white shadow-md">Full Power</span></div>
                            <h3 className="text-2xl font-bold mb-2">Premium Unlocked</h3>
                            <div className="flex items-baseline gap-1 mb-6"><span className="text-5xl font-black">$20</span><span className="text-gray-400 font-medium">one-time</span></div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-8 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 font-medium">20 builds + Gini Chat mentor + Learning Hub + Career Roadmap. The complete engine. All unlocked.</p>
                            <ul className="space-y-3 mb-8 flex-1 text-sm">
                                {['20 AI-tailored builds', 'Gini Chat mentor (unlimited)', 'Smart Learning Hub', 'Career Roadmap', 'Interview Practice', 'Gini Guide (full nudges)', 'Global Job Matching', 'Credits never expire'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3"><Check className="w-4 h-4 text-purple-500 flex-shrink-0" /><span className="text-gray-700 dark:text-gray-300 font-medium">{item}</span></li>
                                ))}
                            </ul>
                            <button onClick={handleLogin} className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">Unlock Everything</button>
                        </div>
                    </div>

                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2">
                        <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-500" /> No card to start</span>
                        <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-blue-500" /> 150+ countries</span>
                        <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500" /> Credits never expire</span>
                    </p>
                </div>
            </div>

            {/* --- FAQ --- */}
            <div id="faq" className="py-20 bg-slate-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-gray-800">
                <div className="max-w-3xl mx-auto px-6">
                    <h2 className="text-3xl font-extrabold text-center mb-12 tracking-tight">Frequently Asked Questions</h2>
                    {([
                        { q: "What is a 'Resume Build' credit?", a: "One credit = one complete AI tailoring session. Your resume is rewritten to match a specific job description, and the result is a ready-to-download, ATS-optimized PDF. You only consume a credit when you finalize and download." },
                        { q: "How is Gini Chat different from ChatGPT?", a: "Gini Chat has already read your full resume, your skills, your work history, and your job goals before you type your first message. So instead of generic advice, you get answers like: 'Based on your 6 years in AWS and your experience at Infosys, here's how to negotiate...' — impossible with ChatGPT." },
                        { q: "What is Gini Guide?", a: "Gini Guide is your proactive career advisor. It monitors your search status and sends smart nudges — reminding you to follow up on applications, practice before interviews, or fix skill gaps for a target role. Think of it as a career coach that watches your back 24/7." },
                        { q: "Do my credits expire?", a: "Never. Whether you buy Starter or Premium, the credits you purchase remain in your account indefinitely. Use them today, next month, or next year — your timeline, your pace." },
                        { q: "What makes the Learning Hub different?", a: "Gini reads your ATS gap analysis and career goals, then curates a learning plan from YouTube, Coursera, and edX — not a generic list, but resources specifically matched to your missing skills. It tracks your watch progress in real time and updates recommendations as you grow." },
                    ] as { q: string, a: string }[]).map((item, i) => (
                        <div key={i} className="border-b border-gray-200 dark:border-gray-700">
                            <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full py-5 flex items-center justify-between text-left gap-4 group">
                                <span className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.q}</span>
                                {openFaq === i ? <ChevronUp className="w-5 h-5 text-blue-500 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                            </button>
                            {openFaq === i && <p className="pb-5 text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{item.a}</p>}
                        </div>
                    ))}
                </div>
            </div>

            {/* --- Bottom CTA --- */}
            <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 py-24 text-center overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px]"></div>
                <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-600/20 rounded-full filter blur-[80px]"></div>
                <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-600/20 rounded-full filter blur-[80px]"></div>
                <div className="max-w-3xl mx-auto px-6 relative z-10">
                    <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">9 AI Tools.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Start for $0 Today.</span></h2>
                    <p className="text-gray-300 text-xl mb-10 font-medium">Join thousands of job seekers who stopped applying into the void and started landing real interviews.</p>
                    <button onClick={handleLogin} className="px-10 py-5 bg-white text-gray-900 rounded-xl font-bold text-lg hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 w-full sm:w-auto mx-auto shadow-xl">
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6 bg-white rounded-full p-0.5" alt="G" />
                        Sign In Free with Google
                    </button>
                    <p className="text-sm text-gray-400 mt-5">No credit card. No trial period. The full product, free.</p>
                </div>
            </div>

            {/* --- Footer --- */}
            <footer className="bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <img src="/logo.png" alt="CareerGini" className="h-8 w-auto mix-blend-multiply dark:mix-blend-normal" />
                        <span className="border-l border-gray-200 dark:border-gray-700 pl-4 flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-400">by</span>
                            <img src="/datai2i-logo.png" alt="DATAi2i" className="h-5 w-auto opacity-70 mix-blend-multiply dark:mix-blend-normal" />
                        </span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                        <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
                        <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
                        <a href="#faq" className="hover:text-blue-600 transition-colors">FAQ</a>
                        <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
                        <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
                    </div>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-slate-950">
                    <div className="max-w-7xl mx-auto px-6 py-5 text-center">
                        <p className="text-xs text-gray-400">© {new Date().getFullYear()} DATAi2i Private Limited. All rights reserved. CareerGini is a product of DATAi2i Private Limited.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};
