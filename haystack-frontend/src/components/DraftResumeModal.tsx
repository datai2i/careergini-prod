import React, { useState } from 'react';
import { X, CheckCircle2, Plus, Trash2, AlertCircle } from 'lucide-react';

interface DraftResumeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (draftData: any) => Promise<void>;
}

export const DraftResumeModal: React.FC<DraftResumeModalProps> = ({ isOpen, onClose, onSave }) => {
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [fullName, setFullName] = useState('');
    const [title, setTitle] = useState('');
    const [summary, setSummary] = useState('');
    const [skills, setSkills] = useState('');

    // Contact Info
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [location, setLocation] = useState('');
    const [linkedin, setLinkedin] = useState('');
    const [portfolioUrl, setPortfolioUrl] = useState('');

    const [experience, setExperience] = useState([{ role: '', company: '', duration: '', highlights: '' }]);
    const [projects, setProjects] = useState([{ name: '', description: '' }]);
    const [education, setEducation] = useState([{ degree: '', school: '', year: '' }]);

    if (!isOpen) return null;

    const handleAddExperience = () => {
        setExperience([...experience, { role: '', company: '', duration: '', highlights: '' }]);
    };

    const handleRemoveExperience = (index: number) => {
        setExperience(experience.filter((_, i) => i !== index));
    };

    const handleExpChange = (index: number, field: string, value: string) => {
        const newExp = [...experience];
        newExp[index] = { ...newExp[index], [field]: value };
        setExperience(newExp);
    };

    const handleAddProject = () => {
        setProjects([...projects, { name: '', description: '' }]);
    };

    const handleRemoveProject = (index: number) => {
        setProjects(projects.filter((_, i) => i !== index));
    };

    const handleProjChange = (index: number, field: string, value: string) => {
        const newProj = [...projects];
        newProj[index] = { ...newProj[index], [field]: value };
        setProjects(newProj);
    };

    const handleAddEducation = () => {
        setEducation([...education, { degree: '', school: '', year: '' }]);
    };

    const handleRemoveEducation = (index: number) => {
        setEducation(education.filter((_, i) => i !== index));
    };

    const handleEduChange = (index: number, field: string, value: string) => {
        const newEdu = [...education];
        newEdu[index] = { ...newEdu[index], [field]: value };
        setEducation(newEdu);
    };

    const handleNextOrSubmit = () => {
        if (step === 1) {
            if (email && !/^\S+@\S+\.\S+$/.test(email)) {
                setError("Please enter a valid email address containing an '@' and a domain.");
                return;
            }
            if (linkedin && /\s/.test(linkedin)) {
                setError("LinkedIn URL should not contain spaces. Make sure it looks like a valid link.");
                return;
            }
            if (portfolioUrl && /\s/.test(portfolioUrl)) {
                setError("Portfolio/GitHub URL should not contain spaces.");
                return;
            }
        }

        setError(null);

        if (step < 4) {
            setStep(step + 1);
        } else {
            handleSubmit();
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            // Format skills array
            const topSkills = skills.split(',').map(s => s.trim()).filter(Boolean);

            // Format experience highlights (split by newline or bullet if needed, or keep as single string)
            const formattedExp = experience.filter(e => e.role && e.company).map(e => ({
                role: e.role,
                company: e.company,
                duration: e.duration,
                key_achievement: e.highlights
            }));

            const formattedProj = projects.filter(p => p.name).map(p => ({
                name: p.name,
                description: p.description
            }));

            const formattedEdu = education.filter(e => e.degree && e.school);

            const payload = {
                full_name: fullName,
                professional_title: title,
                summary: summary,
                top_skills: topSkills,
                email: email,
                phone: phone,
                location: location,
                linkedin: linkedin,
                portfolio_url: portfolioUrl,
                experience_highlights: formattedExp,
                projects: formattedProj,
                education: formattedEdu
            };

            await onSave(payload);
        } catch (err: any) {
            console.error('Failed to save draft:', err);
            setError(err.message || 'Failed to save drafting data. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-dark-card w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-xl flex flex-col overflow-hidden border border-gray-200 dark:border-dark-border">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border flex items-center justify-between bg-gray-50 dark:bg-dark-bg/50">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        Draft Your Resume
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-dark-bg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {error && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-start gap-2 border border-red-100 dark:border-red-900/30 font-medium">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <p>{error}</p>
                    </div>
                )}

                {/* Progress Steps */}
                <div className="px-6 pt-4 pb-2">
                    <div className="flex items-center justify-between relative">
                        <div className="absolute left-0 top-1/2 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -z-10 -translate-y-1/2"></div>
                        <div className="absolute left-0 top-1/2 h-0.5 bg-blue-500 -z-10 -translate-y-1/2 transition-all duration-300" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>

                        {[1, 2, 3, 4].map((num) => (
                            <div key={num} onClick={() => setStep(num)} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm cursor-pointer transition-colors ${step >= num ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                {step > num ? <CheckCircle2 size={16} /> : num}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
                        <span>Basic Info</span>
                        <span>Experience</span>
                        <span>Projects</span>
                        <span>Education</span>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {step === 1 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" className="w-full px-4 py-2 bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Professional Title</label>
                                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Software Engineer" className="w-full px-4 py-2 bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Email <span className="font-normal text-gray-400 font-serif italic">(Optional)</span></label>
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded focus:border-blue-500 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Phone <span className="font-normal text-gray-400 font-serif italic">(Optional)</span></label>
                                    <input type="tel" value={phone} onChange={e => {
                                        const val = e.target.value.replace(/[^\d\s+\-()]/g, '');
                                        setPhone(val);
                                    }} placeholder="(555) 123-4567" className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded focus:border-blue-500 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Location <span className="font-normal text-gray-400 font-serif italic">(Optional)</span></label>
                                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="New York, NY" className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded focus:border-blue-500 dark:text-white" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">LinkedIn URL <span className="font-normal text-gray-400 font-serif italic">(Optional)</span></label>
                                    <input type="url" value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="linkedin.com/in/janedoe" className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded focus:border-blue-500 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Portfolio/GitHub URL <span className="font-normal text-gray-400 font-serif italic">(Optional)</span></label>
                                    <input type="url" value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} placeholder="github.com/janedoe" className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded focus:border-blue-500 dark:text-white" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Top Skills (comma separated)</label>
                                <input type="text" value={skills} onChange={e => setSkills(e.target.value)} placeholder="React, Node.js, TypeScript, UI/UX" className="w-full px-4 py-2 bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Professional Summary</label>
                                <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={4} placeholder="Briefly describe your career background and what you bring to the table." className="w-full px-4 py-2 bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white resize-none"></textarea>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            {experience.map((exp, index) => (
                                <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl relative bg-gray-50/50 dark:bg-dark-bg/50">
                                    {experience.length > 1 && (
                                        <button onClick={() => handleRemoveExperience(index)} className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pr-6">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Role Title</label>
                                            <input type="text" value={exp.role} onChange={e => handleExpChange(index, 'role', e.target.value)} placeholder="Software Engineer" className="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg focus:border-blue-500 dark:text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Company</label>
                                            <input type="text" value={exp.company} onChange={e => handleExpChange(index, 'company', e.target.value)} placeholder="Acme Corp" className="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg focus:border-blue-500 dark:text-white" />
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Duration</label>
                                        <input type="text" value={exp.duration} onChange={e => handleExpChange(index, 'duration', e.target.value)} placeholder="Jan 2020 - Present" className="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg focus:border-blue-500 dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Key Achievements</label>
                                        <textarea value={exp.highlights} onChange={e => handleExpChange(index, 'highlights', e.target.value)} rows={2} placeholder="Led the development of a new microservices architecture..." className="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg focus:border-blue-500 dark:text-white resize-none"></textarea>
                                    </div>
                                </div>
                            ))}

                            <button onClick={handleAddExperience} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-dashed border-blue-300 dark:border-blue-800 rounded-lg w-full justify-center py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                <Plus size={16} /> Add Another Role
                            </button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            {projects.map((proj, index) => (
                                <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl relative bg-gray-50/50 dark:bg-dark-bg/50">
                                    {projects.length > 1 && (
                                        <button onClick={() => handleRemoveProject(index)} className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    <div className="mb-4 pr-6">
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Project Name</label>
                                        <input type="text" value={proj.name} onChange={e => handleProjChange(index, 'name', e.target.value)} placeholder="E-Commerce API" className="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg focus:border-blue-500 dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description & Tools</label>
                                        <textarea value={proj.description} onChange={e => handleProjChange(index, 'description', e.target.value)} rows={3} placeholder="Built a highly scalable matching engine using Node and Redis..." className="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg focus:border-blue-500 dark:text-white resize-none"></textarea>
                                    </div>
                                </div>
                            ))}

                            <button onClick={handleAddProject} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-dashed border-blue-300 dark:border-blue-800 rounded-lg w-full justify-center py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                <Plus size={16} /> Add Another Project
                            </button>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            {education.map((edu, index) => (
                                <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl relative bg-gray-50/50 dark:bg-dark-bg/50">
                                    {education.length > 1 && (
                                        <button onClick={() => handleRemoveEducation(index)} className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pr-6">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Degree</label>
                                            <input type="text" value={edu.degree} onChange={e => handleEduChange(index, 'degree', e.target.value)} placeholder="B.S. Computer Science" className="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg focus:border-blue-500 dark:text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">School</label>
                                            <input type="text" value={edu.school} onChange={e => handleEduChange(index, 'school', e.target.value)} placeholder="State University" className="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg focus:border-blue-500 dark:text-white" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Graduation Year</label>
                                        <input type="text" value={edu.year} onChange={e => handleEduChange(index, 'year', e.target.value)} placeholder="2019" className="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg focus:border-blue-500 dark:text-white" />
                                    </div>
                                </div>
                            ))}

                            <button onClick={handleAddEducation} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-dashed border-blue-300 dark:border-blue-800 rounded-lg w-full justify-center py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                <Plus size={16} /> Add Another Degree
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg/30 flex justify-between items-center">
                    <button
                        onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                        className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        disabled={submitting}
                    >
                        {step === 1 ? 'Cancel' : 'Back'}
                    </button>

                    <button
                        onClick={handleNextOrSubmit}
                        disabled={submitting || (step === 1 && (!fullName || !title))}
                        className={`px-6 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-all ${submitting || (step === 1 && (!fullName || !title)) ? 'bg-blue-400 cursor-not-allowed text-white' : 'bg-blue-600 hover:bg-blue-700 hover:shadow shadow-blue-500/20 text-white'}`}
                    >
                        {submitting ? 'Saving Draft...' : (step < 4 ? 'Continue' : 'Save & Publish')}
                    </button>
                </div>
            </div>
        </div>
    );
};
