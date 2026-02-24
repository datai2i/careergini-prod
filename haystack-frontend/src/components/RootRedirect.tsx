import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RootRedirect: React.FC = () => {
    const { isAuthenticated, user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading) {
            if (isAuthenticated) {
                // Check if onboarding is completed
                if (user && !user.onboarding_completed) {
                    navigate('/onboarding');
                } else {
                    navigate('/home');
                }
            } else {
                // Unauthenticated users go to login
                navigate('/login');
            }
        }
    }, [isAuthenticated, loading, navigate]);

    // Show nothing while redirecting
    return null;
};

