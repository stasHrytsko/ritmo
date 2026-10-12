export type Tier = 'gold' | 'silver' | 'bronze';

export const TIER_LABELS: Record<Tier, string> = {
  gold: 'Золото',
  silver: 'Серебро',
  bronze: 'Бронза'
};

/**
 * Gold is everything done, silver is 70–99%, bronze is 50–69%, anything under
 * half earns nothing. A period with nothing owed (null) earns nothing either:
 * it is skipped, not scored.
 */
export const tierOf = (share: number | null | undefined): Tier | null => {
  if (share === null || share === undefined) return null;
  // Guard against 0.9999999 from float sums; everything done is gold.
  if (share >= 1 - 1e-9) return 'gold';
  if (share >= 0.7) return 'silver';
  if (share >= 0.5) return 'bronze';
  return null;
};
