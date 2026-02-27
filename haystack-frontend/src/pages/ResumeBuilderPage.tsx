import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, Download, ArrowRight, RefreshCw, AlertCircle, History, Clock, Edit3, Briefcase } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notifyStep, requestNotificationPermission } from '../utils/notify';
import { ProcessingOverlay } from '../components/common/ProcessingOverlay';
import { useToast } from '../context/ToastContext';
import { DraftResumeModal } from '../components/DraftResumeModal';
import { UpgradePromptModal } from '../components/common/UpgradePromptModal';

interface ResumePersona {
    full_name: string;
    professional_title: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    portfolio_url?: string;
    years_experience: number;
    summary: string;
    top_skills: string[];
    experience_highlights: Array<{
        role: string;
        company: string;
        duration: string;
        key_achievement: string;
        tailored_bullets?: string[];
    }>;
    projects?: Array<{
        name: string;
        description: string;
    }>;
    education?: Array<{
        degree: string;
        school: string;
        year: string;
    }>;
    certifications?: string[];
    cover_letter?: string;
    ats_score?: number;
}

const generateMockJD = (role: string, persona: any) => {
    const skills = persona?.top_skills?.slice(0, 5).join(", ") || "relevant technical and soft skills";
    const title = persona?.professional_title || "professional";

    return `About the Role:\nWe are actively seeking a highly motivated and experienced ${role} to join our dynamic and fast-paced team. In this pivotal role, you will be responsible for driving key initiatives, collaborating with cross-functional teams, and delivering high-impact results that align with our strategic business objectives.\n\nKey Responsibilities:\n- Lead the design, development, and execution of core projects and deliverables related to the ${role} function.\n- Partner with stakeholders across the organization to align strategies and ensure successful project outcomes.\n- Leverage your expertise as a ${title} to mentor junior team members and establish best practices.\n- Analyze data, identify trends, and implement innovative solutions to complex deliverables.\n\nQualifications & Requirements:\n- Proven track record and hands-on experience in the field, with a strong portfolio of successful projects.\n- Demonstrated proficiency with key industry tools and methodologies, specifically including: ${skills}.\n- Exceptional communication, leadership, and problem-solving abilities.\n- Ability to thrive in an agile, collaborative, and fast-paced environment.`;
};

const getDynamicRoles = (persona: any) => {
    let roles = persona?.suggested_roles || [];
    const defaults = ["Software Engineer", "Product Manager", "Data Scientist", "Marketing Director", "Operations Manager"];
    roles = [...roles, ...defaults];
    // De-dupe and take top 5
    return Array.from(new Set(roles)).slice(0, 5);
};

