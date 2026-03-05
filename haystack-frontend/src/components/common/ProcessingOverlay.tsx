import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Newspaper, TrendingUp, Sparkles, ExternalLink, RefreshCw } from 'lucide-react';

interface NewsItem {
    title: string;
    description: string;
    link: string;
    source_id?: string;
}

interface ProcessingOverlayProps {
    isOpen: boolean;
    message?: string;
    headline?: string;
    skills?: string[];
}

// ── Large, diverse fallback pool — shuffled on every mount ───────────────────
// Covers: AI tools, career tips, hiring trends, productivity, tech news
const FALLBACK_POOL: NewsItem[] = [
    { title: "GPT-4o beats humans at most standard benchmarks", description: "OpenAI's latest model scores above 85th percentile on professional bar, medical licensing, and coding tasks.", link: "https://openai.com/index/hello-gpt-4o/", source_id: "OpenAI" },
    { title: "75% of Fortune 500 now screen resumes with AI", description: "ATS tools powered by LLMs reject up to 70% of applicants before a human ever sees the file.", link: "https://techcrunch.com/category/artificial-intelligence/", source_id: "TechCrunch" },
    { title: "Prompt engineering is the #1 rising skill on LinkedIn", description: "Knowledge of LLM prompt design has grown 600% YoY in LinkedIn's latest skills report.", link: "https://www.linkedin.com/pulse/topics/engineering/", source_id: "LinkedIn" },
    { title: "Recruiters spend just 7.4 seconds scanning a resume", description: "Eye-tracking studies show recruiters scan name, title, company, and 2 most recent roles before deciding.", link: "https://www.businessinsider.com/", source_id: "Business Insider" },
    { title: "Google DeepMind launches Gemini 1.5 Pro with 1M context window", description: "The new model can process entire codebases, legal documents, or a full book in a single prompt call.", link: "https://blog.google/technology/ai/", source_id: "Google Blog" },
    { title: "Remote first roles now demand 20% more pay than on-site", description: "Global salary survey data shows distributed-work candidates command a premium due to proven async productivity.", link: "https://weworkremotely.com/", source_id: "We Work Remotely" },
    { title: "Microsoft Copilot integrates into Word, Outlook, and Teams", description: "AI-assisted drafting and summarisation is now embedded inside the tools 1.4 billion workers use daily.", link: "https://www.microsoft.com/en-us/microsoft-copilot/", source_id: "Microsoft" },
    { title: "Top 10 most in-demand skills of 2025 — World Economic Forum", description: "Critical thinking, AI literacy, resilience, and curiosity make the WEF's updated Future of Jobs top 10.", link: "https://www.weforum.org/agenda/archive/future-of-work/", source_id: "WEF" },
    { title: "Anthropic Claude 3 Opus outperforms GPT-4 on reasoning tasks", description: "Independent benchmarks show Claude 3 leading on legal and scientific reasoning categories.", link: "https://www.anthropic.com/news/", source_id: "Anthropic" },
    { title: "Stack Overflow Dev Survey: Rust most loved language 9 years running", description: "TypeScript, Python, and Rust dominate the 2024 developer survey leaderboard for job satisfaction.", link: "https://survey.stackoverflow.co/2024/", source_id: "Stack Overflow" },
    { title: "Hugging Face surpasses 1 million open-source AI models", description: "The AI model hub milestone reflects the exponential growth of open-weight models post-Llama 2.", link: "https://huggingface.co/blog", source_id: "Hugging Face" },
    { title: "The 'quantum-ready' résumé is now a real concept", description: "Companies in defence, pharma, and finance are actively recruiting for quantum algorithm and error-correction skills.", link: "https://spectrum.ieee.org/quantum-computing", source_id: "IEEE Spectrum" },
    { title: "AI agents are replacing junior analyst roles, says McKinsey", description: "A new McKinsey Global Institute report estimates 30% of knowledge-work tasks automatable by 2026.", link: "https://www.mckinsey.com/featured-insights/future-of-work", source_id: "McKinsey" },
    { title: "How to beat a STAR interview with data-driven storytelling", description: "Candidates who quantify achievements in STAR answers are 3x more likely to progress to next rounds.", link: "https://hbr.org/topic/subject/careers", source_id: "HBR" },
    { title: "Ollama now runs Llama 3 locally on Apple Silicon in < 2 seconds", description: "M3 Pro MacBooks can run 8B-parameter models fully offline with sub-2s cold start times.", link: "https://ollama.com/blog", source_id: "Ollama" },
    { title: "The hidden cost of a generic resume: 89% rejection rate", description: "Analysis of 10,000 applications shows un-tailored resumes have an 11% callback rate vs. 43% for tailored ones.", link: "https://resumelab.com/career-advice/", source_id: "ResumeLab" },
    { title: "Vercel AI SDK 3.0 brings streaming React Server Components", description: "The new SDK makes streaming LLM responses into a Next.js app a sub-10-line implementation.", link: "https://vercel.com/blog", source_id: "Vercel" },
    { title: "Cover letters read with AI sentiment analysis by 60% of ATS tools", description: "Sentiment classifiers score emotional authenticity, keyword density, and passive vs. active voice in real-time.", link: "https://techcrunch.com/", source_id: "TechCrunch" },
    { title: "AWS launches Bedrock Agent framework for multi-step AI workflows", description: "The managed service lets enterprises chain LLM calls, tool use, and memory without custom orchestration code.", link: "https://aws.amazon.com/bedrock/", source_id: "AWS" },
    { title: "The 2025 hiring season is dominated by AI/ML, product, and security roles", description: "LinkedIn Data reveals 4x growth in GenAI engineering, AI product management, and red-team analyst postings YoY.", link: "https://economicgraph.linkedin.com/", source_id: "LinkedIn Economic Graph" },
    { title: "Tailored resumes score 38 points higher on ATS keyword matching", description: "Independent research from Jobscan shows precise keyword alignment as the single biggest ATS driver.", link: "https://www.jobscan.co/blog/", source_id: "Jobscan" },
    { title: "Meta Llama 3 70B becomes the top open-weight model on LMSYS Chatbot Arena", description: "Community votes rank Llama 3 70B above GPT-3.5 and Mistral on helpfulness and instruction following.", link: "https://ai.meta.com/blog/", source_id: "Meta AI" },
    { title: "The right LinkedIn headline increases recruiter outreach by 3x", description: "A/B tests on developer profiles show keyword-rich, role-specific headlines drive dramatically more InMail contact.", link: "https://www.linkedin.com/pulse/", source_id: "LinkedIn" },
    { title: "Python remains #1 for AI, drops to #3 for general-purpose use", description: "TIOBE Index shows Python dominant in ML/AI codebases while Rust and Go claim systems programming share.", link: "https://www.tiobe.com/tiobe-index/", source_id: "TIOBE" },
    { title: "YC W24 batch: 35% of startups are AI infrastructure plays", description: "Y Combinator's latest cohort shows a shift from AI applications to foundational tooling: databases, evals, and orchestration.", link: "https://www.ycombinator.com/companies/", source_id: "Y Combinator" },
    { title: "GitHub Copilot used by 1.8 million developers, productivity up 55%", description: "GitHub's internal study shows devs using Copilot complete tasks 55% faster than those without AI assistance.", link: "https://github.blog/", source_id: "GitHub Blog" },
    { title: "Job hopping every 2–3 years now maximises salary growth — Glassdoor", description: "Median salary increase for internal promotions: 5.8%. For job changes: 14.8%. The loyalty penalty is real.", link: "https://www.glassdoor.com/research/", source_id: "Glassdoor" },
    { title: "Nvidia's H200 chips are backlogged 18 months — AI boom intensifies", description: "Cloud providers and AI labs are buying compute a year and a half in advance as model training scales.", link: "https://nvidianews.nvidia.com/", source_id: "Nvidia" },
    { title: "2-page resumes outperform 1-page for candidates with 5+ years experience", description: "Recruiters rated 2-page resumes 'more complete' for senior roles in a 500-person hiring manager survey.", link: "https://resumegenius.com/blog", source_id: "ResumeGenius" },
    { title: "The average software engineer applies to 32 jobs before an offer", description: "2024 job market data shows even strong candidates face 3–4 month search windows with 1–3% response rates.", link: "https://levelsfyi.com/blog", source_id: "Levels.fyi" },
];

