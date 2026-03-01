import { useAuth } from '../context/AuthContext';
import { checkAccess, PlanLimits, PLAN_CONFIGS, PlanTier } from '../utils/planLimits';

export const usePlanAccess = () => {
    const { user } = useAuth();

    const canAccess = (feature: keyof PlanLimits) => {
        if (user?.role === 'admin') return true; // Admins skip gates

        const plan = (user?.plan?.toLowerCase() || 'free') as PlanTier;
        const config = PLAN_CONFIGS[plan] || PLAN_CONFIGS.free;

        // Explicitly check dynamic quota for resume builds
        if (feature === 'resumeBuilds') {
            const buildsAllowed = config.resumeBuilds;
            const currentBuilds = user?.resume_count || 0;
            if (currentBuilds >= buildsAllowed) {
                return false;
            }
        }

        return checkAccess(user?.plan || 'free', feature);
    };

    return {
        canAccess,
        plan: user?.plan || 'free'
    };
};