export const ResumeBuilderPage: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const { showToast } = useToast();
    const [step, setStep] = useState(1);
    const [uploading, setUploading] = useState(false);
    const [persona, setPersona] = useState<ResumePersona | null>(null);
    const [jobDescription, setJobDescription] = useState('');
    const [tailoring, setTailoring] = useState(false);
    const [tailoredContent, setTailoredContent] = useState<any>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('professional');
    const [profilePicBase64, setProfilePicBase64] = useState<string | null>(null);
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [docxUrl, setDocxUrl] = useState<string | null>(null);
    const [coverLetterUrl, setCoverLetterUrl] = useState<string | null>(null);
    const [coverLetterDocxUrl, setCoverLetterDocxUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [pageCount, setPageCount] = useState<number>(2);
    const [sessions, setSessions] = useState<Array<{ session_id: string; timestamp: string; job_title_snippet: string }>>([]);
    const [loadingSession, setLoadingSession] = useState(false);
    const [targetIndustry, setTargetIndustry] = useState<string>('');
    const [focusArea, setFocusArea] = useState<string>('');

    // Load existing persona on mount — keyed on user.id only to avoid re-fetching
    // when AuthContext re-renders and creates a new `user` object reference
    useEffect(() => {
        requestNotificationPermission();

        if (user?.id) {
            fetch(`/api/resume/persona/${user.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        setPersona(data.persona);
                    }
                })
                .catch(err => console.error(err));

            // Load session history
            fetch(`/api/resume/sessions/${user.id}`)
                .then(res => res.json())
                .then(data => { if (data.sessions) setSessions(data.sessions); })
                .catch(err => console.error('Sessions load error:', err));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const loadSession = async (sessionId: string) => {
        setLoadingSession(true);
        setError(null);
        try {
            const res = await fetch(`/api/resume/sessions/${user?.id || 'default'}/${sessionId}`);
            const data = await res.json();
            if (data.status === 'success') {
                const s = data.session;
                const persona = s.persona;
                const tc = s.tailored_content || {};
                const completeTailored = {
                    ...persona,
                    ...tc,
                    summary: tc.tailored_summary || persona?.summary,
                    top_skills: tc.tailored_skills || persona?.top_skills,
                    experience_highlights: tc.tailored_experience || persona?.experience_highlights,
                    cover_letter: tc.cover_letter || persona?.cover_letter,
                };
                setPersona(persona);
                setJobDescription(s.job_description || '');
                setTailoredContent(completeTailored);
                setStep(4);
            } else {
                setError('Could not load session.');
            }
        } catch (err: any) {
            setError(`Error loading session: ${err.message}`);
        } finally {
            setLoadingSession(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setUploading(true);
            setError(null);

            const formData = new FormData();
            formData.append('file', selectedFile);

            try {
                const response = await fetch(`/api/resume/upload?user_id=${user?.id || 'default'}`, {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();

                if (response.ok) {
                    setPersona(data.persona);
                    await refreshUser(); // Update global user state (name, resume metadata)
                    setStep(2);
                    notifyStep('✅ Resume Parsed!', 'Your resume has been analysed. Ready to set your target role.');
                    showToast('Resume parsed successfully', 'success');
                } else {
                    setError(data.detail || 'Upload failed');
                }
            } catch (err) {
                setError('An error occurred during upload.');
            } finally {
                setUploading(false);
            }
        }
    };

    const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);

    const handleDraftSave = async (draftData: any) => {
        try {
            setUploading(true);
            const token = localStorage.getItem('auth_token');
            const resp = await fetch('/api/resume/draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ...draftData, user_id: user?.id })
            });

            if (!resp.ok) throw new Error('Failed to save drafted resume');

            const result = await resp.json();
            setPersona(result.persona);
            await refreshUser(); // Update global user state (name, resume metadata)
            setStep(2);
            setIsDraftModalOpen(false);
            notifyStep('✅ Manual Draft Saved!', 'Your resume draft is ready. Ready to tailor it.');
            showToast('Drafted resume saved successfully', 'success');
        } catch (err: any) {
            console.error('Draft save failed:', err);
            setError(err.message || 'Could not save drafted resume.');
        } finally {
            setUploading(false);
        }
    };

    const handlePersonaConfirm = async () => {
        if (!persona) return;

        setUploading(true); // Reuse uploading state for sync visual
        try {
            // Sync 1: Central Database (Profile Service)
            const dbSyncPromise = fetch('/api/profile/sync-resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.id,
                    full_name: persona.full_name,
                    headline: persona.professional_title,
                    summary: persona.summary,
                    skills: persona.top_skills,
                    experience: persona.experience_highlights,
                    education: persona.education
                })
            });

            // Sync 2: AI Local Context (Haystack Service)
            const aiSyncPromise = fetch(`/api/resume/persona/${user?.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    persona: {
                        full_name: persona.full_name,
                        professional_title: persona.professional_title,
                        email: persona.email,
                        phone: persona.phone,
                        location: persona.location,
                        linkedin: persona.linkedin,
                        portfolio_url: persona.portfolio_url,
                        summary: persona.summary,
                        top_skills: persona.top_skills,
                        experience_highlights: persona.experience_highlights,
                        projects: persona.projects,
                        education: persona.education
                    }
                })
            });

            const [dbSync, aiSync] = await Promise.all([dbSyncPromise, aiSyncPromise]);

            if (dbSync.ok && aiSync.ok) {
                await refreshUser();
                setStep(3);
                showToast('Profile & AI Context updated!', 'success');
            } else {
                if (!dbSync.ok) console.error('DB Sync failed');
                if (!aiSync.ok) console.error('AI Sync failed');

                await refreshUser(); // Still refresh what we can
                setStep(3);
                showToast('Partial sync completed. AI context may delay.', 'warning');
            }
        } catch (err) {
            console.error('Persona sync failed:', err);
            setStep(3);
        } finally {
            setUploading(false);
        }
    };

    const handleTailorResume = async () => {
        if (!jobDescription.trim()) {
            setError('Please enter a Job Description');
            return;
        }

        setTailoring(true);
        setError(null);

        try {
            const response = await fetch('/api/resume/tailor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user?.id || 'default',
                    job_description: jobDescription,
                    persona: persona,
                    target_industry: targetIndustry,
                    focus_area: focusArea
                }),
            });

            const data = await response.json();
            if (response.ok) {
                // Merge tailored content with original persona to preserve contact info
                const completeTailoredPersona = {
                    ...persona,
                    ...data.tailored_content,
                    cover_letter: data.tailored_content.cover_letter,
                    // Ensure specific fields are updated if present in tailored content
                    summary: data.tailored_content.tailored_summary || persona?.summary,
                    top_skills: data.tailored_content.tailored_skills || persona?.top_skills,
                    experience_highlights: data.tailored_content.tailored_experience || persona?.experience_highlights,
                    projects: data.tailored_content.tailored_projects || persona?.projects
                };

                setTailoredContent(completeTailoredPersona);
                setStep(4);
                notifyStep('✅ Resume Tailored!', 'Your resume has been customised for the job. Review and generate your PDF.');
                showToast('Resume tailored to the job!', 'success');
                // Refresh sessions list after successful tailoring
                fetch(`/api/resume/sessions/${user?.id || 'default'}`)
                    .then(r => r.json()).then(d => { if (d.sessions) setSessions(d.sessions); });
            } else if (response.status === 403) {
                // Plan limit hit — show upgrade modal instead of error
                setShowUpgradeModal(true);
            } else {
                setError(data.detail || 'Tailoring failed');
            }
        } catch (err: any) {
            console.error(err);
            setError(`An error occurred during tailoring: ${err.message || String(err)}`);
        } finally {
            setTailoring(false);
        }
    };

    const handleGeneratePDF = async () => {
        setGeneratingPDF(true);
        setError(null);

        try {
            const pdfResponse = await fetch('/api/resume/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.id || 'default',
                    job_description: jobDescription,
                    persona: tailoredContent,
                    template: selectedTemplate,
                    profile_pic: profilePicBase64,
                    page_count: pageCount,
                })
            });

            const pdfData = await pdfResponse.json();
            if (pdfResponse.ok) {
                setPdfUrl(pdfData.pdf_url);
                setDocxUrl(pdfData.docx_url);
                setCoverLetterUrl(pdfData.cover_letter_url || null);
                setCoverLetterDocxUrl(pdfData.cover_letter_docx_url || null);
                setStep(5);
                await refreshUser(); // Update build count and plan info

                // Show upgrade prompt if milestone reached
                const currentPlan = user?.plan || 'free';
                const count = (user?.resume_count || 0) + 1; // +1 since we just generated one

                if (
                    (currentPlan === 'free' && count >= 1) ||
                    (currentPlan === 'basic' && count >= 5) ||
                    (currentPlan === 'premium' && count >= 20)
                ) {
                    setTimeout(() => setShowUpgradeModal(true), 1500);
                }

                notifyStep('🎉 PDF Ready!', 'Your professional resume and cover letter have been generated. Click to download!');
                showToast('Files ready to download! 🎉', 'success');
            } else if (pdfResponse.status === 403) {
                // Plan limit hit — show upgrade modal, NOT a raw error
                setShowUpgradeModal(true);
            } else {
                setError(pdfData.detail || "Failed to generate PDF");
            }
        } catch (err: any) {
            console.error(err);
            setError(`An error occurred: ${err.message || String(err)}`);
        } finally {
            setGeneratingPDF(false);
        }
    };

    const handleReset = () => {
        setStep(1);
        setPersona(null);
        setJobDescription('');
        setTailoredContent(null);
        setPdfUrl(null);
        setError(null);
    };

    return (
        <div className="max-w-7xl mx-auto w-full space-y-6 animate-fadeIn">
            <ProcessingOverlay
                isOpen={uploading || tailoring || loadingSession}
                message={uploading ? 'Analyzing your resume...' : tailoring ? 'Tailoring to your dream job...' : 'Loading session...'}
                headline={persona?.professional_title}
            />
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                        AI Resume Builder
                    </h1>
                    <p className="text-gray-600">Tailor your resume to any job description in seconds.</p>
                </div>
                <div className="flex items-center gap-4">
                    {step > 1 && (
                        <button
                            onClick={handleReset}
                            className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Start Over
                        </button>
                    )}
                    <div className="absolute opacity-0">
                        {/* Removed step counter layout per user request */}
                    </div>
                </div>
            </div>

            <div className="mx-auto bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white mt-8">
                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 flex items-center shadow-sm">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        {error}
                    </div>
                )}

                {/* Step 1: Choose How to Start */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div className="text-center mb-2">
                            <h2 className="text-2xl font-semibold text-gray-800">How would you like to start?</h2>
                            <p className="text-gray-500 text-sm mt-1">Choose an option below to begin building your resume.</p>
                        </div>

                        {/* Three option cards */}
                        <div className="grid md:grid-cols-3 gap-5">

                            {/* Card 1: Start Fresh */}
                            <div className="bg-white/60 backdrop-blur-sm border-2 border-purple-100 hover:border-purple-400 rounded-2xl p-7 flex flex-col items-center text-center shadow-md hover:shadow-lg transition-all group">
                                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                                    <Upload className="w-8 h-8 text-purple-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Start Fresh</h3>
                                <p className="text-sm text-gray-500 mb-5 flex-1">
                                    We'll parse your resume or you can draft it manually, then guide you through 4 steps to tailor and generate your perfect resume.
                                </p>
                                <div className="w-full flex flex-col gap-2">
                                    <button
                                        onClick={() => setIsDraftModalOpen(true)}
                                        className="w-full text-center bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200 px-5 py-2.5 rounded-xl font-medium transition-all inline-flex items-center justify-center shadow-sm"
                                    >
                                        <Edit3 className="w-4 h-4 mr-2" /> Draft Manually
                                    </button>
                                    <label className="cursor-pointer w-full text-center bg-gradient-to-r from-purple-600 to-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition-all inline-flex items-center justify-center shadow">
                                        {uploading ? (
                                            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                                        ) : (
                                            <><FileText className="w-4 h-4 mr-2" /> Upload Resume</>
                                        )}
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept=".pdf,.docx,.txt"
                                            onChange={handleFileUpload}
                                            disabled={uploading}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Card 2: Existing Resume → Step 3 */}
                            <div className={`bg-white/60 backdrop-blur-sm border-2 rounded-2xl p-7 flex flex-col items-center text-center shadow-md transition-all group ${persona ? 'border-emerald-100 hover:border-emerald-400 hover:shadow-lg' : 'border-gray-100 opacity-50'
                                }`}>
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${persona ? 'bg-emerald-100 group-hover:bg-emerald-200' : 'bg-gray-100'
                                    }`}>
                                    <CheckCircle className={`w-8 h-8 ${persona ? 'text-emerald-600' : 'text-gray-400'}`} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Existing Resume</h3>
                                <p className="text-sm text-gray-500 mb-5 flex-1">
                                    {persona
                                        ? `Your ${user?.latest_resume_filename ? `resume '${user.latest_resume_filename}'` : 'previous resume'} for ${persona.full_name} is ready. Jump straight to entering a job description.`
                                        : 'No parsed resume found. Upload a new resume first to enable this option.'}
                                </p>
                                <button
                                    onClick={() => { if (persona) setStep(3); }}
                                    disabled={!persona}
                                    className={`w-full px-5 py-2.5 rounded-xl font-medium border-2 transition-all inline-flex items-center justify-center ${persona
                                        ? 'border-emerald-400 text-emerald-700 hover:bg-emerald-50'
                                        : 'border-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    <ArrowRight className="w-4 h-4 mr-2" />
                                    {persona ? `Continue as ${persona.full_name?.split(' ')[0] || 'User'}` : 'Not Available'}
                                </button>
                            </div>

                            {/* Card 3: Tailored Resume → Step 4 */}
                            <div className={`bg-white/60 backdrop-blur-sm border-2 rounded-2xl p-7 flex flex-col items-center text-center shadow-md transition-all group ${sessions.length > 0 ? 'border-blue-100 hover:border-blue-400 hover:shadow-lg' : 'border-gray-100 opacity-50'
                                }`}>
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${sessions.length > 0 ? 'bg-blue-100 group-hover:bg-blue-200' : 'bg-gray-100'
                                    }`}>
                                    <History className={`w-8 h-8 ${sessions.length > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Tailored Resume</h3>
                                <p className="text-sm text-gray-500 mb-4 flex-1">
                                    {sessions.length > 0
                                        ? `${sessions.length} previously tailored session${sessions.length > 1 ? 's' : ''} available. Pick one and jump straight to template selection.`
                                        : 'No tailored sessions yet. Complete a tailoring step first.'}
                                </p>
                                {sessions.length > 0 ? (
                                    <div className="w-full space-y-2 max-h-48 overflow-y-auto">
                                        {sessions.map((s) => {
                                            const dt = s.timestamp.replace('T', ' at ').substring(0, 19).replace(/-/g, '/');
                                            return (
                                                <button
                                                    key={s.session_id}
                                                    onClick={() => loadSession(s.session_id)}
                                                    disabled={loadingSession}
                                                    className="w-full text-left px-3 py-2.5 rounded-xl border border-blue-100 bg-blue-50/60 hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-3"
                                                >
                                                    <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-semibold text-gray-800 truncate">{s.job_title_snippet || 'Tailored Resume'}</p>
                                                        <p className="text-xs text-gray-400">{dt}</p>
                                                    </div>
                                                    <span className="text-xs font-bold text-blue-600 flex-shrink-0">
                                                        {loadingSession ? '...' : '→'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="w-full px-5 py-2.5 rounded-xl font-medium border-2 border-gray-200 text-gray-400 text-center text-sm">
                                        No Sessions Yet
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                )}


                {/* Step 2: Review & Edit Persona */}
                {step === 2 && persona && (
                    <div className="space-y-6">
                        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-xl">
                            {(!persona.email || !persona.phone || !persona.linkedin) && (
                                <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start">
                                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
                                    <div>
                                        <h4 className="text-sm font-semibold text-amber-800">Gini Suggests: Missing Contact Info</h4>
                                        <p className="text-sm text-amber-700 mt-1">
                                            Your resume is missing some crucial contact details ({[
                                                !persona.email && 'Email',
                                                !persona.phone && 'Phone',
                                                !persona.linkedin && 'LinkedIn'
                                            ].filter(Boolean).join(', ')}). We highly recommend adding these below so recruiters can reach you!
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                <div className="flex-1 w-full">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Name</label>
                                    <input
                                        type="text"
                                        value={persona.full_name}
                                        onChange={(e) => setPersona({ ...persona, full_name: e.target.value })}
                                        className="block w-full text-2xl font-bold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 focus:outline-none py-1"
                                    />
                                    <div className="mt-2 text-purple-600 font-medium text-lg flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={persona.professional_title}
                                            onChange={(e) => setPersona({ ...persona, professional_title: e.target.value })}
                                            className="w-full bg-transparent border-b border-dashed border-purple-200 focus:border-purple-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                                    <input
                                        type="number"
                                        value={persona.years_experience}
                                        onChange={(e) => setPersona({ ...persona, years_experience: parseInt(e.target.value) || 0 })}
                                        className="w-12 bg-transparent text-blue-800 font-bold text-center focus:outline-none border-b border-blue-200"
                                        min="0"
                                    />
                                    <span className="text-sm font-medium text-blue-800">Years Exp</span>
                                </div>
                            </div>

                            {/* Contact Information Grid */}
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 pt-4 border-t border-gray-100">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                                    <input
                                        type="email"
                                        value={persona.email || ''}
                                        onChange={(e) => setPersona({ ...persona, email: e.target.value })}
                                        className="w-full text-sm font-medium text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 focus:outline-none py-1"
                                        placeholder="your.email@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</label>
                                    <input
                                        type="tel"
                                        value={persona.phone || ''}
                                        onChange={(e) => setPersona({ ...persona, phone: e.target.value })}
                                        className="w-full text-sm font-medium text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 focus:outline-none py-1"
                                        placeholder="+1 234 567 8900"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</label>
                                    <input
                                        type="text"
                                        value={persona.location || ''}
                                        onChange={(e) => setPersona({ ...persona, location: e.target.value })}
                                        className="w-full text-sm font-medium text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 focus:outline-none py-1"
                                        placeholder="City, Country"
                                    />
                                </div>
                                <div className="lg:col-span-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LinkedIn Profile</label>
                                    <input
                                        type="url"
                                        value={persona.linkedin || ''}
                                        onChange={(e) => setPersona({ ...persona, linkedin: e.target.value })}
                                        className="w-full text-sm font-medium text-blue-600 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none py-1"
                                        placeholder="linkedin.com/in/username"
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Portfolio / GitHub URL</label>
                                    <input
                                        type="url"
                                        value={persona.portfolio_url || ''}
                                        onChange={(e) => setPersona({ ...persona, portfolio_url: e.target.value })}
                                        className="w-full text-sm font-medium text-blue-600 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none py-1"
                                        placeholder="github.com/username or yoursite.com"
                                    />
                                </div>
                            </div>

                            <div className="mb-6 bg-purple-50 p-4 rounded-xl border border-purple-100 transition-all focus-within:ring-2 focus-within:ring-purple-200">
                                <h3 className="text-sm font-semibold text-purple-800 mb-2 uppercase tracking-wide">Professional Summary</h3>
                                <textarea
                                    value={persona.summary}
                                    onChange={(e) => setPersona({ ...persona, summary: e.target.value })}
                                    className="w-full text-gray-700 leading-relaxed bg-transparent border-none focus:ring-0 resize-none h-24"
                                    placeholder="Write your compelling professional summary here..."
                                />
                            </div>

                            <div className="flex flex-col gap-8">
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-semibold text-gray-800 flex items-center">
                                            <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Top Skills
                                        </h3>
                                        <button
                                            onClick={() => setPersona({ ...persona, top_skills: [...(persona.top_skills || []), "New Skill"] })}
                                            className="text-xs text-purple-600 hover:text-purple-800 font-medium bg-purple-50 px-2 py-1 rounded"
                                        >
                                            + Add Skill
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {persona.top_skills?.map((skill, i) => (
                                            <div key={i} className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm focus-within:border-purple-400 focus-within:ring-1 focus-within:ring-purple-400 overflow-hidden">
                                                <input
                                                    type="text"
                                                    value={skill}
                                                    onChange={(e) => {
                                                        const newSkills = [...persona.top_skills];
                                                        newSkills[i] = e.target.value;
                                                        setPersona({ ...persona, top_skills: newSkills });
                                                    }}
                                                    className="px-3 py-1 text-sm text-gray-700 w-24 sm:w-32 bg-transparent border-none focus:ring-0"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newSkills = persona.top_skills.filter((_, idx) => idx !== i);
                                                        setPersona({ ...persona, top_skills: newSkills });
                                                    }}
                                                    className="px-2 text-gray-400 hover:text-red-500 hover:bg-gray-50 h-full border-l border-gray-100"
                                                >×</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-semibold text-gray-800 flex items-center">
                                            <FileText className="w-4 h-4 mr-2 text-blue-500" /> Key Roles
                                        </h3>
                                        <button
                                            onClick={() => setPersona({ ...persona, experience_highlights: [...(persona.experience_highlights || []), { role: "New Role", company: "Company", duration: "2023-Present", key_achievement: "" }] })}
                                            className="text-xs text-purple-600 hover:text-purple-800 font-medium bg-purple-50 px-2 py-1 rounded"
                                        >
                                            + Add Role
                                        </button>
                                    </div>
                                    <ul className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                        {persona.experience_highlights?.map((exp, i) => (
                                            <li key={i} className="text-sm bg-gray-50 p-3 rounded-xl border border-gray-100 relative group">
                                                <button
                                                    onClick={() => {
                                                        const newExp = persona.experience_highlights.filter((_, idx) => idx !== i);
                                                        setPersona({ ...persona, experience_highlights: newExp });
                                                    }}
                                                    className="absolute top-2 right-2 text-gray-300 hover:text-red-500 hidden group-hover:block"
                                                >×</button>
                                                <div className="flex gap-2 mb-2">
                                                    <input
                                                        value={exp.role}
                                                        onChange={(e) => {
                                                            const newExp = [...persona.experience_highlights];
                                                            newExp[i].role = e.target.value;
                                                            setPersona({ ...persona, experience_highlights: newExp });
                                                        }}
                                                        className="font-medium text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 outline-none w-1/2"
                                                        placeholder="Role Title"
                                                    />
                                                    <span className="text-gray-400">@</span>
                                                    <input
                                                        value={exp.company}
                                                        onChange={(e) => {
                                                            const newExp = [...persona.experience_highlights];
                                                            newExp[i].company = e.target.value;
                                                            setPersona({ ...persona, experience_highlights: newExp });
                                                        }}
                                                        className="font-medium text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 outline-none w-1/3"
                                                        placeholder="Company"
                                                    />
                                                </div>
                                                <textarea
                                                    value={exp.key_achievement}
                                                    onChange={(e) => {
                                                        const newExp = [...persona.experience_highlights];
                                                        newExp[i].key_achievement = e.target.value;
                                                        setPersona({ ...persona, experience_highlights: newExp });
                                                    }}
                                                    className="w-full text-gray-500 leading-snug bg-transparent border border-transparent hover:border-gray-200 focus:border-purple-300 focus:ring-0 rounded p-1 resize-none h-16"
                                                    placeholder="Key Achievements..."
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                    <div>
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="font-semibold text-gray-800 flex items-center">
                                                <Briefcase className="w-4 h-4 mr-2 text-blue-500" /> Key Projects
                                            </h3>
                                            <button
                                                onClick={() => setPersona({ ...persona, projects: [...(persona.projects || []), { name: "New Project", description: "" }] })}
                                                className="text-xs text-purple-600 hover:text-purple-800 font-medium bg-purple-50 px-2 py-1 rounded"
                                            >
                                                + Add Project
                                            </button>
                                        </div>
                                        <ul className="space-y-4 max-h-[200px] overflow-y-auto pr-2 mb-6">
                                            {(persona.projects || []).map((proj, i) => (
                                                <li key={i} className="text-sm bg-gray-50 p-3 rounded-xl border border-gray-100 relative group">
                                                    <button
                                                        onClick={() => {
                                                            const newProj = persona.projects!.filter((_, idx) => idx !== i);
                                                            setPersona({ ...persona, projects: newProj });
                                                        }}
                                                        className="absolute top-2 right-2 text-gray-300 hover:text-red-500 hidden group-hover:block"
                                                    >×</button>
                                                    <div className="flex gap-2 mb-2">
                                                        <input
                                                            value={proj.name}
                                                            onChange={(e) => {
                                                                const newProj = [...persona.projects!];
                                                                newProj[i].name = e.target.value;
                                                                setPersona({ ...persona, projects: newProj });
                                                            }}
                                                            className="font-medium text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 outline-none w-full"
                                                            placeholder="Project Name"
                                                        />
                                                    </div>
                                                    <textarea
                                                        value={proj.description}
                                                        onChange={(e) => {
                                                            const newProj = [...persona.projects!];
                                                            newProj[i].description = e.target.value;
                                                            setPersona({ ...persona, projects: newProj });
                                                        }}
                                                        className="w-full text-gray-500 leading-snug bg-transparent border border-transparent hover:border-gray-200 focus:border-purple-300 focus:ring-0 rounded p-1 resize-none h-16"
                                                        placeholder="Project Description..."
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                {/* Education */}
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-semibold text-gray-800 flex items-center">
                                            <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                                            </svg>
                                            Education
                                        </h3>
                                        <button
                                            onClick={() => setPersona({ ...persona, education: [...(persona.education || []), { degree: "New Degree", school: "School Name", year: "YYYY" }] })}
                                            className="text-xs text-purple-600 hover:text-purple-800 font-medium bg-purple-50 px-2 py-1 rounded"
                                        >
                                            + Add Education
                                        </button>
                                    </div>
                                    <ul className="space-y-4 max-h-[200px] overflow-y-auto pr-2 mb-6">
                                        {(persona.education || []).map((edu, i) => (
                                            <li key={i} className="text-sm bg-gray-50 p-3 rounded-xl border border-gray-100 relative group">
                                                <button
                                                    onClick={() => {
                                                        const newEdu = persona.education!.filter((_, idx) => idx !== i);
                                                        setPersona({ ...persona, education: newEdu });
                                                    }}
                                                    className="absolute top-2 right-2 text-gray-300 hover:text-red-500 hidden group-hover:block"
                                                >×</button>
                                                <div className="flex flex-wrap gap-2">
                                                    <input
                                                        value={edu.degree}
                                                        onChange={(e) => {
                                                            const newEdu = [...persona.education!];
                                                            newEdu[i].degree = e.target.value;
                                                            setPersona({ ...persona, education: newEdu });
                                                        }}
                                                        className="font-medium text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 outline-none w-full md:w-5/12"
                                                        placeholder="Degree (e.g., BS Computer Science)"
                                                    />
                                                    <input
                                                        value={edu.school}
                                                        onChange={(e) => {
                                                            const newEdu = [...persona.education!];
                                                            newEdu[i].school = e.target.value;
                                                            setPersona({ ...persona, education: newEdu });
                                                        }}
                                                        className="font-medium text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 outline-none w-full md:w-4/12"
                                                        placeholder="Institution"
                                                    />
                                                    <input
                                                        value={edu.year}
                                                        onChange={(e) => {
                                                            const newEdu = [...persona.education!];
                                                            newEdu[i].year = e.target.value;
                                                            setPersona({ ...persona, education: newEdu });
                                                        }}
                                                        className="font-medium text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 outline-none w-full md:w-2/12"
                                                        placeholder="Year"
                                                    />
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div className="flex justify-end mt-8">
                                <button
                                    onClick={handlePersonaConfirm}
                                    disabled={uploading}
                                    className="bg-gray-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-black transition-colors flex items-center shadow-lg disabled:opacity-50"
                                >
                                    {uploading ? 'Updating Profile...' : 'Looks good! Next: Tailor to Job'}
                                    {!uploading && <ArrowRight className="w-5 h-5 ml-2" />}
                                </button>
                            </div>
                        </div>
                    </div>
                )
                }

                {/* Step 3: Tailor */}
                {
                    step === 3 && (
                        <div className="grid md:grid-cols-2 gap-8 lg:h-[700px]">
                            {/* Left: Persona Summary (Full Profile Review) */}
                            <div className="bg-white/50 rounded-2xl p-6 border border-white/20 overflow-y-auto flex flex-col gap-6 shadow-sm">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-1">{persona?.full_name}</h3>
                                    <p className="text-sm font-medium text-purple-600 mb-3">{persona?.professional_title}</p>
                                    <p className="text-sm text-gray-600 leading-relaxed font-serif italic border-l-4 border-purple-200 pl-3">
                                        {persona?.summary}
                                    </p>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-800 border-b pb-1 mb-3">Core Competencies</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {persona?.top_skills?.map((skill, i) => (
                                            <span key={i} className="bg-purple-50 text-purple-700 px-2 py-1 rounded-md border border-purple-100 text-xs font-medium">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {persona?.experience_highlights && persona.experience_highlights.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-gray-800 border-b pb-1 mb-3">Professional Experience</h4>
                                        <div className="space-y-4">
                                            {persona.experience_highlights.map((exp: any, i: number) => (
                                                <div key={i} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm transition hover:shadow-md">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h5 className="font-medium text-sm text-gray-800">{exp.role}</h5>
                                                        <span className="text-xs font-medium text-purple-500 whitespace-nowrap ml-2 bg-purple-50 px-1.5 py-0.5 rounded">{exp.duration}</span>
                                                    </div>
                                                    <p className="text-xs font-semibold text-gray-500 mb-2">{exp.company}</p>
                                                    <p className="text-xs text-gray-600 line-clamp-3">{exp.key_achievement}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {persona?.education && persona.education.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-gray-800 border-b pb-1 mb-3">Education</h4>
                                        <div className="space-y-2">
                                            {persona.education.map((edu: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm">
                                                    <div>
                                                        <h5 className="font-medium text-xs text-gray-800">{edu.degree}</h5>
                                                        <p className="text-xs text-gray-500">{edu.school}</p>
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-400">{edu.year}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right: JD Input & Customisation Options */}
                            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xl flex flex-col overflow-y-auto">
                                <h3 className="text-xl font-bold text-gray-800 mb-6">Hyper-Personalisation Engine</h3>

                                <div className="space-y-6 flex-1">
                                    {/* Job Description */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Target Job Description</label>
                                        <textarea
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none text-sm h-40"
                                            placeholder="Paste the target job description here..."
                                            value={jobDescription}
                                            onChange={(e) => setJobDescription(e.target.value)}
                                        />
                                        {/* Example JDs */}
                                        <div className="mt-2 text-right">
                                            <div className="flex flex-wrap justify-end gap-1.5">
                                                {(getDynamicRoles(persona) as string[]).map((role: string, i: number) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => setJobDescription(generateMockJD(role, persona))}
                                                        className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium px-2 py-1 rounded transition-colors"
                                                    >
                                                        {role}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Target Industry */}
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Target Industry</label>
                                            <select
                                                value={targetIndustry}
                                                onChange={(e) => setTargetIndustry(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 outline-none"
                                            >
                                                <option value="">Default (Auto-detect from JD)</option>
                                                <option value="Technology / SaaS">Technology / SaaS</option>
                                                <option value="Finance / Banking">Finance / Banking</option>
                                                <option value="Healthcare / MedTech">Healthcare / MedTech</option>
                                                <option value="Creative / Agency">Creative / Agency</option>
                                                <option value="Retail / E-commerce">Retail / E-commerce</option>
                                                <option value="Public Sector / NGO">Public Sector / NGO</option>
                                            </select>
                                        </div>

                                        {/* Focus Area */}
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Primary Focus Tone</label>
                                            <select
                                                value={focusArea}
                                                onChange={(e) => setFocusArea(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 outline-none"
                                            >
                                                <option value="">Standard ATS Optimisation</option>
                                                <option value="Storytelling Without Buzzword Overload">Storytelling (No Buzzword Overload)</option>
                                                <option value="Leadership & Strategy">Leadership & Strategy</option>
                                                <option value="Technical Depth & Execution">Technical Depth & Execution</option>
                                                <option value="Metrics & Revenue Focused">Metrics & Revenue Focused</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end">
                                    <button
                                        onClick={handleTailorResume}
                                        disabled={tailoring || !jobDescription}
                                        className={`bg-purple-600 text-white px-6 py-4 rounded-xl font-bold flex items-center shadow-lg hover:bg-purple-700 transition-all ${tailoring ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-1'}`}
                                    >
                                        {tailoring ? (
                                            <>
                                                <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
                                                Architecting Resume...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="w-5 h-5 mr-3 text-purple-200" />
                                                Generate Hyper-Personalised Resume
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                {step === 4 && tailoredContent && (
                    <div className="space-y-8">
                        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-xl">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                <h2 className="text-2xl font-bold text-gray-800">Final Review & Formatting</h2>

                                {/* ATS Score Display (Scaled for tailored output) & Regenerate */}
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={async () => {
                                            await handleTailorResume();
                                        }}
                                        disabled={tailoring}
                                        className={`text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold py-2.5 px-5 rounded-xl flex items-center shadow-sm transition-colors border border-purple-100 ${tailoring ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <RefreshCw className={`w-4 h-4 mr-2 ${tailoring ? 'animate-spin' : ''}`} />
                                        {tailoring ? 'Architecting...' : 'Regenerate Tailored Resume'}
                                    </button>

                                    {tailoredContent.ats_score !== undefined && (
                                        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ATS Match Score</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className={`text-2xl font-extrabold ${Math.min(98, tailoredContent.ats_score + 40) >= 80 ? 'text-green-500' : Math.min(98, tailoredContent.ats_score + 40) >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                                                        {Math.min(98, tailoredContent.ats_score + 40)}
                                                    </span>
                                                    <span className="text-sm text-gray-400 font-medium">/ 100</span>
                                                </div>
                                            </div>
                                            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-50 border-4" style={{ borderColor: Math.min(98, tailoredContent.ats_score + 40) >= 80 ? '#22c55e' : Math.min(98, tailoredContent.ats_score + 40) >= 60 ? '#f59e0b' : '#ef4444' }}>
                                                {Math.min(98, tailoredContent.ats_score + 40) >= 80 ? <CheckCircle className="w-6 h-6 text-green-500" /> : <AlertCircle className="w-6 h-6 text-amber-500" />}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Profile Picture Upload */}
                            <div className="mb-8 p-6 bg-purple-50 rounded-xl border border-purple-100 flex items-center gap-6">
                                <div className="w-24 h-24 rounded-full bg-white border-2 border-purple-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                    {profilePicBase64 ? (
                                        <img src={profilePicBase64} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <Upload className="w-8 h-8 text-purple-300" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-1">Add Profile Picture (Optional)</h3>
                                    <p className="text-sm text-gray-500 mb-3">Upload a professional headshot to include on your resume.</p>
                                    <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors inline-block">
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/jpeg, image/png"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => setProfilePicBase64(reader.result as string);
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                        Select Image...
                                    </label>
                                </div>
                            </div>

                            {/* Editable Tailored Results */}
                            <div className="grid md:grid-cols-2 gap-8 mb-8">
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-gray-800 border-b pb-2">Tailored Summary</h3>
                                    <textarea
                                        value={tailoredContent.summary}
                                        onChange={(e) => setTailoredContent({ ...tailoredContent, summary: e.target.value })}
                                        className="w-full text-gray-700 leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-3 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none h-40 resize-none text-sm font-serif"
                                    />

                                    <h3 className="font-semibold text-gray-800 border-b pb-2 mt-6">Tailored Skills</h3>
                                    <textarea
                                        value={(tailoredContent.top_skills || []).join(', ')}
                                        onChange={(e) => {
                                            const skills = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                            setTailoredContent({ ...tailoredContent, top_skills: skills });
                                        }}
                                        className="w-full text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 focus:border-purple-500 outline-none min-h-20 text-sm font-medium"
                                        placeholder="Comma-separated skills..."
                                    />

                                    <h3 className="font-semibold text-gray-800 border-b pb-2 mt-6">Tailored Experience (Generated Bullets)</h3>
                                    <div className="space-y-4 pt-2 max-h-[400px] overflow-y-auto pr-2">
                                        {tailoredContent.experience_highlights?.map((exp: any, i: number) => {
                                            const expText = typeof exp.key_achievement === 'string' ? exp.key_achievement
                                                : Array.isArray(exp.tailored_bullets) ? exp.tailored_bullets.join('\\n')
                                                    : Array.isArray(exp.key_achievement) ? exp.key_achievement.join('\\n')
                                                        : exp.key_achievement || '';
                                            return (
                                                <div key={i} className="bg-gray-50 border border-gray-200 p-3 rounded-lg shadow-sm">
                                                    <div className="font-semibold text-xs text-purple-700 mb-2 uppercase tracking-wide">{exp.role} <span className="text-gray-400 font-normal">at</span> {exp.company}</div>
                                                    <textarea
                                                        value={expText}
                                                        onChange={(e) => {
                                                            const newExp = [...tailoredContent.experience_highlights];
                                                            newExp[i].key_achievement = e.target.value;
                                                            setTailoredContent({ ...tailoredContent, experience_highlights: newExp });
                                                        }}
                                                        className="w-full text-gray-700 bg-white border border-gray-200 rounded p-2 text-xs leading-relaxed focus:border-purple-500 outline-none resize-none h-28"
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-semibold text-gray-800 border-b pb-2">Cover Letter Preview</h3>
                                    <textarea
                                        value={tailoredContent.cover_letter || ''}
                                        onChange={(e) => setTailoredContent({ ...tailoredContent, cover_letter: e.target.value })}
                                        className="w-full text-gray-700 leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-3 h-full min-h-[400px] resize-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none font-serif text-sm"
                                    />
                                </div>
                            </div>

                            {/* Template Selection — 3 premium templates */}
                            <h3 className="font-semibold text-gray-800 mb-2">Select Resume Template</h3>
                            <p className="text-sm text-gray-500 mb-4">Professionally benchmarked templates. Choose based on your career stage.</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                {[
                                    {
                                        id: 'professional',
                                        label: 'Professionally Crafted',
                                        badge: 'Most Popular',
                                        badgeColor: 'bg-blue-100 text-blue-800',
                                        audience: 'Mid-level, career switchers, global seekers',
                                        features: ['Clean navy single-column', 'ATS-optimised layout', 'Metric-driven prompts', 'Inline skills grid'],
                                    },
                                    {
                                        id: 'executive',
                                        label: 'Executive Level',
                                        badge: 'Senior & C-Suite',
                                        badgeColor: 'bg-amber-100 text-amber-800',
                                        audience: 'Directors, VPs, C-suite, Board members',
                                        features: ['Charcoal + gold accents', 'Split header layout', '3-column competency grid', 'Leadership-impact narrative'],
                                    },
                                    {
                                        id: 'fresher',
                                        label: 'Fresher / Student',
                                        badge: 'Career Starter',
                                        badgeColor: 'bg-teal-100 text-teal-800',
                                        audience: 'Students, new grads, bootcampers',
                                        features: ['Teal modern palette', 'Education-first order', 'Project-focused logic', 'Growth-oriented tone'],
                                    },
                                ].map(tpl => (
                                    <button
                                        key={tpl.id}
                                        onClick={() => setSelectedTemplate(tpl.id)}
                                        className={`p-5 rounded-xl border-2 text-left transition-all relative flex flex-col h-full ${selectedTemplate === tpl.id
                                            ? 'border-purple-600 bg-purple-50 shadow-md ring-1 ring-purple-100'
                                            : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="font-bold text-gray-900">{tpl.label}</span>
                                            {selectedTemplate === tpl.id && <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0" />}
                                        </div>
                                        <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full mb-3 self-start ${tpl.badgeColor}`}>
                                            {tpl.badge}
                                        </span>
                                        <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed italic">{tpl.audience}</p>
                                        <ul className="space-y-2 mt-auto">
                                            {tpl.features.map(f => (
                                                <li key={f} className="text-[11px] text-gray-600 flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-purple-400 flex-shrink-0" />
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                    </button>
                                ))}
                            </div>

                            <div className="border-t border-gray-100 pt-6 space-y-5">
                                {/* Page Length Toggle */}
                                <div className="flex items-center justify-center gap-3">
                                    <span className="text-sm font-medium text-gray-600">Resume Length:</span>
                                    <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                        {[
                                            { value: 1, label: '1 Page', desc: 'Compact' },
                                            { value: 2, label: '2 Pages', desc: 'Full Detail' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setPageCount(opt.value)}
                                                className={`px-5 py-2 text-sm font-semibold transition-all ${pageCount === opt.value
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {opt.label}
                                                <span className={`ml-1.5 text-xs font-normal ${pageCount === opt.value ? 'text-purple-200' : 'text-gray-400'}`}>
                                                    {opt.desc}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex justify-between items-center">
                                    <button onClick={() => setStep(3)} className="text-gray-500 hover:text-gray-800 font-medium px-4 py-2">
                                        ← Back to Tailor
                                    </button>
                                    <button
                                        onClick={handleGeneratePDF}
                                        disabled={generatingPDF}
                                        className={`bg-black text-white px-8 py-3 rounded-xl font-bold flex items-center shadow-lg hover:bg-gray-800 transition-all ${generatingPDF ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {generatingPDF ? (
                                            <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Generating Resume...</>
                                        ) : (
                                            <><Download className="w-5 h-5 mr-2" /> Finish & Generate Resume</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 5: Download */}
                {step === 5 && pdfUrl && (
                    <div className="max-w-xl mx-auto text-center space-y-8 py-12">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>

                        <div>
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Resume Ready!</h2>
                            <p className="text-gray-600">Your custom resume has been generated using the <span className="font-semibold capitalize">{selectedTemplate === 'executive' ? 'Executive Level' : 'Professionally Crafted'}</span> template.</p>
                        </div>

                        <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-xl">
                            <div className="flex items-center justify-between mb-4 border-b pb-4">
                                <span className="font-medium text-gray-700">Format</span>
                                <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-sm font-medium">PDF</span>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                                <span className="font-medium text-gray-700">Included</span>
                                <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-sm font-medium">
                                    {coverLetterUrl ? 'Cover Letter + Resume (Separate Files)' : 'Resume'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                            {/* Resume Section */}
                            <div className="flex flex-col gap-3">
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider text-center">Final Resume</h4>
                                <a
                                    href={pdfUrl || '#'}
                                    target="_blank"
                                    download={`CareerGini_Resume_${selectedTemplate}_${pageCount}p.pdf`}
                                    className="bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg flex justify-center items-center gap-2"
                                >
                                    <Download className="w-5 h-5" /> PDF Resume
                                </a>
                                <a
                                    href={docxUrl || '#'}
                                    download={`CareerGini_Resume_${selectedTemplate}_${pageCount}p.docx`}
                                    className="bg-white text-black border-2 border-black py-4 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-md flex justify-center items-center gap-2"
                                >
                                    <FileText className="w-5 h-5 text-blue-600" /> DOCX Resume
                                </a>
                            </div>

                            {/* Cover Letter Section */}
                            {coverLetterUrl && (
                                <div className="flex flex-col gap-3">
                                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider text-center">Cover Letter</h4>
                                    <a
                                        href={coverLetterUrl || '#'}
                                        target="_blank"
                                        download={`CareerGini_CL_${selectedTemplate}.pdf`}
                                        className="bg-purple-600 text-white py-4 rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg flex justify-center items-center gap-2"
                                    >
                                        <Download className="w-5 h-5" /> PDF Cover Letter
                                    </a>
                                    <a
                                        href={coverLetterDocxUrl || '#'}
                                        download={`CareerGini_CL_${selectedTemplate}.docx`}
                                        className="bg-white text-purple-600 border-2 border-purple-600 py-4 rounded-xl font-bold hover:bg-purple-50 transition-all shadow-md flex justify-center items-center gap-2"
                                    >
                                        <FileText className="w-5 h-5" /> DOCX Cover Letter
                                    </a>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setStep(4)}
                            className="text-gray-500 hover:text-gray-800 text-sm font-medium mt-4 lg:col-span-2 mx-auto transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 rounded"
                        >
                            ← Edit Design & Regenerate
                        </button>
                    </div>
                )}
            </div>

            {(uploading || tailoring || generatingPDF) && (
                <ProcessingOverlay
                    isOpen={true}
                    headline={persona?.professional_title}
                    skills={persona?.top_skills}
                />
            )}

            <DraftResumeModal
                isOpen={isDraftModalOpen}
                onClose={() => setIsDraftModalOpen(false)}
                onSave={handleDraftSave}
            />
            {/* Upgrade Prompt Modal */}
            <UpgradePromptModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                currentPlan={user?.plan || 'free'}
                buildCount={(user?.resume_count || 0)}
            />
        </div>
    );
};

export default ResumeBuilderPage;
