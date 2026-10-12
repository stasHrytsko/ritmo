import { useState } from 'react';
import type { WeeklyCardView } from '../../application/ritmoService';
import { CARD_TIER_LABELS } from '../../domain/weeklyCards';
import { Check, Chevron, StarRow } from './icons';
import { Collapse } from './Collapse';

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
  onComplete,
  onReopen
}: {
  card: WeeklyCardView;
  onPick: (cardId: string) => Promise<void>;
  onComplete: () => Promise<void>;
  onReopen: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  // Folded by default: the card is an invitation, not a block of the day.
  const [open, setOpen] = useState(false);
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
        <button type="button" className="card-banner-undo" disabled={busy} onClick={() => void run(onReopen)}>
          Отменить
        </button>
      </div>
    );
  }

  const active = card.state === 'active' ? card.picked?.card : undefined;

  return (
    <section
      className={`card-banner is-fold${open ? ' is-expanded' : ''}${active ? ` tier-${active.tier}` : ''}`}
      aria-label="Карта недели"
    >
      <button
        type="button"
        className="card-banner-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="card-banner-summary">
          <strong>Карта недели</strong>
          <small>{active ? active.title : `Три карты · ${until(card.deadline)}`}</small>
        </span>
        {active && <StarRow tier={active.tier} />}
        <Chevron />
      </button>

      <Collapse open={open}>
        {active ? (
          <div className="card-banner-body">
            <div className="card-banner-head">
              <span className="card-banner-tier">{CARD_TIER_LABELS[active.tier]}</span>
              <span className="card-banner-deadline">{until(card.deadline)}</span>
            </div>
            <p>{active.text}</p>
            <button type="button" className="card-banner-done" disabled={busy} onClick={() => void run(onComplete)}>
              Сделано
            </button>
          </div>
        ) : (
          <div className="card-banner-body">
            <p>Выбери одну, не заглядывая. Необязательно.</p>
            <div className="card-backs">
              {card.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`card-back tier-${option.tier}`}
                  disabled={busy}
                  aria-label={`${CARD_TIER_LABELS[option.tier]} карта`}
                  onClick={() => void run(async () => {
                    await onPick(option.id);
                    setOpen(true);
                  })}
                >
                  <StarRow tier={option.tier} />
                  <span>{CARD_TIER_LABELS[option.tier]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Collapse>
    </section>
  );
}
