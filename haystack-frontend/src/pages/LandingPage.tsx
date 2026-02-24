import React from 'react';
import { ArrowRight, Zap, Target, BookOpen, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const handleAction = (path: string) => {
        if (isAuthenticated) {
            navigate(path);
        } else {
            navigate('/login');
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 100
            }
        }
    };

    return (
        <div className="space-y-24 pb-20">
            {/* Hero Section */}
            <section className="relative pt-20 pb-32 overflow-hidden">
                <div className="absolute inset-0 -z-10">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900" />
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 blur-3xl opacity-20 dark:opacity-40">
                        <div className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc]" />
                    </div>
                    <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 blur-3xl opacity-20 dark:opacity-40">
                        <div className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-[#9089fc] to-[#ff80b5]" />
                    </div>
                </div>

                <div className="container mx-auto px-6 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="max-w-4xl mx-auto"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium mb-8 border border-blue-100 dark:border-blue-800">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            v1.0 is Live: 100% Local AI
                        </div>

                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-8 leading-tight">
                            Master Your Career with <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400">
                                Private Local Intelligence
                            </span>
                        </h1>

                        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
                            Get personalized resume reviews, skill gap analysis, and job matching without your data ever leaving your device. Powered by Ollama.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button
                                onClick={() => handleAction('/gini-chat')}
                                className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-2xl font-semibold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                            >
                                Start Free Consultation <ArrowRight size={20} />
                            </button>
                            <button
                                onClick={() => handleAction('/profile')}
                                className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-2xl font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                            >
                                Analyze My Profile
                            </button>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Bento Grid Features */}
            <section className="container mx-auto px-6">
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                >
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                        Everything you need to <span className="text-blue-600">level up</span>
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        A complete suite of tools powered by local LLMs to accelerate your career growth while maintaining complete privacy.
                    </p>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                    {/* Card 1 - Large */}
                    <motion.div variants={itemVariants} className="md:col-span-2 p-8 rounded-3xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Shield size={200} />
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
                            <Shield className="text-green-600 dark:text-green-400" size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Privacy First Architecture</h3>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed max-w-md">
                            Unlike other AI tools, CareerGini runs 100% locally on your machine using Docker and Ollama. Your resume, salary data, and career goals never touch the cloud.
                        </p>
                    </motion.div>

                    {/* Card 2 */}
                    <motion.div variants={itemVariants} className="p-8 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow">
                        <div className="w-12 h-12 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-6">
                            <Zap className="text-yellow-600 dark:text-yellow-400" size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Instant Feedback</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Get real-time scoring on your resume and interview answers with zero latency.
                        </p>
                    </motion.div>

                    {/* Card 3 */}
                    <motion.div variants={itemVariants} className="p-8 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6">
                            <Target className="text-blue-600 dark:text-blue-400" size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Smart Matching</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Our AI analyzes thousands of job descriptions to find your perfect fit.
                        </p>
                    </motion.div>

                    {/* Card 4 - Large */}
                    <motion.div variants={itemVariants} className="md:col-span-2 p-8 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white hover:shadow-xl transition-shadow relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-6">
                                <BookOpen className="text-white" size={24} />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">Personalized Learning Paths</h3>
                            <p className="text-blue-100 leading-relaxed max-w-md">
                                Don't just find gaps—fill them. CareerGini generates custom curriculum from YouTube, Coursera, and technical documentation to upskill you fast.
                            </p>
                        </div>
                        <div className="absolute bottom-0 right-0 opacity-20 translate-x-12 translate-y-12">
                            <BookOpen size={240} />
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            {/* Social Proof / Stats */}
            <section className="container mx-auto px-6 py-20 border-t border-gray-100 dark:border-gray-800">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    {[
                        { label: "Active Users", value: "10k+" },
                        { label: "Resumes Optimized", value: "50k+" },
                        { label: "Jobs Matched", value: "125k+" },
                        { label: "Privacy Score", value: "100%" }
                    ].map((stat, idx) => (
                        <div key={idx}>
                            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">{stat.value}</div>
                            <div className="text-sm text-gray-500 uppercase tracking-wide font-medium">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};
