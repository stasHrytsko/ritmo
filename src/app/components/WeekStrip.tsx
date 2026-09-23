import type { DayStrip } from '../../application/ritmoService';
import { WEEKDAY_LETTERS, weekdayName } from '../../domain/time';
import { Check } from './icons';

const RADIUS = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The week at a glance. Each day's ring fills with the share of routines done;
 * a full ring with a tick is the medal. Tapping a day opens it in Today.
 */
export function WeekStrip({ days, onSelect }: { days: DayStrip[]; onSelect?: (date: Date) => void }) {
  return (
    <div className="week-strip">
      {days.map((day, index) => {
        const classes = [
          day.isToday ? 'today' : '',
          day.future ? 'future' : '',
          day.selected ? 'selected' : '',
          day.medal ? 'medal' : ''
        ].filter(Boolean).join(' ');

        return (
          <button
            type="button"
            key={day.date.toISOString()}
            className={classes}
            aria-current={day.selected ? 'date' : undefined}
            aria-label={`${weekdayName(day.date)}, ${day.date.getDate()}${day.future ? '' : `, выполнено ${Math.round(day.progress * 100)}%`}`}
            disabled={!onSelect}
            onClick={() => onSelect?.(day.date)}
          >
            <span>{WEEKDAY_LETTERS[index]}</span>
            <b>
              <svg viewBox="0 0 36 36" aria-hidden="true">
                <circle className="ring-track" cx="18" cy="18" r={RADIUS} />
                {/* Always present, so going from nothing to the first tick animates too. */}
                {!day.future && (
                  <circle
                    className="ring-fill"
                    cx="18"
                    cy="18"
                    r={RADIUS}
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE * (1 - day.progress)}
                    data-empty={day.progress === 0 ? 'true' : undefined}
                  />
                )}
              </svg>
              <em>{day.date.getDate()}</em>
            </b>
            <i>{day.medal && <Check />}</i>
          </button>
        );
      })}
    </div>
  );
}
