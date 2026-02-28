import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileText, Download, Calendar, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface ResumeHistory {
    id: string;
    title?: string;
    date: string;
    pdf_url: string;
    docx_url: string;
}

export const MyResumesPage: React.FC = () => {
    const { user } = useAuth();
    const [resumes, setResumes] = useState<ResumeHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const fetchHistory = async () => {
            try {
                const response = await fetch(`/api/resume/history/${user.id}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch resume history');
                }

                const data = await response.json();
                setResumes(data.resumes || []);
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Failed to load resumes');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [user]);

    // Backend provides relative /api/uploads/ URLs which the gateway proxies
    const getDownloadUrl = (path: string) => {
        return path;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[50vh]">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <FileText size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Resumes</h1>
                    <p className="text-gray-500">Access your previously generated resumes (up to the last 20).</p>
                </div>
            </div>

            {error ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center justify-center">
                    {error}
                </div>
            ) : resumes.length === 0 ? (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-12 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-gray-900 font-medium mb-1">No resumes yet</h3>
                    <p className="text-gray-500 text-sm">You haven't generated any tailored resumes yet. Go to the Resume Builder to get started.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-500">
                            <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-700 font-semibold">
                                <tr>
                                    <th scope="col" className="px-6 py-4">Resume Name</th>
                                    <th scope="col" className="px-6 py-4">Date Generated</th>
                                    <th scope="col" className="px-6 py-4 text-center">PDF</th>
                                    <th scope="col" className="px-6 py-4 text-center">DOCX</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {resumes.map((resume, idx) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        key={resume.id}
                                        className="hover:bg-blue-50/30 transition-colors group"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                                    <FileText size={16} />
                                                </div>
                                                <span className="text-gray-900 font-medium">
                                                    {resume.title || 'Tailored Resume'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-gray-500">
                                                <Calendar size={14} />
                                                {resume.date}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <a
                                                href={getDownloadUrl(resume.pdf_url)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold transition-colors border border-red-100"
                                            >
                                                <Download size={14} /> PDF
                                            </a>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <a
                                                href={getDownloadUrl(resume.docx_url)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors border border-blue-100"
                                            >
                                                <Download size={14} /> DOCX
                                            </a>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
