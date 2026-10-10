/** How the match score combines the model's sub-scores. Shared by server and UI. */
export const SCORE_WEIGHTS = { value: 0.3, location: 0.3, reviews: 0.25, fit: 0.15 } as const;
