import { describe, expect, it } from 'vitest';
import { WEEKLY_CARDS } from './weeklyCards.data';
import { CARD_TIERS, cardById, countDoneCards, drawWeeklySet, seenCardIds } from './weeklyCards';
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

describe('drawWeeklySet', () => {
  it('draws one card per tier, in order', () => {
    const ids = drawWeeklySet(new Set());
    expect(ids.map((id) => cardById(id)?.tier)).toEqual(['easy', 'medium', 'hard']);
  });

  it('skips cards already seen', () => {
    const easy = WEEKLY_CARDS.filter((card) => card.tier === 'easy');
    const seen = new Set(easy.slice(1).map((card) => card.id));
    for (let i = 0; i < 20; i += 1) {
      expect(drawWeeklySet(seen)[0]).toBe(easy[0].id);
    }
  });

  it('starts a tier over once every card in it was seen', () => {
    const seen = new Set(WEEKLY_CARDS.filter((card) => card.tier === 'hard').map((card) => card.id));
    expect(cardById(drawWeeklySet(seen)[2])?.tier).toBe('hard');
  });
});

describe('counting', () => {
  it('collects opened cards and counts only finished ones per tier', () => {
    const easy = WEEKLY_CARDS.find((card) => card.tier === 'easy')!.id;
    const hard = WEEKLY_CARDS.find((card) => card.tier === 'hard')!.id;
    const picks = [
      pick({ id: '2026-09-07', pickedId: easy, doneAt: '2026-09-09T00:00:00Z' }),
      pick({ id: '2026-09-14', pickedId: hard })
    ];
    expect(seenCardIds(picks)).toEqual(new Set([easy, hard]));
    expect(countDoneCards(picks)).toEqual({ easy: 1, medium: 0, hard: 0 });
  });
});
