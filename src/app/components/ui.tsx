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
  meta: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className="accordion-header" aria-expanded={open} onClick={onToggle}>
      <h2>{title}</h2>
      <span className="accordion-header-right">
        <b>{meta}</b>
        <i className={`accordion-chevron ${open ? 'open' : ''}`}>⌄</i>
      </span>
    </button>
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

const PERIOD_LABELS: Record<PeriodView, string> = { week: 'Неделя', month: 'Месяц', year: 'Год' };

export function PeriodSwitch({
  current,
  onChange
}: {
  current: PeriodView;
  onChange: (view: PeriodView) => void;
}) {
  return (
    <div className="period-switch">
      {(['week', 'month', 'year'] as PeriodView[]).map((period) => (
        <button
          type="button"
          key={period}
          className={current === period ? 'active' : ''}
          aria-current={current === period ? 'page' : undefined}
          onClick={() => onChange(period)}
        >
          {PERIOD_LABELS[period]}
        </button>
      ))}
    </div>
  );
}
