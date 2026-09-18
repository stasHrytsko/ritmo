import type { DayStrip } from '../../application/ritmoService';
import { weekdayName } from '../../domain/time';

export function WeekStrip({ days }: { days: DayStrip[] }) {
  return (
    <div className="week-strip">
      {days.map((day) => (
        <div
          key={day.date.toISOString()}
          className={[day.isToday ? 'today' : '', day.future ? 'future' : ''].filter(Boolean).join(' ')}
        >
          <span>{weekdayName(day.date, 'short').slice(0, 1)}</span>
          <b>{day.date.getDate()}</b>
          <i>{day.medal ? '✓' : ''}</i>
        </div>
      ))}
    </div>
  );
}
