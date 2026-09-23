import { useEffect, useState, type CSSProperties } from 'react';
import { Chevron } from './icons';

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export function SectionHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      <span>{meta}</span>
    </div>
  );
}

export function AccordionHeader({
  title,
  meta,
  open,
  onToggle
}: {
  title: string;
  meta?: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className="accordion-header" aria-expanded={open} onClick={onToggle}>
      <h2>{title}</h2>
      <span className="accordion-header-right">
        {meta && <b>{meta}</b>}
        <Chevron />
      </span>
    </button>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A row of mutually exclusive options with one thumb that slides to the
 * chosen one. `from` lets a control that is remounted on every change (the
 * period switch lives inside each period's screen) start where the last one
 * stood, so the slide still reads.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  from,
  kind = 'pressed',
  className = '',
  labelledBy
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  from?: T;
  kind?: 'pressed' | 'current';
  className?: string;
  labelledBy?: string;
}) {
  const target = Math.max(0, options.findIndex((option) => option.value === value));
  const start = from === undefined ? target : Math.max(0, options.findIndex((option) => option.value === from));
  const [index, setIndex] = useState(start);

  useEffect(() => {
    // One frame at the old place, then slide.
    const frame = requestAnimationFrame(() => setIndex(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <div
      className={`segmented ${className}`.trim()}
      role="group"
      aria-labelledby={labelledBy}
      style={{ '--n': options.length, '--idx': index } as CSSProperties}
    >
      <i className="segmented-thumb" aria-hidden="true" />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            type="button"
            key={option.value}
            className={active ? 'active' : ''}
            aria-pressed={kind === 'pressed' ? active : undefined}
            aria-current={kind === 'current' && active ? 'page' : undefined}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <i style={{ width: `${percent}%` }} />
    </div>
  );
}

export function ProgressSummary({ title, done, total }: { title: string; done: number; total: number }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="summary-card">
      <span>{title}</span>
      <strong>{percent}%</strong>
      <small>{done} из {total}</small>
      <ProgressBar done={done} total={total} />
    </div>
  );
}

export type PeriodView = 'week' | 'month' | 'year';

const PERIODS: SegmentOption<PeriodView>[] = [
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' }
];

// Each period is its own screen, so the switch is remounted on every change;
// this remembers where its thumb last stood.
let lastPeriod: PeriodView | undefined;

export function PeriodSwitch({
  current,
  onChange
}: {
  current: PeriodView;
  onChange: (view: PeriodView) => void;
}) {
  const [from] = useState(() => {
    const previous = lastPeriod;
    lastPeriod = current;
    return previous;
  });
  useEffect(() => { lastPeriod = current; }, [current]);

  return (
    <Segmented
      options={PERIODS}
      value={current}
      from={from}
      kind="current"
      className="period-switch"
      onChange={onChange}
    />
  );
}
