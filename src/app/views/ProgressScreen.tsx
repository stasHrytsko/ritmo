import type { MonthView, WeekView, YearView } from '../../application/ritmoService';
import { isoWeekday } from '../../domain/time';
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
  return (
    <>
      <div className="progress-heading">
        <div>
          <div className="eyebrow">Week {data.week.weekNumber}</div>
          <h1>{data.label}</h1>
        </div>
      </div>
      <PeriodSwitch current="week" onChange={onChange} />

      <div className="summary-grid">
        <ProgressSummary title="Routine" done={data.routineDone} total={data.routineTotal} />
        <ProgressSummary title="Goals" done={data.goalDone} total={data.goalTotal} />
      </div>

      <section className="content-block">
        <SectionHeader title="Routine" meta={`${data.routineDone}/${data.routineTotal}`} />
        <div className="progress-list">
          {data.routineProgress.map((item) => (
            <div className="weekly-row" key={item.routine.routineId}>
              <div className="weekly-row-title">
                <strong>{item.routine.name}</strong>
                <span>{item.done}/{item.total}</span>
              </div>
              <div className="week-dots">
                {item.days.map((day) => (
                  <span
                    key={day.date.toISOString()}
                    className={!day.scheduled ? 'off' : day.done ? 'done' : 'pending'}
                  >
                    {day.done ? '✓' : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {data.routineProgress.length === 0 && <Empty text="No routines yet." />}
        </div>
      </section>

      <section className="content-block">
        <SectionHeader title="Goals" meta={`${data.goalDone}/${data.goalTotal}`} />
        <div className="progress-list">
          {data.goalProgress.map((item) => (
            <div className="goal-progress-row" key={item.goal.id}>
              <div className="goal-progress-copy">
                <strong>{item.goal.name}</strong>
                <span>{item.done}/{item.total} this week</span>
              </div>
              <ProgressBar done={item.done} total={item.total} />
            </div>
          ))}
          {data.goalProgress.length === 0 && <Empty text="No goal tasks this week." />}
        </div>
      </section>
    </>
  );
}

function MonthBody({ data, onChange }: { data: MonthView; onChange: (view: PeriodView) => void }) {
  const firstOfMonth = new Date(data.date.getFullYear(), data.date.getMonth(), 1);
  const leadingBlanks = isoWeekday(firstOfMonth) - 1;

  return (
    <>
      <div className="eyebrow">{data.date.getFullYear()}</div>
      <h1>{data.name}</h1>
      <PeriodSwitch current="month" onChange={onChange} />

      <div className="summary-grid one-line">
        <div className="summary-card">
          <span>Day medals</span>
          <strong>{data.medalCount}</strong>
          <small>{data.knownDays} tracked days</small>
        </div>
        <div className="summary-card">
          <span>Month</span>
          <strong>{data.date.getMonth() + 1}</strong>
          <small>of 12</small>
        </div>
      </div>

      <div className="calendar-head">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      <div className="month-grid">
        {Array.from({ length: leadingBlanks }).map((_, index) => <span key={`pad-${index}`} />)}
        {data.days.map((day) => (
          <div
            className={`month-day ${day.medal ? 'earned' : ''} ${!day.known ? 'unknown' : ''}`}
            key={day.date.toISOString()}
          >
            <span>{day.date.getDate()}</span>
            {day.medal && <b>✓</b>}
          </div>
        ))}
      </div>

      <section className="content-block">
        <SectionHeader title="Goals" meta="" />
        <div className="progress-list">
          {data.goals.map((item) => (
            <div className="goal-progress-row" key={item.goal.id}>
              <div className="goal-progress-copy">
                <strong>{item.goal.name}</strong>
                <span>{item.done}/{item.total} tasks</span>
              </div>
              <ProgressBar done={item.done} total={item.total} />
            </div>
          ))}
          {data.goals.length === 0 && <Empty text="No goals yet." />}
        </div>
      </section>
    </>
  );
}

function YearBody({ data, onChange }: { data: YearView; onChange: (view: PeriodView) => void }) {
  const today = new Date();
  const currentQuarter = data.year === today.getFullYear() ? Math.floor(today.getMonth() / 3) : -1;

  return (
    <>
      <div className="eyebrow">Year</div>
      <div className="year-title">
        <h1>{data.year}</h1>
        <div><strong>{data.currentDay}</strong><span>day of {data.totalDays}</span></div>
      </div>
      <PeriodSwitch current="year" onChange={onChange} />

      <div className="summary-grid">
        <div className="summary-card">
          <span>Days left</span>
          <strong>{data.daysLeft}</strong>
          <small>until year end</small>
        </div>
        <div className="summary-card">
          <span>Weeks left</span>
          <strong>{data.weeksLeft}</strong>
          <small>approximately</small>
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
                  <span>medals</span>
                </div>
              </div>

              <div className="quarter-months">
                {months.map((month) => (
                  <div className="month-card" key={month.month}>
                    <strong>{month.label.toUpperCase()}</strong>
                    <span>{month.medals} medals</span>
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
                    ? `${Math.round((medals / knownDays) * 100)}% of tracked days with medals`
                    : 'No tracked days yet'}
                </span>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
