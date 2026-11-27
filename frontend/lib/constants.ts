// HealAll is for people 18 and over, so sign-up offers no under-18 range.
// AgeRange in lib/types/api.ts keeps "13-17" only for accounts made before that rule.
export const ageRanges = ["18-24", "25-34", "35-44", "45+"] as const;

export const postCategories = [
  "emotional_support",
  "mentorship",
  "skill_sharing",
  "navigation",
  "on_ground",
  "urgent"
] as const;

export const postUrgencies = ["low", "normal", "high", "critical"] as const;

export const reportReasons = ["spam", "harassment", "fraud", "solicitation", "crisis", "other"] as const;

export const moderationActions = ["warn", "restrict", "suspend", "ban", "dismiss"] as const;
