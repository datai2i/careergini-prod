import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, Download, ArrowRight, RefreshCw, AlertCircle, History, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notifyStep, requestNotificationPermission } from '../utils/notify';
import { ProcessingOverlay } from '../components/common/ProcessingOverlay';
import { useToast } from '../context/ToastContext';

interface ResumePersona {
    full_name: string;
    professional_title: string;
    years_experience: number;
    summary: string;
    top_skills: string[];
    experience_highlights: Array<{
        role: string;
        company: string;
        duration: string;
        key_achievement: string;
    }>;
    education?: Array<{
        degree: string;
        school: string;
        year: string;
    }>;
}

export const ResumeBuilderPage: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const { showToast } = useToast();
    const [step, setStep] = useState(1);
    const [uploading, setUploading] = useState(false);
    const [persona, setPersona] = useState<ResumePersona | null>(null);
    const [jobDescription, setJobDescription] = useState('');
    const [tailoring, setTailoring] = useState(false);
    const [tailoredContent, setTailoredContent] = useState<any>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('classic');
    const [profilePicBase64, setProfilePicBase64] = useState<string | null>(null);
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pageCount, setPageCount] = useState<number>(2);
    const [sessions, setSessions] = useState<Array<{ session_id: string; timestamp: string; job_title_snippet: string }>>([]);
    const [loadingSession, setLoadingSession] = useState(false);

    // Load existing persona on mount
    useEffect(() => {
        // Ask for notification permission as soon as the user enters the builder
        requestNotificationPermission();

        if (user) {
            fetch(`/api/resume/persona/${user.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        setPersona(data.persona);
                        // Note: don't auto-skip to step 2; keep step 1 so they can see history too
                    }
                })
                .catch(err => console.error(err));

            // Load session history
            fetch(`/api/resume/sessions/${user.id}`)
                .then(res => res.json())
                .then(data => { if (data.sessions) setSessions(data.sessions); })
                .catch(err => console.error('Sessions load error:', err));
        }
    }, [user]);

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
                        summary: persona.summary,
                        top_skills: persona.top_skills,
                        experience_highlights: persona.experience_highlights,
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
                    persona: persona
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
                    experience_highlights: data.tailored_content.tailored_experience || persona?.experience_highlights
                };

                setTailoredContent(completeTailoredPersona);
                setStep(4);
                notifyStep('✅ Resume Tailored!', 'Your resume has been customised for the job. Review and generate your PDF.');
                showToast('Resume tailored to the job!', 'success');
                // Refresh sessions list after successful tailoring
                fetch(`/api/resume/sessions/${user?.id || 'default'}`)
                    .then(r => r.json()).then(d => { if (d.sessions) setSessions(d.sessions); });
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
                    job_description: jobDescription, // Pass to fulfill schema, though mostly unused here
                    persona: tailoredContent,
                    template: selectedTemplate,
                    profile_pic: profilePicBase64,
                    page_count: pageCount,
                })
            });

            const pdfData = await pdfResponse.json();
            if (pdfResponse.ok) {
                setPdfUrl(pdfData.pdf_url);
                setStep(5);
                notifyStep('🎉 PDF Ready!', 'Your professional resume PDF has been generated. Click to download!');
                showToast('PDF ready to download! 🎉', 'success');
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
        <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fadeIn">
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
                    <div className="text-sm text-gray-500">
                        Step {step} of 4
                    </div>
                </div>
            </div>

            {/* Steps Progress */}
            <div className="flex justify-between max-w-2xl mx-auto mb-8 relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10"></div>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold 
                 ${step >= i ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {i}
                    </div>
                ))}
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center">
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

                        {/* Card 1: Upload New Resume */}
                        <div className="bg-white/60 backdrop-blur-sm border-2 border-purple-100 hover:border-purple-400 rounded-2xl p-7 flex flex-col items-center text-center shadow-md hover:shadow-lg transition-all group">
                            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                                <Upload className="w-8 h-8 text-purple-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">Upload New Resume</h3>
                            <p className="text-sm text-gray-500 mb-5 flex-1">
                                Start fresh. We'll parse your resume and guide you through all 4 steps to tailor and generate your perfect resume.
                            </p>
                            <label className="cursor-pointer w-full text-center bg-gradient-to-r from-purple-600 to-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition-all inline-flex items-center justify-center shadow">
                                {uploading ? (
                                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                                ) : (
                                    <><FileText className="w-4 h-4 mr-2" /> Choose File</>
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

                        <div className="mb-6 bg-purple-50 p-4 rounded-xl border border-purple-100 transition-all focus-within:ring-2 focus-within:ring-purple-200">
                            <h3 className="text-sm font-semibold text-purple-800 mb-2 uppercase tracking-wide">Professional Summary</h3>
                            <textarea
                                value={persona.summary}
                                onChange={(e) => setPersona({ ...persona, summary: e.target.value })}
                                className="w-full text-gray-700 leading-relaxed bg-transparent border-none focus:ring-0 resize-none h-24"
                                placeholder="Write your compelling professional summary here..."
                            />
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
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
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
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
            )}

            {/* Step 3: Tailor */}
            {step === 3 && (
                <div className="grid md:grid-cols-2 gap-8 h-[600px]">
                    {/* Left: Persona Summary */}
                    <div className="bg-white/50 rounded-2xl p-6 border border-white/20 overflow-y-auto">
                        <h3 className="font-semibold text-gray-700 mb-4">Your Profile</h3>
                        <p className="text-sm text-gray-600 mb-4">{persona?.summary}</p>
                        <div className="flex flex-wrap gap-2">
                            {persona?.top_skills?.map((skill, i) => (
                                <span key={i} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Right: JD Input */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xl flex flex-col">
                        <h3 className="font-semibold text-gray-800 mb-2">Target Job Description</h3>
                        <textarea
                            className="flex-1 w-full bg-gray-50 border border-gray-200 rounded-xl p-4 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none text-sm mb-4"
                            placeholder="Paste the job description here..."
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                        />

                        {/* Example JDs */}
                        <div className="mb-4">
                            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Or select an example:</p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { label: "Software Engineer", jd: "We are looking for a Software Engineer with experience in React, Node.js, and Python. You will build scalable web applications and collaborate with cross-functional teams." },
                                    { label: "Product Manager", jd: "Seeking a Product Manager to lead our mobile app development. Must have experience with agile methodologies, user research, and roadmap planning." },
                                    { label: "Data Scientist", jd: "Join our data team to build predictive models. Proficiency in Python, SQL, and machine learning frameworks (scikit-learn, TensorFlow) is required." },
                                    { label: "Marketing Specialist", jd: "We need a Marketing Specialist to drive our digital campaigns. Experience with SEO, content marketing, and social media analytics is a plus." }
                                ].map((example, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setJobDescription(example.jd)}
                                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors border border-gray-200"
                                    >
                                        {example.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-auto flex justify-end">
                            <button
                                onClick={handleTailorResume}
                                disabled={tailoring || !jobDescription}
                                className={`bg-purple-600 text-white px-6 py-3 rounded-xl font-medium flex items-center shadow-lg hover:bg-purple-700 transition-all ${tailoring ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {tailoring ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                                        Tailoring & Writing Cover Letter...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-5 h-5 mr-2" />
                                        Generate Tailored Resume
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4: Final Review & Formatting */}
            {step === 4 && tailoredContent && (
                <div className="space-y-8">
                    <div className="bg-white/70 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-xl">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Final Review & Formatting</h2>

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
                                    className="w-full text-gray-700 leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-3 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none h-40 resize-none"
                                />

                                <h3 className="font-semibold text-gray-800 border-b pb-2 mt-6">Tailored Skills</h3>
                                <textarea
                                    value={(tailoredContent.top_skills || []).join(', ')}
                                    onChange={(e) => {
                                        const skills = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                        setTailoredContent({ ...tailoredContent, top_skills: skills });
                                    }}
                                    className="w-full text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 focus:border-purple-500 outline-none min-h-20"
                                    placeholder="Comma-separated skills..."
                                />
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold text-gray-800 border-b pb-2">Cover Letter Preview</h3>
                                <textarea
                                    value={tailoredContent.cover_letter || ''}
                                    onChange={(e) => setTailoredContent({ ...tailoredContent, cover_letter: e.target.value })}
                                    className="w-full text-gray-700 leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-3 h-[300px] resize-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none font-serif text-sm"
                                />
                            </div>
                        </div>

                        {/* Template Selection */}
                        <h3 className="font-semibold text-gray-800 mb-4">Select Professional Template</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            {[
                                { id: 'classic', label: 'Classic', desc: 'Serif fonts, traditional top-down format.' },
                                { id: 'modern', label: 'Modern', desc: 'Clean sans-serif with an accent colored sidebar.' },
                                { id: 'creative', label: 'Creative', desc: 'Bold colors, structured layout.' },
                                { id: 'minimalist', label: 'Minimalist', desc: 'High whitespace, elegant grayscale.' }
                            ].map(tpl => (
                                <button
                                    key={tpl.id}
                                    onClick={() => setSelectedTemplate(tpl.id)}
                                    className={`p-4 rounded-xl border-2 text-left transition-all relative ${selectedTemplate === tpl.id
                                        ? 'border-purple-600 bg-purple-50 shadow-md ring-2 ring-purple-100'
                                        : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow'
                                        }`}
                                >
                                    <div className="aspect-[1/1.4] w-full bg-gray-100 mb-3 rounded-md overflow-hidden border border-gray-200 shadow-sm relative group">
                                        <img src={`/templates/${tpl.id}.png`} alt={`${tpl.label} Layout`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                    </div>
                                    <div className="font-bold text-gray-800 mb-1 flex items-center justify-between">
                                        {tpl.label}
                                        {selectedTemplate === tpl.id && (
                                            <CheckCircle className="w-4 h-4 text-purple-600" />
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 leading-tight">{tpl.desc}</div>
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
                                        <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Generating PDF...</>
                                    ) : (
                                        <><Download className="w-5 h-5 mr-2" /> Finish & Generate PDF</>
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
                        <p className="text-gray-600">Your custom resume has been generated using the {selectedTemplate} template.</p>
                    </div>

                    <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-xl">
                        <div className="flex items-center justify-between mb-4 border-b pb-4">
                            <span className="font-medium text-gray-700">Format</span>
                            <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-sm font-medium">PDF</span>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                            <span className="font-medium text-gray-700">Included</span>
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-sm font-medium">Cover Letter + Resume</span>
                        </div>
                    </div>

                    <a
                        href={pdfUrl}
                        target="_blank"
                        download={`Tailored_Resume_${selectedTemplate}.pdf`}
                        className="block w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                        <Download className="w-6 h-6 inline-block mr-2" />
                        Download PDF
                    </a>

                    <button
                        onClick={() => setStep(4)}
                        className="text-gray-500 hover:text-gray-800 text-sm font-medium mt-4"
                    >
                        ← Edit Design & Regenerate
                    </button>
                </div>
            )}
        </div>
    );
};


