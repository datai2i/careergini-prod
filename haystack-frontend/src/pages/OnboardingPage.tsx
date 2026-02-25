import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, CheckCircle2, ChevronRight, Check, AlertCircle, Loader2, Edit3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProcessingOverlay } from '../components/common/ProcessingOverlay';
import { DraftResumeModal } from '../components/DraftResumeModal';

export const OnboardingPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();
    const [step, setStep] = useState(1);
    const [inputMethod, setInputMethod] = useState<'resume' | 'linkedin' | 'draft' | null>(null);
    const [parsing, setParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        headline: '',
        location: '',
        summary: '',
        skills: [] as string[],
        goals: [] as string[],
        experience: [] as any[],
        education: [] as any[]
    });

    // Step 1: Resume Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setParsing(true);
        setError(null);

        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);

            const uploadRes = await fetch(`/api/resume/upload?user_id=${user?.id || 'default'}`, {
                method: 'POST',
                body: formDataUpload,
            });

            if (!uploadRes.ok) throw new Error('Failed to upload and parse resume');

            const uploadJson = await uploadRes.json();
            const persona = uploadJson.persona || {};

            setFormData(prev => ({
                ...prev,
                headline: persona.professional_title || persona.full_name || '',
                location: persona.location || '',
                summary: persona.summary || '',
                skills: persona.top_skills || [],
                experience: persona.experience_highlights || [],
                education: persona.education || []
            }));

            setStep(2);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Could not analyze resume. Please try again or skip.');
        } finally {
            setParsing(false);
        }
    };

    const handleDraftSave = async (draftData: any) => {
        try {
            const resp = await fetch('/api/resume/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...draftData, user_id: user?.id })
            });

            if (!resp.ok) throw new Error('Failed to save drafted resume');

            const result = await resp.json();
            const persona = result.persona || {};

            setFormData(prev => ({
                ...prev,
                headline: persona.professional_title || persona.full_name || '',
                location: persona.location || '',
                summary: persona.summary || '',
                skills: persona.top_skills || [],
                experience: persona.experience_highlights || [],
                education: persona.education || []
            }));

            setIsDraftModalOpen(false);
            setStep(2);
        } catch (err: any) {
            console.error('Draft save failed:', err);
            setError(err.message || 'Could not save drafted resume.');
        }
    };

    const handleSaveProfile = async () => {
        try {
            // Save profile data to backend
            const token = localStorage.getItem('auth_token');
            if (!token) {
                setError('Not authenticated. Please log in again.');
                navigate('/login');
                return;
            }

            const response = await fetch('/api/profile/profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    headline: formData.headline,
                    summary: formData.summary,
                    location: formData.location,
                    skills: formData.skills,
                    experience: formData.experience,
                    education: formData.education,
                    goals: formData.goals || [],
                    onboarding_completed: true
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save profile');
            }

            // Also update the unified persona for AI context
            const personaUpdate = {
                professional_title: formData.headline,
                summary: formData.summary,
                top_skills: formData.skills,
                experience_highlights: formData.experience,
                education: formData.education,
            };

            await fetch(`/api/resume/persona/${user?.id || 'default'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ persona: personaUpdate })
            });

            // Refresh global user state to get updated name/onboarding status
            await refreshUser();

            // Navigate to home dashboard after successful onboarding
            navigate('/home');
        } catch (err: any) {
            console.error('Error saving profile:', err);
            setError(err.message || 'Failed to save profile. Please try again.');
        }
    };
    const handleSkip = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                navigate('/login');
                return;
            }

            // Mark onboarding as completed even if skipped
            await fetch('/api/profile/profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    onboarding_completed: true
                })
            });

            navigate('/home');
        } catch (err) {
            console.error('Error skipping onboarding:', err);
            navigate('/home'); // Still navigate even if notification fails
        }
    };




    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <ProcessingOverlay
                isOpen={parsing}
                message={inputMethod === 'resume' ? 'Analyzing your resume...' : 'Parsing LinkedIn profile...'}
                headline={formData.headline}
            />
            {/* Progress Steps */}
            <div className="flex justify-between items-center mb-12 relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 dark:bg-dark-border -z-10 transform -translate-y-1/2" />

                {[1, 2, 3].map((s) => (
                    <div key={s} className={`flex flex-col items-center gap-2 bg-gray-50 dark:bg-dark-bg px-2`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
                            ${step >= s
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}
                        >
                            {step > s ? <Check size={20} /> : s}
                        </div>
                        <span className={`text-sm font-medium ${step >= s ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                            {s === 1 ? 'Upload' : s === 2 ? 'Review' : 'Finish'}
                        </span>
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-lg border border-gray-200 dark:border-dark-border overflow-hidden min-h-[400px]">

                {/* Error Message */}
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-center text-sm font-medium">
                        <AlertCircle className="inline-block w-4 h-4 mr-2 -mt-0.5" />
                        {error}
                    </div>
                )}

                {/* Step 1: Choose Input Method or Upload */}
                {step === 1 && (
                    <div className="p-8 animate-fadeIn">
                        {!inputMethod ? (
                            // Input Method Selection
                            <div className="text-center">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Get Started</h2>
                                <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                                    Choose how you'd like to build your profile
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                                    {/* Resume Upload Option */}
                                    <button
                                        onClick={() => setInputMethod('resume')}
                                        className="group p-8 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition-all text-left"
                                    >
                                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                            <Upload size={24} />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Upload Resume</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Upload your PDF or DOCX resume and let AI extract your information
                                        </p>
                                    </button>

                                    {/* Draft Manually Option */}
                                    <button
                                        onClick={() => setIsDraftModalOpen(true)}
                                        className="group p-8 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition-all text-left"
                                    >
                                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                            <Edit3 size={24} />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Draft Manually</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Don't have a resume handy? Enter your details manually to build your profile
                                        </p>
                                    </button>
                                </div>

                                <button
                                    onClick={handleSkip}
                                    className="mt-8 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline decoration-dotted"
                                >
                                    Skip setup and go to Dashboard
                                </button>
                            </div>
                        ) : inputMethod === 'resume' ? (
                            // Resume Upload UI
                            <div className="text-center">
                                <button
                                    onClick={() => setInputMethod(null)}
                                    className="mb-6 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-2 mx-auto"
                                >
                                    ← Back to options
                                </button>

                                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600 dark:text-blue-400">
                                    <Upload size={32} />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Upload your Resume</h2>
                                <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                                    We'll extract your skills, experience, and education to build your profile automatically.
                                </p>

                                <label className={`relative cursor-pointer group inline-block ${parsing ? 'pointer-events-none opacity-80' : ''}`}>
                                    <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileUpload} disabled={parsing} />
                                    <div className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30">
                                        {parsing ? (
                                            <>
                                                <Loader2 size={20} className="animate-spin" />
                                                <span>Analyzing with AI...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Select Resume (PDF/DOCX)</span>
                                                <ChevronRight size={20} />
                                            </>
                                        )}
                                    </div>
                                </label>

                                {parsing && (
                                    <p className="mt-4 text-sm text-gray-500 animate-pulse">
                                        Extracting skills, experience, and details...
                                    </p>
                                )}
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Step 2: Review */}
                {step === 2 && (
                    <div className="p-8 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Review & Personalize</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Headline</label>
                                <input
                                    type="text"
                                    value={formData.headline}
                                    onChange={e => setFormData({ ...formData, headline: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Location</label>
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Professional Summary</label>
                            <textarea
                                value={formData.summary}
                                onChange={e => setFormData({ ...formData, summary: e.target.value })}
                                rows={4}
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="mb-8">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Detected Skills</label>
                            <div className="flex flex-wrap gap-2">
                                {formData.skills.map((skill, i) => (
                                    <span key={i} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                                        {skill}
                                    </span>
                                ))}
                                {formData.skills.length === 0 && (
                                    <span className="text-gray-500 text-sm italic">No skills detected</span>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => setStep(1)}
                                className="text-gray-500 hover:text-gray-700 font-medium"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => setStep(3)}
                                className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium shadow-lg hover:shadow-blue-500/30"
                            >
                                Looks Good
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Success */}
                {step === 3 && (
                    <div className="p-8 text-center animate-fadeIn">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                            <CheckCircle2 size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Profile Ready!</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-8">
                            We've set up your personalized dashboard based on your resume.
                        </p>
                        <button
                            onClick={handleSaveProfile}
                            className="px-10 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-600/30"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                )}
            </div>

            <DraftResumeModal
                isOpen={isDraftModalOpen}
                onClose={() => setIsDraftModalOpen(false)}
                onSave={handleDraftSave}
            />
        </div >
    );
};
