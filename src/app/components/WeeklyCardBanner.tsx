import { useEffect, useState } from 'react';
import type { WeeklyCardView } from '../../application/ritmoService';
import type { CardCadence } from '../../domain/types';
import { Collapse } from './Collapse';
import { Check, Chevron } from './icons';
import { Segmented } from './ui';

const CADENCES = [
  { value: 'week', label: 'Раз в неделю' },
  { value: 'day', label: 'Каждый день' }
] as const;

const until = (card: WeeklyCardView) =>
  card.cadence === 'day'
    ? 'до конца дня'
    : `до ${card.deadline.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;

const titleOf = (card: WeeklyCardView) => (card.cadence === 'day' ? 'Карта дня' : 'Карта недели');

/**
 * The period's one card, above the routine. Face down until tapped — it may be
 * easy or very hard, that is the chance. Once done, a few words can be kept
 * with it, to remember what it was like.
 */
export function WeeklyCardBanner({
  card,
  onReveal,
  onComplete,
  onReopen,
  onNote,
  onCadence
}: {
  card: WeeklyCardView;
  onReveal: () => Promise<void>;
  onComplete: () => Promise<void>;
  onReopen: () => Promise<void>;
  onNote: (note: string) => Promise<void>;
  onCadence: (cadence: CardCadence) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  // Folded by default: the card is an invitation, not a block of the day.
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(card.note ?? '');
  useEffect(() => setNote(card.note ?? ''), [card.note, card.periodId]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const face = card.card;
  const summary = card.state === 'closed'
    ? `Закрыта · ${until(card)}`
    : card.state === 'done'
      ? `Выполнена · ${face?.title}`
      : open ? until(card) : face?.title;

  return (
    <section
      className={`card-banner is-fold${open ? ' is-expanded' : ''}${card.state === 'done' ? ' is-complete' : ''}`}
      aria-label={titleOf(card)}
    >
      <button
        type="button"
        className="card-banner-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {card.state === 'done' && <span className="card-banner-check"><Check /></span>}
        <span className="card-banner-summary">
          <strong>{titleOf(card)}</strong>
          <small>{summary}</small>
        </span>
        <Chevron />
      </button>

      <Collapse open={open}>
        <div className="card-banner-body">
          {card.state === 'closed' && (
            <>
              <button
                type="button"
                className="card-back card-back-single"
                disabled={busy}
                onClick={() => void run(onReveal)}
              >
                <span>Открыть карту</span>
              </button>
              <p>Лёгкая или очень сложная — решает случай. Выполнять необязательно.</p>
            </>
          )}

          {card.state !== 'closed' && face && (
            <>
              <div className="card-banner-head">
                <strong className="card-banner-title">{face.title}</strong>
              </div>
              <p>{face.text}</p>
            </>
          )}

          {card.state === 'active' && (
            <button type="button" className="card-banner-done" disabled={busy} onClick={() => void run(onComplete)}>
              Сделано
            </button>
          )}

          {card.state === 'done' && (
            <div className="card-note">
              <label htmlFor={`card-note-${card.periodId}`}>Как это было</label>
              <textarea
                id={`card-note-${card.periodId}`}
                rows={3}
                value={note}
                placeholder="Пара слов на память: где, с кем, что почувствовали…"
                onChange={(event) => setNote(event.target.value)}
              />
              <div className="card-note-actions">
                <button type="button" className="card-banner-undo" disabled={busy} onClick={() => void run(onReopen)}>
                  Отменить «Сделано»
                </button>
                {note.trim() !== (card.note ?? '') && (
                  <button type="button" className="card-note-save" disabled={busy} onClick={() => void run(() => onNote(note))}>
                    Сохранить
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="card-cadence">
            <Segmented
              options={CADENCES.map((option) => ({ ...option }))}
              value={card.cadence}
              onChange={(cadence) => void run(() => onCadence(cadence))}
            />
          </div>
        </div>
      </Collapse>
    </section>
  );
}
