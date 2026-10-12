import { useState } from 'react';
import type { WeeklyCardView } from '../../application/ritmoService';
import { CARD_TIER_LABELS } from '../../domain/weeklyCards';
import { Check } from './icons';

const until = (deadline: Date) =>
  `до ${deadline.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;

/**
 * The week's card, above the routine. Three face-down cards to choose from;
 * the content is only shown once one is picked. Quiet by design: nothing here
 * is owed, and an unopened set simply expires on Sunday.
 */
export function WeeklyCardBanner({
  card,
  onPick,
  onComplete
}: {
  card: WeeklyCardView;
  onPick: (cardId: string) => Promise<void>;
  onComplete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  if (card.state === 'done' && card.picked) {
    return (
      <div className="card-banner is-done">
        <span className="card-banner-check"><Check /></span>
        <span>
          <strong>Карта недели выполнена</strong>
          <small>{card.picked.card.title}</small>
        </span>
      </div>
    );
  }

  if (card.state === 'active' && card.picked) {
    const { card: face } = card.picked;
    return (
      <section className={`card-banner is-open tier-${face.tier}`} aria-label="Карта недели">
        <div className="card-banner-head">
          <span className="card-banner-tier">{CARD_TIER_LABELS[face.tier]}</span>
          <span className="card-banner-deadline">{until(card.deadline)}</span>
        </div>
        <strong className="card-banner-title">{face.title}</strong>
        <p>{face.text}</p>
        <button type="button" className="card-banner-done" disabled={busy} onClick={() => void run(onComplete)}>
          Сделано
        </button>
      </section>
    );
  }

  return (
    <section className="card-banner is-choose" aria-label="Карта недели">
      <div className="card-banner-head">
        <strong>Карта недели</strong>
        <span className="card-banner-deadline">{until(card.deadline)}</span>
      </div>
      <p>Выбери одну, не заглядывая. Необязательно.</p>
      <div className="card-backs">
        {card.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`card-back tier-${option.tier}`}
            disabled={busy}
            aria-label={`${CARD_TIER_LABELS[option.tier]} карта`}
            onClick={() => void run(() => onPick(option.id))}
          >
            <span>{CARD_TIER_LABELS[option.tier]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
