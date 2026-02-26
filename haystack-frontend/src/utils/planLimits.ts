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
        hasApplications: true, // Baseline dashboard
        hasSkillGaps: false,
        hasInterviewPrep: false
    },
    basic: {
        resumeBuilds: 10,
        hasCoverLetter: true,
        hasCareerRoadmap: true,
        hasJobSearch: false,
        hasLearningHub: false,
        hasUnlimitedChat: false,
        hasIndustryTailoring: true,
        hasAdvisor: true,
        hasAnalytics: false,
        hasApplications: true,
        hasSkillGaps: false,
        hasInterviewPrep: false
    },
    premium: {
        resumeBuilds: 100,
        hasCoverLetter: true,
        hasCareerRoadmap: true,
        hasJobSearch: true,
        hasLearningHub: true,
        hasUnlimitedChat: true,
        hasIndustryTailoring: true,
        hasAdvisor: true,
        hasAnalytics: true,
        hasApplications: true,
        hasSkillGaps: true,
        hasInterviewPrep: true
    }
};

export const checkAccess = (userPlan: PlanTier | string, feature: keyof PlanLimits): boolean => {
    const plan = (userPlan?.toLowerCase() || 'free') as PlanTier;
    const config = PLAN_CONFIGS[plan] || PLAN_CONFIGS.free;

    const value = config[feature];
    if (typeof value === 'boolean') return value;
    return value > 0;
};
