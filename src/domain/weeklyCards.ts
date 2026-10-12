import { WEEKLY_CARDS } from './weeklyCards.data';
import type { CardTier, WeeklyCardPick } from './types';

export interface WeeklyCard {
  id: string;
  tier: CardTier;
  title: string;
  text: string;
}

export const CARD_TIERS: readonly CardTier[] = ['easy', 'medium', 'hard'];

export const CARD_TIER_LABELS: Record<CardTier, string> = {
  easy: 'Лёгкая',
  medium: 'Средняя',
  hard: 'Сложная'
};

export const CARD_TIER_PLURALS: Record<CardTier, string> = {
  easy: 'Лёгкие',
  medium: 'Средние',
  hard: 'Сложные'
};

const BY_ID = new Map(WEEKLY_CARDS.map((card) => [card.id, card]));

export const cardById = (id: string): WeeklyCard | undefined => BY_ID.get(id);

/**
 * Draws one card per tier. Cards already seen are skipped; once a tier runs
 * out of fresh ones it starts over, so a long-time user still gets a full set.
 */
export const drawWeeklySet = (
  seen: ReadonlySet<string>,
  random: () => number = Math.random
): string[] =>
  CARD_TIERS.map((tier) => {
    const all = WEEKLY_CARDS.filter((card) => card.tier === tier);
    const fresh = all.filter((card) => !seen.has(card.id));
    const pool = fresh.length > 0 ? fresh : all;
    return pool[Math.floor(random() * pool.length)].id;
  });

/** Cards the user has opened, in any week. They are not offered again until the tier is used up. */
export const seenCardIds = (picks: readonly WeeklyCardPick[]): Set<string> =>
  new Set(picks.flatMap((pick) => (pick.pickedId ? [pick.pickedId] : [])));

export interface CardCounts {
  easy: number;
  medium: number;
  hard: number;
}

/** Finished cards per tier, all time. */
export const countDoneCards = (picks: readonly WeeklyCardPick[]): CardCounts => {
  const counts: CardCounts = { easy: 0, medium: 0, hard: 0 };
  for (const pick of picks) {
    const card = pick.doneAt && pick.pickedId ? cardById(pick.pickedId) : undefined;
    if (card) counts[card.tier] += 1;
  }
  return counts;
};
