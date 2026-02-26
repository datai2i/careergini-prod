import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RootRedirect: React.FC = () => {
    const { isAuthenticated, user, loading } = useAuth();
    const navigate = useNavigate();
    const hasNavigated = useRef(false);

    useEffect(() => {
        if (loading || hasNavigated.current) return;

        hasNavigated.current = true;
        if (isAuthenticated) {
            if (user && !user.onboarding_completed) {
                navigate('/onboarding', { replace: true });
            } else {
                navigate('/home', { replace: true });
            }
        } else {
            navigate('/login', { replace: true });
        }
    }, [isAuthenticated, loading, navigate, user]);

    return null;
};
