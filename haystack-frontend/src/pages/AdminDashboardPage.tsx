import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import {
    Users,
    MessageSquare,
    Shield,
    MoreVertical,
    RefreshCw,
    Search,
    Star,
    X,
    FileText,
    Check,
    Download
} from 'lucide-react';

interface Stats {
    total_users: number;
    activity_breakdown: { activity_type: string; count: string }[];
    plans: { plan: string; count: string }[];
}

interface AdminUser {
    id: string;
    email: string;
    full_name: string;
    role: 'user' | 'admin';
    plan: 'free' | 'basic' | 'premium';
    created_at: string;
    last_login_at: string | null;
    login_count: number;
    resume_count: string;
    last_active: string | null;
    latest_resume_path: string | null;
}

interface ChatLog {
    id: string;
    user_email: string;
    session_id: string;
    message: string;
    response: string;
    agent_name: string;
    created_at: string;
}

export const AdminDashboardPage: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'chats'>('overview');
    const [stats, setStats] = useState<Stats | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [chats, setChats] = useState<ChatLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [openActionId, setOpenActionId] = useState<string | null>(null);

    const fetchStats = async () => {
        try {
            const resp = await fetch('/api/profile/admin/stats', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            });
            if (resp.ok) setStats(await resp.json());
        } catch (e) { console.error(e); }
    };

    const fetchUsers = async () => {
        try {
            const resp = await fetch('/api/profile/admin/users', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            });
            if (resp.ok) setUsers(await resp.json());
        } catch (e) { console.error(e); }
    };

    const fetchChats = async () => {
        try {
            const resp = await fetch('/api/profile/admin/logs/chats', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            });
            if (resp.ok) setChats(await resp.json());
        } catch (e) { console.error(e); }
    };

    const updateUser = async (userId: string, data: Partial<AdminUser>) => {
        try {
            const resp = await fetch(`/api/profile/admin/users/${userId}/update`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                showToast('User updated successfully');
                fetchUsers();
            } else {
                showToast('Update failed', 'error');
            }
        } catch (e) {
            showToast('Update error', 'error');
        }
    };

    const refreshData = async () => {
        setLoading(true);
        await Promise.all([fetchStats(), fetchUsers(), fetchChats()]);
        setLoading(false);
    };

    useEffect(() => {
        refreshData();
    }, []);

    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                        <Shield className="w-8 h-8 text-blue-600" />
                        Admin Oversight
                    </h1>
                    <p className="text-slate-500 mt-1">Platform analytics and user management dashboard.</p>
                </div>
                <button
                    onClick={refreshData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Data
                </button>
            </div>

            {/* Quick Stats Bars */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 text-slate-500 mb-2">
                        <Users className="w-5 h-5" />
                        <span className="text-sm font-medium">Total Users</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{stats?.total_users || 0}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 text-slate-500 mb-2">
                        <FileText className="w-5 h-5 text-amber-500" />
                        <span className="text-sm font-medium">Resumes Built</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">
                        {stats?.activity_breakdown?.find(a => a.activity_type === 'resume_generated')?.count || 0}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 text-slate-500 mb-2">
                        <MessageSquare className="w-5 h-5 text-blue-500" />
                        <span className="text-sm font-medium">Gini Interactions</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{chats.length}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 text-slate-500 mb-2">
                        <Download className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-medium">Premium Ratio</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">
                        {stats?.total_users ? Math.round(((parseInt(stats?.plans?.find(p => p.plan === 'premium')?.count || '0')) / stats.total_users) * 100) : 0}%
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200">
                <div className="flex gap-8">
                    {[
                        { id: 'overview', icon: Download, label: 'Overview' },
                        { id: 'users', icon: Check, label: 'User Management' },
                        { id: 'chats', icon: MessageSquare, label: 'Chat Audit' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-all ${activeTab === tab.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">

                {activeTab === 'overview' && (
                    <div className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-slate-900">Subscription Mix</h3>
                                <div className="space-y-3">
                                    {stats?.plans?.map(p => (
                                        <div key={p.plan} className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="capitalize text-slate-600">{p.plan}</span>
                                                <span className="font-semibold">{p.count} users</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${p.plan === 'premium' ? 'bg-blue-600' : p.plan === 'basic' ? 'bg-amber-500' : 'bg-slate-400'}`}
                                                    style={{ width: `${stats?.total_users ? (parseInt(p.count) / stats.total_users) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Admin Best Practices</h3>
                                <ul className="space-y-3 text-sm text-slate-600">
                                    <li className="flex gap-2">
                                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                        Monitor Gini interactions for quality of advice.
                                    </li>
                                    <li className="flex gap-2">
                                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                        Review "Free" user activity to identify upsell opportunities.
                                    </li>
                                    <li className="flex gap-2">
                                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                        Ensure Premium users have generated at least one resume.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="flex flex-col h-full">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Found {filteredUsers.length} users</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Logins</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Activity</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-900">{u.full_name || 'No Name'}</span>
                                                    <span className="text-sm text-slate-500">{u.email}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={u.plan}
                                                    onChange={(e) => updateUser(u.id, { plan: e.target.value as any })}
                                                    className={`text-xs font-bold px-2 py-1 rounded-full border-0 focus:ring-2 focus:ring-blue-500/20 capitalize ${u.plan === 'premium' ? 'bg-blue-100 text-blue-700' :
                                                            u.plan === 'basic' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-slate-100 text-slate-700'
                                                        }`}
                                                >
                                                    <option value="free">Free</option>
                                                    <option value="basic">Basic</option>
                                                    <option value="premium">Premium</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-medium text-slate-700">{u.login_count || 0} logins</span>
                                                    <span className="text-[10px] text-slate-400">
                                                        Last: {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
                                                        <FileText className="w-3 h-3 text-amber-500" /> {u.resume_count} Resumes
                                                    </span>
                                                    {u.latest_resume_path && (
                                                        <a
                                                            href={`/api/uploads/${u.id}/tailored_resume.pdf`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
                                                        >
                                                            Download Latest
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={u.role === 'admin'}
                                                        onChange={(e) => updateUser(u.id, { role: e.target.checked ? 'admin' : 'user' })}
                                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className={`text-xs font-medium ${u.role === 'admin' ? 'text-blue-600' : 'text-slate-500'}`}>{u.role}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right relative">
                                                <button
                                                    onClick={() => setOpenActionId(openActionId === u.id ? null : u.id)}
                                                    className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>

                                                {openActionId === u.id && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-10"
                                                            onClick={() => setOpenActionId(null)}
                                                        ></div>
                                                        <div className="absolute right-6 top-12 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 py-2 text-left animate-in fade-in zoom-in-95 duration-200">
                                                            <button
                                                                onClick={() => {
                                                                    updateUser(u.id, { plan: 'premium' });
                                                                    setOpenActionId(null);
                                                                }}
                                                                className="w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                            >
                                                                <Star className="w-4 h-4 text-amber-500" /> Upgrade to Premium
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    updateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' });
                                                                    setOpenActionId(null);
                                                                }}
                                                                className="w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                            >
                                                                <Shield className="w-4 h-4 text-blue-600" />
                                                                {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                                                            </button>
                                                            <div className="h-px bg-slate-100 my-1"></div>
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm('Are you sure you want to deactivate this user?')) {
                                                                        showToast('Account deactivation pending implementation', 'info');
                                                                    }
                                                                    setOpenActionId(null);
                                                                }}
                                                                className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                            >
                                                                <X className="w-4 h-4" /> Deactivate User
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'chats' && (
                    <div className="divide-y divide-slate-100">
                        {chats.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">No chat history available.</div>
                        ) : (
                            chats.map(log => (
                                <div key={log.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                                                {log.user_email?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="text-sm font-semibold text-slate-900">{log.user_email}</span>
                                                <span className="mx-2 text-slate-300">·</span>
                                                <span className="text-xs text-slate-500">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] px-2 py-1 bg-slate-100 text-slate-500 rounded font-mono uppercase">
                                            Agent: {log.agent_name}
                                        </span>
                                    </div>
                                    <div className="space-y-4 ml-11">
                                        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                                            <p className="text-sm text-slate-700 italic">"{log.message}"</p>
                                        </div>
                                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                                            <p className="text-sm text-slate-800">{log.response?.substring(0, 300)}{log.response?.length > 300 ? '...' : ''}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};
