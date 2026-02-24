import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';

export const AuthCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();
    const [error, setError] = React.useState<string | null>(null);

    useEffect(() => {
        const handleLogin = async () => {
            const token = searchParams.get('token');
            if (token) {
                try {
                    const user = await login(token);
                    // Smart redirect based on onboarding status
                    if (user && user.onboarding_completed) {
                        navigate('/home');
                    } else {
                        navigate('/onboarding');
                    }
                } catch (error: any) {
                    console.error('Login failed during callback:', error);
                    setError(error.message || 'Authentication failed');
                }
            } else {
                navigate('/login');
            }
        };

        handleLogin();
    }, [searchParams, login, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg">
            <div className="text-center">
                {error ? (
                    <div className="p-8 bg-white dark:bg-dark-card rounded-2xl shadow-xl border border-red-100 dark:border-red-900/30 max-w-md mx-auto">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                            <AlertCircle size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Authentication Error</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-8">{error}</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-bold shadow-lg shadow-red-600/30"
                        >
                            Back to Login
                        </button>
                    </div>
                ) : (
                    <>
                        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            Authenticating...
                        </h2>
                    </>
                )}
            </div>
        </div>
    );
};