function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ isOpen, message, headline, skills }) => {
    const [news, setNews] = useState<NewsItem[]>(() => shuffleArray(FALLBACK_POOL).slice(0, 8));
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isLive, setIsLive] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Fetch live news from our backend proxy (no CORS / API key issues)
    const fetchNews = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`/api/news/trending?q=${encodeURIComponent(headline || skills?.slice(0, 3).join(' ') || '')}`);
            const data = await resp.json();
            if (data.status === 'success' && data.results?.length > 0) {
                // Merge live results with a few fallbacks so we always have enough cards
                const merged: NewsItem[] = [
                    ...data.results,
                    ...shuffleArray(FALLBACK_POOL).slice(0, 4)
                ];
                setNews(merged);
                setIsLive(true);
            }
        } catch {
            // Silent - already showing shuffled fallbacks
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        // Reset and shuffle fallbacks immediately so each open shows different cards
        setNews(shuffleArray(FALLBACK_POOL).slice(0, 8));
        setCurrentIndex(0);
        setIsLive(false);
        fetchNews();

        intervalRef.current = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % news.length);
        }, 7000);

        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Keep rotation in sync when news array changes after live fetch
    useEffect(() => {
        if (!isOpen) return;
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % news.length);
        }, 7000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [news.length, isOpen]);

    if (!isOpen) return null;

    const item = news[currentIndex] || news[0];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Blurred Background */}
            <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-xl animate-fadeIn" />

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-dark-card rounded-3xl shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden animate-slideUp">
                <div className="p-8">
                    {/* Header */}
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="relative mb-5">
                            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full animate-pulse" />
                            <div className="relative w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white rotate-3 hover:rotate-0 transition-transform duration-500 shadow-xl">
                                <Sparkles className="w-10 h-10" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-lg shadow-lg">
                                <Loader2 className="w-5 h-5 animate-spin" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                            {message || 'Working AI Magic...'}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium max-w-md text-sm">
                            While your resume is being crafted, catch up on what's trending in AI and careers!
                        </p>
                    </div>

                    {/* News Widget */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-100 dark:border-dark-border relative group overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Newspaper size={52} />
                        </div>

                        {/* Label row */}
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">
                            <TrendingUp size={14} />
                            <span>{isLive ? 'Live Trending' : 'Trending Insights'}</span>
                            {isLive && (
                                <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-1">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                    LIVE
                                </span>
                            )}
                            {loading && (
                                <RefreshCw size={11} className="animate-spin text-gray-400 ml-1" />
                            )}
                            {item.source_id && (
                                <span className="ml-auto text-gray-400 font-medium normal-case tracking-normal">
                                    {item.source_id}
                                </span>
                            )}
                        </div>

                        {/* News card — key forces fade-in on change */}
                        <div key={`${currentIndex}-${item.title}`} className="animate-fadeIn">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 leading-snug line-clamp-2">
                                {item.title}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-5 leading-relaxed text-sm line-clamp-3">
                                {item.description}
                            </p>

                            <div className="flex items-center justify-between">
                                <a
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                                >
                                    Read more <ExternalLink size={13} />
                                </a>

                                {/* Dot pagination */}
                                <div className="flex gap-1 items-center">
                                    {news.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentIndex(i)}
                                            className={`h-1.5 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-8 bg-blue-600' : 'w-2 bg-gray-300 dark:bg-dark-border hover:bg-gray-400'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Manual navigation arrows (mobile-friendly) */}
                    <div className="flex justify-center gap-3 mt-4">
                        <button
                            onClick={() => setCurrentIndex(i => (i - 1 + news.length) % news.length)}
                            className="text-xs text-gray-400 hover:text-gray-600 font-bold px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            ‹ Prev
                        </button>
                        <span className="text-xs text-gray-400 py-1">{currentIndex + 1} / {news.length}</span>
                        <button
                            onClick={() => setCurrentIndex(i => (i + 1) % news.length)}
                            className="text-xs text-gray-400 hover:text-gray-600 font-bold px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            Next ›
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-gray-100 dark:bg-dark-border">
                    <div className="h-full bg-blue-600 animate-loadingBar" />
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes loadingBar { 
                    0%   { width: 0%; } 
                    15%  { width: 25%; } 
                    35%  { width: 47%; } 
                    60%  { width: 68%; } 
                    80%  { width: 84%; } 
                    100% { width: 95%; } 
                }
                .animate-fadeIn   { animation: fadeIn 0.45s ease-out forwards; }
                .animate-slideUp  { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-loadingBar { animation: loadingBar 70s cubic-bezier(0.1, 0, 0.1, 1) forwards; }
                .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
                .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
            `}} />
        </div>
    );
};
