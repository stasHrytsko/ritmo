import { describe, expect, it } from 'vitest';
import { WEEKLY_CARDS } from './weeklyCards.data';
import { CARD_TIERS, cardPeriodId, doneCardsInYear, drawCard, seenCardIds } from './weeklyCards';
import type { WeeklyCardPick } from './types';

const pick = (over: Partial<WeeklyCardPick>): WeeklyCardPick => ({
  id: '2026-09-14',
  cardIds: [],
  createdAt: '2026-09-14T00:00:00Z',
  ...over
});

describe('card bank', () => {
  it('has unique ids and a full pool in every tier', () => {
    expect(new Set(WEEKLY_CARDS.map((card) => card.id)).size).toBe(WEEKLY_CARDS.length);
    for (const tier of CARD_TIERS) {
      expect(WEEKLY_CARDS.filter((card) => card.tier === tier).length).toBeGreaterThanOrEqual(50);
    }
    expect(WEEKLY_CARDS.every((card) => card.title && card.text)).toBe(true);
  });
});

describe('drawCard', () => {
  it('draws from the whole bank, any difficulty', () => {
    const tiers = new Set(Array.from({ length: 300 }, () => {
      const id = drawCard(new Set());
      return WEEKLY_CARDS.find((card) => card.id === id)?.tier;
    }));
    expect(tiers).toEqual(new Set(['easy', 'medium', 'hard']));
  });

  it('skips cards already turned over', () => {
    const seen = new Set(WEEKLY_CARDS.slice(1).map((card) => card.id));
    for (let i = 0; i < 20; i += 1) expect(drawCard(seen)).toBe(WEEKLY_CARDS[0].id);
  });

  it('starts over once every card was seen', () => {
    const seen = new Set(WEEKLY_CARDS.map((card) => card.id));
    const drawn = drawCard(seen);
    expect(WEEKLY_CARDS.some((card) => card.id === drawn)).toBe(true);
  });
});

describe('cards in a year', () => {
  it('lists finished cards of that year, newest first, with notes', () => {
    const [a, b] = WEEKLY_CARDS;
    const picks = [
      pick({ id: '2026-09-07', pickedId: a.id, doneAt: '2026-09-09T10:00:00Z', note: 'ok' }),
      pick({ id: '2026-09-14', pickedId: b.id, doneAt: '2026-09-15T10:00:00Z' }),
      pick({ id: '2025-12-29', pickedId: b.id, doneAt: '2025-12-30T10:00:00Z' }),
      pick({ id: '2026-09-21', pickedId: a.id })
    ];
    expect(seenCardIds(picks)).toEqual(new Set([a.id, b.id]));
    expect(doneCardsInYear(picks, 2026).map((item) => item.id)).toEqual(['2026-09-14', '2026-09-07']);
    expect(doneCardsInYear(picks, 2026)[1].note).toBe('ok');
  });

  it('keys weekly cards by week and daily cards by day', () => {
    expect(cardPeriodId('week', '2026-10-12', '2026-10-14')).toBe('2026-10-12');
    expect(cardPeriodId('day', '2026-10-12', '2026-10-14')).toBe('d:2026-10-14');
  });
});
