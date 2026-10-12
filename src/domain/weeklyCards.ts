import { WEEKLY_CARDS } from './weeklyCards.data';
import type { CardCadence, CardTier, WeeklyCardPick } from './types';

export interface WeeklyCard {
  id: string;
  tier: CardTier;
  title: string;
  text: string;
}

export const CARD_TIERS: readonly CardTier[] = ['easy', 'medium', 'hard'];

const BY_ID = new Map(WEEKLY_CARDS.map((card) => [card.id, card]));

export const cardById = (id: string): WeeklyCard | undefined => BY_ID.get(id);

/**
 * Draws one card from the whole bank — easy or very hard, it is chance. Cards
 * already turned over are skipped until the bank runs out, then it starts over.
 */
export const drawCard = (
  seen: ReadonlySet<string>,
  random: () => number = Math.random
): string => {
  const fresh = WEEKLY_CARDS.filter((card) => !seen.has(card.id));
  const pool = fresh.length > 0 ? fresh : WEEKLY_CARDS;
  return pool[Math.floor(random() * pool.length)].id;
};

/** Cards the person has turned over, in any period. */
export const seenCardIds = (picks: readonly WeeklyCardPick[]): Set<string> =>
  new Set(picks.flatMap((pick) => (pick.pickedId ? [pick.pickedId] : [])));

export interface DoneCard {
  id: string;
  card: WeeklyCard;
  doneAt: string;
  note?: string;
}

/** Cards finished in a given year, newest first, with the notes left on them. */
export const doneCardsInYear = (picks: readonly WeeklyCardPick[], year: number): DoneCard[] =>
  picks
    .flatMap((pick) => {
      const card = pick.pickedId ? cardById(pick.pickedId) : undefined;
      if (!card || !pick.doneAt || new Date(pick.doneAt).getFullYear() !== year) return [];
      return [{ id: pick.id, card, doneAt: pick.doneAt, note: pick.note }];
    })
    .sort((a, b) => b.doneAt.localeCompare(a.doneAt));

/** Period id: the week's start date, or `d:` + the day for daily cards. */
export const cardPeriodId = (cadence: CardCadence, weekId: string, dayKey: string) =>
  cadence === 'day' ? `d:${dayKey}` : weekId;
