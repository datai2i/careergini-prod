export type PlanTier = 'free' | 'basic' | 'premium';

export interface PlanLimits {
    resumeBuilds: number;
    hasCoverLetter: boolean;
    hasCareerRoadmap: boolean;
    hasJobSearch: boolean;
    hasLearningHub: boolean;
    hasUnlimitedChat: boolean;
    hasIndustryTailoring: boolean;
    hasAdvisor: boolean;
    hasAnalytics: boolean;
    hasApplications: boolean;
    hasDashboard: boolean;
    hasSkillGaps: boolean;
    hasInterviewPrep: boolean;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanLimits> = {
    free: {
        resumeBuilds: 1,
        hasCoverLetter: false,
        hasCareerRoadmap: false,
        hasJobSearch: false,
        hasLearningHub: false,
        hasUnlimitedChat: false,
        hasIndustryTailoring: false,
        hasAdvisor: false,
        hasAnalytics: false,
        hasApplications: false,
        hasDashboard: true,
        hasSkillGaps: false,
        hasInterviewPrep: false
    },
    basic: { // UI label: Starter
        resumeBuilds: 5,
        hasCoverLetter: true,
        hasCareerRoadmap: false,
        hasJobSearch: false,
        hasLearningHub: false,
        hasUnlimitedChat: false,
        hasIndustryTailoring: true,
        hasAdvisor: false,
        hasAnalytics: false,
        hasApplications: false,
        hasDashboard: true,
        hasSkillGaps: false,
        hasInterviewPrep: false
    },
    premium: { // UI label: Premium
        resumeBuilds: 20,
        hasCoverLetter: true,
        hasCareerRoadmap: false,
        hasJobSearch: true,
        hasLearningHub: true,
        hasUnlimitedChat: true,
        hasIndustryTailoring: true,
        hasAdvisor: false,
        hasAnalytics: false,
        hasApplications: false,
        hasDashboard: true,
        hasSkillGaps: false,
        hasInterviewPrep: false
    }
};

export const checkAccess = (userPlan: PlanTier | string, feature: keyof PlanLimits): boolean => {
    const plan = (userPlan?.toLowerCase() || 'free') as PlanTier;
    const config = PLAN_CONFIGS[plan] || PLAN_CONFIGS.free;

    const value = config[feature];
    if (typeof value === 'boolean') return value;
    return value > 0;
};

export const PLAN_META: Record<string, { label: string; maxBuilds: number; color: string; upgradePlans: { key: string; label: string; price: string }[] }> = {
    free: { label: 'Free', maxBuilds: 1, color: 'text-gray-600', upgradePlans: [{ key: 'starter', label: 'Starter', price: '$5' }, { key: 'premium', label: 'Premium', price: '$20' }] },
    basic: { label: 'Starter', maxBuilds: 5, color: 'text-blue-600', upgradePlans: [{ key: 'premium', label: 'Premium', price: '$20' }] },
    premium: { label: 'Premium', maxBuilds: 20, color: 'text-purple-600', upgradePlans: [] },
};

