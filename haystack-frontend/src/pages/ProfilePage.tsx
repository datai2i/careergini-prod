import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, GraduationCap, MapPin, Mail, Phone, Edit2, Save, RefreshCw, Upload, FileText, Edit3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ProcessingOverlay } from '../components/common/ProcessingOverlay';
import { DraftResumeModal } from '../components/DraftResumeModal';

interface ProfileData {
    name: string;
    email: string;
    phone: string;
    location: string;
    title: string;
    bio: string;
    skills: string[];
    experience: any[] | string;
    education: any[] | string;
}

export const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();
    const { showToast } = useToast();
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [profile, setProfile] = useState<ProfileData>({
        name: 'Loading...',
        email: 'Loading...',
        phone: '',
        location: '',
        title: '',
        bio: '',
        skills: [],
        experience: '0',
        education: ''
    });

    // Fetch profile data from API
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = localStorage.getItem('auth_token');
                if (!token) {
                    setLoading(false);
                    return;
                }

                const response = await fetch('/api/profile/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) throw new Error('Failed to fetch profile');

                const data = await response.json();
                setProfile({
                    name: data.full_name || data.name || 'Your Name',
                    email: data.email || 'your.email@example.com',
                    phone: data.phone || '',
                    location: data.location || '',
                    title: data.headline || data.title || 'Your Professional Title',
                    bio: data.summary || data.bio || 'Tell us about yourself...',
                    skills: Array.isArray(data.skills) ? data.skills : [],
                    experience: data.experience || '0',
                    education: data.education || 'Your Education'
                });
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const saveProfile = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return;

            await fetch('/api/profile/profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    headline: profile.title,
                    summary: profile.bio,
                    location: profile.location,
                    skills: profile.skills,
                    experience: [],
                    education: []
                })
            });
            setEditing(false);
        } catch (error) {
            console.error('Error saving profile:', error);
        }
    };

    const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setUploading(true);
            const token = localStorage.getItem('auth_token');

            const formData = new FormData();
            formData.append('file', selectedFile);

            try {
                const response = await fetch(`/api/resume/upload?user_id=${user?.id}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData,
                });

                if (response.ok) {
                    showToast('Resume updated successfully!', 'success');
                    // Refresh user data in context to get latest_resume_filename and name
                    await refreshUser();
                    // Optionally re-fetch profile data if needed, but refreshUser() triggers re-render
                } else {
                    const data = await response.json();
                    showToast(data.detail || 'Upload failed', 'error');
                }
            } catch (err) {
                showToast('An error occurred during upload.', 'error');
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

            showToast('Draft saved successfully!', 'success');
            await refreshUser();
            setIsDraftModalOpen(false);

            // Re-fetch profile
            const profileResp = await fetch('/api/profile/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (profileResp.ok) {
                const data = await profileResp.json();
                setProfile({
                    name: data.full_name || data.name || 'Your Name',
                    email: data.email || 'your.email@example.com',
                    phone: data.phone || '',
                    location: data.location || '',
                    title: data.headline || data.title || 'Your Professional Title',
                    bio: data.summary || data.bio || 'Tell us about yourself...',
                    skills: Array.isArray(data.skills) ? data.skills : [],
                    experience: data.experience || '0',
                    education: data.education || 'Your Education'
                });
            }
        } catch (err: any) {
            console.error('Draft save failed:', err);
            showToast(err.message || 'Could not save drafted resume.', 'error');
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <ProcessingOverlay
                isOpen={uploading}
                message="Updating your profile and analyzing resume..."
                headline={profile.title}
            />
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/onboarding')}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-dark-border text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <RefreshCw size={18} /> Reset / Re-upload
                    </button>
                    <button
                        onClick={() => editing ? saveProfile() : setEditing(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {editing ? <><Save size={18} /> Save</> : <><Edit2 size={18} /> Edit</>}
                    </button>
                </div>
            </div>

            {/* Profile Card */}
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-200 dark:border-dark-border p-8">
                <div className="flex items-start gap-6 mb-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                        {profile.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                        {editing ? (
                            <>
                                <input
                                    type="text"
                                    value={profile.name}
                                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                    className="text-2xl font-bold mb-2 w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2"
                                />
                                <input
                                    type="text"
                                    value={profile.title}
                                    onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                                    className="text-lg text-gray-600 dark:text-gray-400 w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2"
                                />
                            </>
                        ) : (
                            <>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{profile.name}</h2>
                                <p className="text-lg text-gray-600 dark:text-gray-400">{profile.title}</p>
                            </>
                        )}
                    </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <Mail className="text-gray-400" size={20} />
                        {editing ? (
                            <input
                                type="email"
                                value={profile.email}
                                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2"
                            />
                        ) : (
                            <span className="text-gray-700 dark:text-gray-300">{profile.email}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <Phone className="text-gray-400" size={20} />
                        {editing ? (
                            <input
                                type="tel"
                                value={profile.phone}
                                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2"
                            />
                        ) : (
                            <span className="text-gray-700 dark:text-gray-300">{profile.phone}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <MapPin className="text-gray-400" size={20} />
                        {editing ? (
                            <input
                                type="text"
                                value={profile.location}
                                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2"
                            />
                        ) : (
                            <span className="text-gray-700 dark:text-gray-300">{profile.location}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <Briefcase className="text-gray-400" size={20} />
                        {editing ? (
                            <input
                                type="text"
                                value={typeof profile.experience === 'string' ? profile.experience : profile.experience.length + ' roles'}
                                onChange={(e) => setProfile({ ...profile, experience: e.target.value })}
                                placeholder="Years of experience"
                                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2"
                            />
                        ) : (
                            <span className="text-gray-700 dark:text-gray-300">
                                {typeof profile.experience === 'string'
                                    ? `${profile.experience} years experience`
                                    : Array.isArray(profile.experience)
                                        ? `${profile.experience.length} roles listed`
                                        : 'Experience details'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Bio */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">About Me</h3>
                    {editing ? (
                        <textarea
                            value={profile.bio}
                            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                            rows={4}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-4 py-3"
                        />
                    ) : (
                        <p className="text-gray-700 dark:text-gray-300">{profile.bio}</p>
                    )}
                </div>

                {/* Skills */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                        {profile.skills.map((skill, idx) => (
                            <span key={idx} className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Resume Management Section */}
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-200 dark:border-dark-border p-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <FileText className="text-purple-600" size={24} />
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Resume Management</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setIsDraftModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors font-medium border border-blue-200 dark:border-blue-800"
                        >
                            <Edit3 size={18} />
                            <span>Draft Manually</span>
                        </button>
                        <label className={`cursor-pointer flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {uploading ? <RefreshCw size={18} className="animate-spin" /> : <Upload size={18} />}
                            <span>{uploading ? 'Uploading...' : 'Upload New Resume'}</span>
                            <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.docx,.txt"
                                onChange={handleResumeUpload}
                                disabled={uploading}
                            />
                        </label>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-dashed border-gray-300 dark:border-gray-600">
                    {user?.latest_resume_filename ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                    <FileText className="text-purple-600 dark:text-purple-400" size={24} />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900 dark:text-white">{user.latest_resume_filename}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Current "Golden Record" resume</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => navigate('/builder')}
                                    className="px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                                >
                                    Use in Builder
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                            <p className="text-gray-500 dark:text-gray-400">No resume uploaded yet. Upload one to start building your professional profile.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Education */}
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-200 dark:border-dark-border p-8">
                <div className="flex items-center gap-3 mb-4">
                    <GraduationCap className="text-blue-600" size={24} />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Education</h3>
                </div>
                {editing ? (
                    <input
                        type="text"
                        value={typeof profile.education === 'string' ? profile.education : 'Detailed Education Records'}
                        onChange={(e) => setProfile({ ...profile, education: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-4 py-3"
                    />
                ) : (
                    <div className="text-gray-700 dark:text-gray-300">
                        {typeof profile.education === 'string' ? (
                            <p>{profile.education}</p>
                        ) : Array.isArray(profile.education) ? (
                            <ul className="list-disc list-inside space-y-2">
                                {profile.education.map((edu, idx) => (
                                    <li key={idx}>
                                        {edu?.degree || edu?.title} - {edu?.school || edu?.institution} {edu?.year ? `(${edu.year})` : ''}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>Education Details</p>
                        )}
                    </div>
                )}
            </div>

            <DraftResumeModal
                isOpen={isDraftModalOpen}
                onClose={() => setIsDraftModalOpen(false)}
                onSave={handleDraftSave}
            />
        </div>
    );
};
