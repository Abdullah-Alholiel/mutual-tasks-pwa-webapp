// ============================================================================
// Plan limits — ONE source of truth (G3, D-081; owner pricing D-20261116-16)
// ============================================================================
// The owner's numbers EXACTLY. Never change them without an owner decision
// recorded in kanban/DECISIONS.md; never invent other numbers (D-078/D-081).
//
// Imported by BOTH sides:
//   - server: netlify/functions/shared/utils.ts (rate limiting + caps)
//   - client: src/features/pages/Premium.tsx (real numbers on the upgrade screen)
// Constants only — bundling this into the client leaks nothing (the numbers
// are public pricing), and it keeps server and UI from drifting apart.

export type PlanTier = 'free' | 'premium';
export type AIUsageType = 'project_generation' | 'description_generation';

/** Monthly AI limits per plan (UTC calendar month; server enforces). */
export const PLAN_LIMITS: Record<PlanTier, Record<AIUsageType, number>> = {
    free: {
        project_generation: 3,
        description_generation: 20,
    },
    premium: {
        project_generation: 100,
        description_generation: 1000,
    },
};
