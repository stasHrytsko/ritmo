import type { MonthView, WeekDayProgress, WeekView, YearView } from '../../application/ritmoService';
import { WEEKDAY_LETTERS, isoWeekday, plural, routineMinutes } from '../../domain/time';
import { Empty, PeriodSwitch, ProgressBar, ProgressSummary, SectionHeader, type PeriodView } from '../components/ui';

export type ProgressData =
  | { view: 'week'; data: WeekView }
  | { view: 'month'; data: MonthView }
  | { view: 'year'; data: YearView };

export function ProgressScreen({
  screen,
  onChange
}: {
  screen: ProgressData;
  onChange: (view: PeriodView) => void;
}) {
  return (
    <section className="screen progress-screen">
      {screen.view === 'week' && <WeekBody data={screen.data} onChange={onChange} />}
      {screen.view === 'month' && <MonthBody data={screen.data} onChange={onChange} />}
      {screen.view === 'year' && <YearBody data={screen.data} onChange={onChange} />}
    </section>
  );
}

function WeekBody({ data, onChange }: { data: WeekView; onChange: (view: PeriodView) => void }) {
  const percent = data.routineTotal ? Math.round((data.routineDone / data.routineTotal) * 100) : 0;
  const groups = groupRoutines(data.routineProgress, data.dayBoundaryHour);

  return (
    <>
      <div className="progress-heading">
        <div>
          <div className="eyebrow">Неделя {data.week.weekNumber}</div>
          <h1>{data.label}</h1>
        </div>
      </div>
      <PeriodSwitch current="week" onChange={onChange} />

      <div className="week-summary">
        <div className="week-summary-copy">
          <span className="summary-label">Рутина</span>
          <strong>{percent}%</strong>
          <small>{data.routineDone} из {data.routineTotal} · только прожитые дни</small>
        </div>
        <div className="day-bars" aria-hidden="true">
          {data.days.map((day, index) => (
            <span key={day.date.toISOString()} className={day.isToday ? 'is-today' : undefined}>
              {day.future ? (
                <i className="is-future" />
              ) : !day.tracked ? (
                <i className="is-untracked" />
              ) : (
                <i
                  className={day.progress < 1 ? 'is-partial' : undefined}
                  style={{ height: `${Math.max(8, Math.round(day.progress * 100))}%` }}
                />
              )}
              <em>{WEEKDAY_LETTERS[index]}</em>
            </span>
          ))}
        </div>
      </div>

      {data.goalTotal > 0 && (
        <div className="summary-grid one-up">
          <ProgressSummary title="Цели" done={data.goalDone} total={data.goalTotal} />
        </div>
      )}

      <section className="content-block">
        <SectionHeader title="Рутина по дням" meta={`${data.routineDone}/${data.routineTotal}`} />
        {data.routineProgress.length > 0 ? (
          <div className="heatmap">
            <div className="heatmap-head" aria-hidden="true">
              <span />
              {data.days.map((day, index) => (
                <span key={index} className={day.isToday ? 'is-today' : undefined}>{WEEKDAY_LETTERS[index]}</span>
              ))}
              <span />
            </div>
            {groups.map(([label, items]) => (
              <div className="heatmap-group" key={label}>
                <div className="heatmap-group-label">{label}</div>
                {items.map((item) => (
                  <div
                    className="heatmap-row"
                    key={item.routine.routineId}
                    role="img"
                    aria-label={`${item.routine.name}: ${item.done} из ${item.total}`}
                  >
                    <span className="heatmap-name" title={item.routine.name}>{item.routine.name}</span>
                    {item.days.map((day) => (
                      <i key={day.date.toISOString()} className={`heat-cell is-${cellState(day.status)}`} />
                    ))}
                    <span className="heatmap-score">{item.done}/{item.total}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="legend">
              <span><i className="heat-cell is-done" />выполнено</span>
              <span><i className="heat-cell is-missed" />пропущено</span>
              <span><i className="heat-cell is-ahead" />впереди</span>
              <span><i className="heat-cell is-off" />не по плану</span>
            </div>
          </div>
        ) : (
          <Empty text="Рутин пока нет." />
        )}
      </section>

      {data.goalProgress.length > 0 && (
        <section className="content-block">
          <SectionHeader title="Цели" meta={`${data.goalDone}/${data.goalTotal}`} />
          <div className="progress-list">
            {data.goalProgress.map((item) => (
              <div className={`goal-progress-row${item.total === 0 ? ' is-idle' : ''}`} key={item.goal.id}>
                <div className="goal-progress-copy">
                  <strong>{item.goal.name}</strong>
                  <span>{item.total > 0 ? `${item.done}/${item.total} на этой неделе` : 'задач на неделю нет'}</span>
                </div>
                {item.total > 0 && <ProgressBar done={item.done} total={item.total} />}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Due-now counts as still ahead in the week view: it is not late yet. */
function cellState(status: WeekDayProgress['status']) {
  if (status === 'due') return 'ahead';
  return status;
}

const PARTS = ['Утро', 'День', 'Вечер', 'В любое время'] as const;

function groupRoutines(items: WeekView['routineProgress'], boundaryHour: number) {
  const groups = new Map<(typeof PARTS)[number], WeekView['routineProgress']>(PARTS.map((label) => [label, []]));
  for (const item of items) {
    const { timing, time } = item.routine;
    if (timing !== 'exact' || !time) {
      groups.get('В любое время')!.push(item);
      continue;
    }
    const minutes = routineMinutes(time, boundaryHour);
    groups.get(minutes < 12 * 60 ? 'Утро' : minutes < 18 * 60 ? 'День' : 'Вечер')!.push(item);
  }
  return [...groups].filter(([, list]) => list.length > 0);
}

function MonthBody({ data, onChange }: { data: MonthView; onChange: (view: PeriodView) => void }) {
  const firstOfMonth = new Date(data.date.getFullYear(), data.date.getMonth(), 1);
  const leadingBlanks = isoWeekday(firstOfMonth) - 1;
  const { current, best } = data.streak;

  const streakNote = best === 0
    ? 'закрой день — начнётся серия'
    : current >= best
      ? `${plural(current, ['день', 'дня', 'дней'])} подряд · это рекорд`
      : `${plural(current, ['день', 'дня', 'дней'])} подряд · рекорд ${best}`;

  return (
    <>
      <div className="eyebrow">{data.date.getFullYear()}</div>
      <h1>{data.name}</h1>
      <PeriodSwitch current="month" onChange={onChange} />

      <div className="summary-grid">
        <div className="summary-card">
          <span>Серия</span>
          <strong>{current}</strong>
          <small>{streakNote}</small>
        </div>
        <div className="summary-card">
          <span>Средний день</span>
          <strong>{data.averageProgress === null ? '—' : `${Math.round(data.averageProgress * 100)}%`}</strong>
          <small>медалей: {data.medalCount} из {data.knownDays}</small>
        </div>
      </div>

      <div className="calendar-head" aria-hidden="true">
        {WEEKDAY_LETTERS.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      <div className="month-grid">
        {Array.from({ length: leadingBlanks }).map((_, index) => <span key={`pad-${index}`} />)}
        {data.days.map((day) => {
          const state = day.future ? 'future' : !day.known ? 'untracked' : day.medal ? 'medal' : 'partial';
          return (
            <div
              className={`month-day is-${state}${day.isToday ? ' is-today' : ''}`}
              key={day.date.toISOString()}
              aria-label={monthDayLabel(day)}
            >
              {state === 'partial' && (
                <i className="month-fill" style={{ height: `${Math.round(day.progress * 100)}%` }} />
              )}
              <span>{day.date.getDate()}</span>
            </div>
          );
        })}
      </div>
      <div className="legend">
        <span><i className="month-day is-medal" />медаль</span>
        <span><i className="month-day is-partial"><i className="month-fill" style={{ height: '55%' }} /></i>частично</span>
        <span><i className="month-day is-future" />впереди</span>
        <span><i className="month-day is-untracked" />не отмечалось</span>
      </div>

      {data.goals.length > 0 && (
        <section className="content-block">
          <SectionHeader title="Цели" meta="" />
          <div className="progress-list">
            {data.goals.map((item) => (
              <div className="goal-progress-row" key={item.goal.id}>
                <div className="goal-progress-copy">
                  <strong>{item.goal.name}</strong>
                  <span>{item.done}/{item.total} {plural(item.total, ['задача', 'задачи', 'задач'])}</span>
                </div>
                <ProgressBar done={item.done} total={item.total} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function monthDayLabel(day: MonthView['days'][number]) {
  const date = day.date.getDate();
  if (day.future) return `${date}: ещё впереди`;
  if (!day.known) return `${date}: не отмечалось`;
  if (day.medal) return `${date}: медаль`;
  return `${date}: ${Math.round(day.progress * 100)}%`;
}

function YearBody({ data, onChange }: { data: YearView; onChange: (view: PeriodView) => void }) {
  const today = new Date();
  const currentQuarter = data.year === today.getFullYear() ? Math.floor(today.getMonth() / 3) : -1;

  return (
    <>
      <div className="eyebrow">Год</div>
      <div className="year-title">
        <h1>{data.year}</h1>
        <div><strong>{data.currentDay}</strong><span>день из {data.totalDays}</span></div>
      </div>
      <PeriodSwitch current="year" onChange={onChange} />

      <div className="summary-grid">
        <div className="summary-card">
          <span>Осталось дней</span>
          <strong>{data.daysLeft}</strong>
          <small>до конца года</small>
        </div>
        <div className="summary-card">
          <span>Осталось недель</span>
          <strong>{data.weeksLeft}</strong>
          <small>примерно</small>
        </div>
      </div>

      <div className="quarters-list">
        {[0, 1, 2, 3].map((quarterIndex) => {
          const months = data.months.slice(quarterIndex * 3, quarterIndex * 3 + 3);
          const medals = months.reduce((sum, month) => sum + month.medals, 0);
          const knownDays = months.reduce((sum, month) => sum + month.knownDays, 0);

          return (
            <section
              className={`quarter-card ${quarterIndex === currentQuarter ? 'current' : ''}`}
              key={quarterIndex}
            >
              <div className="quarter-header">
                <div>
                  <strong>Q{quarterIndex + 1}</strong>
                  <span>{months.map((month) => month.label).join(' · ')}</span>
                </div>
                <div className="quarter-meta">
                  <b>{medals}</b>
                  <span>{plural(medals, ['медаль', 'медали', 'медалей'])}</span>
                </div>
              </div>

              <div className="quarter-months">
                {months.map((month) => (
                  <div className="month-card" key={month.month}>
                    <strong>{month.label.toUpperCase()}</strong>
                    <span>{month.medals} {plural(month.medals, ['медаль', 'медали', 'медалей'])}</span>
                    <div className="month-bar">
                      <i style={{
                        width: `${month.knownDays ? Math.round((month.medals / month.knownDays) * 100) : 0}%`
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="quarter-progress">
                <span>
                  {knownDays
                    ? `${Math.round((medals / knownDays) * 100)}% отмеченных дней с медалью`
                    : 'Отмеченных дней пока нет'}
                </span>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
