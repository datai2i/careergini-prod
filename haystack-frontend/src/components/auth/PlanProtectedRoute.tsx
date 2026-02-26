import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePlanAccess } from '../../hooks/usePlanAccess';
import { PlanLimits } from '../../utils/planLimits';

interface PlanProtectedRouteProps {
    children: React.ReactNode;
    feature: keyof PlanLimits;
}

export const PlanProtectedRoute: React.FC<PlanProtectedRouteProps> = ({ children, feature }) => {
    const { canAccess } = usePlanAccess();

    if (!canAccess(feature)) {
        return <Navigate to="/home" replace />;
    }

    return <>{children}</>;
};
