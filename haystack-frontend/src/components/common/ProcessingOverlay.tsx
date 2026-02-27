import React, { useState, useEffect } from 'react';
import { Loader2, Newspaper, TrendingUp, Sparkles, ExternalLink } from 'lucide-react';

interface NewsItem {
    title: string;
    description: string;
    link: string;
    source_id?: string;
    pubDate?: string;
}

interface ProcessingOverlayProps {
    isOpen: boolean;
    message?: string;
    headline?: string;
    skills?: string[];
}

const FALLBACK_NEWS: NewsItem[] = [
    {
        title: "AI Resumes are the new standard",
        description: "Over 75% of Fortune 500 companies now use AI to filter candidates. Tailoring is no longer optional.",
        link: "https://techcrunch.com/category/artificial-intelligence/"
    },
    {
        title: "Top Skills for 2025",
        description: "AI literacy, prompt engineering, and soft skills like emotional intelligence are the most in-demand skills this year.",
        link: "https://www.theverge.com/ai-artificial-intelligence"
    },
    {
        title: "The power of 1-page resumes",
        description: "Recruiters spend an average of 6 seconds on a resume. Keep it concise and impactful.",
        link: "https://hub.jhu.edu/at-work/2023/10/24/resume-best-practices/"
    },
    {
        title: "Ollama brings LLMs to your local machine",
        description: "We use Ollama to ensure your resume data remains private and processed locally on our secure servers.",
        link: "https://ollama.com/blog"
    },
    {
        title: "Automated Tailoring saves 90% time",
        description: "Manually tailoring resumes for every job takes hours. Our AI does it in seconds with high precision.",
        link: "https://openai.com/news/"
    }
];

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ isOpen, message, headline, skills }) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (isOpen) {
            fetchNews();
            const interval = setInterval(() => {
                const totalNews = (news && news.length > 0) ? news.length : FALLBACK_NEWS.length;
                setCurrentIndex(prev => (prev + 1) % totalNews);
            }, 8000);
            return () => clearInterval(interval);
        }
    }, [isOpen, news.length, skills]);

    const fetchNews = async () => {
        try {
            // Personalize query based on headline and skills
            const skillQuery = skills && skills.length > 0 ? skills.slice(0, 3).join(' ') : '';
            const query = (headline || skillQuery)
                ? `latest AI tools trends skills ${headline || ''} ${skillQuery}`
                : 'latest generative AI tools career professional skills trends';

            // We'll use a public API key for demonstration or proxy it through our backend if needed.
            // For now, we fetch directly from NewsData.io (limited free credits)
            // and fallback to our robust internal curated news if it fails or hits limit.
            const API_KEY = 'pub_716900483863a8a37882834f3743be702582b'; // Placeholder Public Key or Dev Key
            const response = await fetch(`https://newsdata.io/api/1/news?apikey=${API_KEY}&q=${encodeURIComponent(query)}&language=en&category=technology,business`);

            const data = await response.json();

            if (data.status === 'success' && data.results && data.results.length > 0) {
                const mappedNews = data.results.map((item: any) => ({
                    title: item.title,
                    description: item.description?.substring(0, 150) + '...' || 'Latest updates in the field of AI and professional growth.',
                    link: item.link,
                    source_id: item.source_id,
                    pubDate: item.pubDate
                }));
                setNews(mappedNews);
            } else {
                setNews(FALLBACK_NEWS);
            }
        } catch (error) {
            console.error('News fetch error:', error);
            setNews(FALLBACK_NEWS);
        }
    };

    if (!isOpen) return null;

    const currentItem = news[currentIndex] || FALLBACK_NEWS[currentIndex];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Blurred Background */}
            <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-xl animate-fadeIn" />

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-dark-card rounded-3xl shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden animate-slideUp">
                <div className="p-8">
                    {/* Main Processing Header */}
                    <div className="flex flex-col items-center text-center mb-10">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full animate-pulse" />
                            <div className="relative w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white rotate-3 hover:rotate-0 transition-transform duration-500 shadow-xl">
                                <Sparkles className="w-10 h-10" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-lg shadow-lg">
                                <Loader2 className="w-5 h-5 animate-spin" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">
                            {message || 'Working AI Magic...'}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium max-w-md">
                            This usually takes about a minute. While you wait, check out these latest AI tool trends and career insights!
                        </p>
                    </div>

                    {/* News Widget Slider */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-100 dark:border-dark-border relative group overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
                            <Newspaper size={48} />
                        </div>

                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">
                            <TrendingUp size={14} />
                            <span>Latest Insights</span>
                            {(headline || (skills && skills.length > 0)) && (
                                <span className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded ml-2">
                                    tailored for your profile
                                </span>
                            )}
                        </div>

                        <div key={currentIndex} className="animate-fadeIn">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">
                                {currentItem.title}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                                {currentItem.description}
                            </p>

                            <div className="flex items-center justify-between">
                                <a
                                    href={currentItem.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                                >
                                    Read more <ExternalLink size={14} />
                                </a>

                                <div className="flex gap-1">
                                    {(news.length || FALLBACK_NEWS.length) > 1 && Array.from({ length: news.length || FALLBACK_NEWS.length }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`h-1.5 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-8 bg-blue-600' : 'w-2 bg-gray-300 dark:bg-dark-border'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-gray-100 dark:bg-dark-border">
                    <div className="h-full bg-blue-600 animate-loadingBar" />
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes loadingBar { 
                    0% { width: 0%; } 
                    20% { width: 30%; } 
                    40% { width: 45%; } 
                    60% { width: 70%; } 
                    80% { width: 85%; } 
                    100% { width: 95%; } 
                }
                .animate-fadeIn { animation: fadeIn 0.5s ease-out forwards; }
                .animate-slideUp { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-loadingBar { animation: loadingBar 60s cubic-bezier(0.1, 0, 0.1, 1) forwards; }
            `}} />
        </div>
    );
};
