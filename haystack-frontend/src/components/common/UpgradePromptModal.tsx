import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, X, Check } from 'lucide-react';

interface UpgradePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPlan: string;
}

export const UpgradePromptModal: React.FC<UpgradePromptModalProps> = ({ isOpen, onClose, currentPlan }) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const isFree = currentPlan.toLowerCase() === 'free';
    const isStarter = currentPlan.toLowerCase() === 'basic';
    const isPremium = currentPlan.toLowerCase() === 'premium';

    let title = "Upgrade Your Plan";
    let message = "You've reached a milestone! Unlock more features to accelerate your career.";
    let ctaText = "Upgrade Now";
    let nextPlan = 'starter';
    let features: string[] = [];

    if (isFree) {
        title = "First Build Complete! 🎉";
        message = "You've experienced the power of AI tailoring. Unlock 5 more builds, industry-specific tailoring, and cover letter auto-generation with the Starter plan — just $5 one-time.";
        ctaText = "Upgrade to Starter — $5 One-Time";
        nextPlan = 'starter';
        features = ["5 AI-tailored Resume Builds", "Industry-specific tailoring (Tech, Finance, Healthcare & more)", "ATS score + 1-click regeneration", "Cover letter auto-generation", "Credits never expire"];
    } else if (isStarter) {
        title = "Starter Build Limit Reached";
        message = "You've used all 5 Starter Resume Builds. Renew your Starter plan, or upgrade to Premium to unlock Gini Chat mentorship and the Learning Hub.";
        ctaText = "Upgrade to Premium — $20 One-Time";
        nextPlan = 'premium';
        features = ["20 AI-tailored Resume Builds", "Unlimited Gini Chat AI mentor sessions", "Hyper-personalised global job search", "Learning Hub — skills, courses & career roadmap", "Credits never expire"];
    } else if (isPremium) {
        title = "Power User — 20 Resume Builds Used!";
        message = "You've utilized your 20 Premium Resume Builds. Renew your Premium plan to reload your 20 Reserve Builds and maintain uninterrupted access to Gini Chat and the Learning Hub.";
        ctaText = "Renew Premium — $20 One-Time";
        nextPlan = 'premium';
        features = ["20 AI-tailored Resume Builds", "Unlimited Gini Chat AI mentor sessions", "Learning Hub & Global Job Search", "Credits never expire"];
    }

    const handleCTA = (planKey: string) => {
        onClose();
        if (planKey === 'contact') {
            window.location.href = 'mailto:team@datai2i.com?subject=Premium%20Quota%20Reload%20Request';
        } else {
            navigate(`/payment?plan=${planKey}`);
        }
    };

    // Render buttons based on the user's current plan
    const renderButtons = () => {
        if (isFree) {
            return (
                <div className="flex flex-col gap-3">
                    <button onClick={() => handleCTA('premium')} className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-purple-500/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3">
                        <span>Upgrade to Premium — $20 One-Time</span><ArrowRight className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleCTA('starter')} className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3">
                        <span>Upgrade to Starter — $5 One-Time</span><ArrowRight className="w-5 h-5" />
                    </button>
                    <button onClick={onClose} className="w-full py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-medium transition-colors mt-2">Maybe Later</button>
                </div>
            );
        } else if (isStarter) {
            return (
                <div className="flex flex-col gap-3">
                    <button onClick={() => handleCTA('premium')} className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-purple-500/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3">
                        <span>{ctaText}</span><ArrowRight className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleCTA('starter')} className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3">
                        <span>Renew Starter — $5 One-Time</span><ArrowRight className="w-5 h-5" />
                    </button>
                    <button onClick={onClose} className="w-full py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-medium transition-colors mt-2">Maybe Later</button>
                </div>
            );
        } else if (isPremium) {
            return (
                <div className="flex flex-col gap-3">
                    <button onClick={() => handleCTA('premium')} className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-purple-500/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3">
                        <span>{ctaText}</span><ArrowRight className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleCTA('starter')} className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3">
                        <span>Downgrade to Starter — $5 One-Time</span><ArrowRight className="w-5 h-5" />
                    </button>
                    <button onClick={onClose} className="w-full py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-medium transition-colors mt-2">Maybe Later</button>
                </div>
            );
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-white/20 animate-scaleIn flex flex-col max-h-[92vh]">
                {/* Decorative Background */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-blue-600 to-purple-600 -z-10 opacity-10"></div>
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>

                <div className="sticky top-0 right-0 p-4 border-b border-transparent z-10 w-full flex justify-end">
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 md:p-8 pt-2 overflow-y-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 flex-shrink-0">
                            <Zap className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white leading-tight">
                            {title}
                        </h2>
                    </div>

                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mb-6 md:mb-8 leading-relaxed">
                        {message}
                    </p>

                    {features.length > 0 && (
                        <div className="space-y-4 mb-8 md:mb-10">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Included in next level:</p>
                            <div className="grid grid-cols-1 gap-2 md:gap-3">
                                {features.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2 md:p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/50">
                                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 flex-shrink-0">
                                            <Check className="w-3 h-3 md:w-4 md:h-4" />
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {renderButtons()}
                </div>
            </div>
        </div>
    );
};
