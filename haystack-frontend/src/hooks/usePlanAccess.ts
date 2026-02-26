import { useAuth } from '../context/AuthContext';
import { checkAccess, PlanLimits } from '../utils/planLimits';

export const usePlanAccess = () => {
    const { user } = useAuth();

    const canAccess = (feature: keyof PlanLimits) => {
        if (user?.role === 'admin') return true; // Admins skip gates
        return checkAccess(user?.plan || 'free', feature);
    };

    return {
        canAccess,
        plan: user?.plan || 'free'
    };
};
