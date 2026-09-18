import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Goal, GoalTask, Routine } from '../domain/types';
import { addDays, formatRange, monthName, toISODate, weekdayName, weekEnd, weekNumber, weekStart } from '../domain/time';
import { repositories } from '../infrastructure/repositories';
import { RitmoService } from '../application/ritmoService';

type View = 'day' | 'week' | 'month' | 'year' | 'life';
const weekdays = [
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
  { value: 7, label: 'S' }
];

export function App() {
  const service = useMemo(() => new RitmoService(repositories), []);
  const [view, setView] = useState<View>('day');
  const [data, setData] = useState<any>(null);
  const [lifeTab, setLifeTab] = useState<'routines' | 'goals'>('routines');
  const [busy, setBusy] = useState(false);
  const [routineDraft, setRoutineDraft] = useState<{ id?: string; name: string; weekdays: number[] }>({
    name: '',
    weekdays: [1, 2, 3, 4, 5, 6, 7]
  });
  const [goalDraft, setGoalDraft] = useState({ name: '', startDate: toISODate(new Date()), endDate: toISODate(addDays(new Date(), 30)) });
  const [taskDraft, setTaskDraft] = useState<Record<string, string>>({});
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (target = view) => {
    setBusy(true);
    try {
      if (target === 'day') setData(await service.getToday());
      if (target === 'week') setData(await service.getWeek());
      if (target === 'month') setData(await service.getMonth());
      if (target === 'year') setData(await service.getYear());
      if (target === 'life') setData(await service.getLife());
    } finally {
      setBusy(false);
    }
  }, [service, view]);

  useEffect(() => {
    service.init().then(() => refresh(view));
  }, [service, refresh, view]);

  const navigate = (target: View) => {
    setView(target);
    void refresh(target);
  };

  const createRoutine = async () => {
    if (!routineDraft.name.trim() || routineDraft.weekdays.length === 0) return;
    if (routineDraft.id && data?.routines) {
      const existing = data.routines.find((item: Routine) => item.id === routineDraft.id);
      if (existing) {
        await service.updateRoutine({ ...existing, name: routineDraft.name.trim(), weekdays: routineDraft.weekdays });
      }
    } else {
      await service.createRoutine(routineDraft.name, routineDraft.weekdays);
    }
    setRoutineDraft({ name: '', weekdays: [1, 2, 3, 4, 5, 6, 7] });
    await refresh('life');
  };

  const createGoal = async () => {
    if (!goalDraft.name.trim()) return;
    await service.createGoal(goalDraft.name, goalDraft.startDate, goalDraft.endDate);
    setGoalDraft({ name: '', startDate: toISODate(new Date()), endDate: toISODate(addDays(new Date(), 30)) });
    await refresh('life');
  };

  const exportBackup = async () => {
    const backup = await service.exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ritmo-backup-${toISODate(new Date())}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    const payload = JSON.parse(await file.text());
    await service.importBackup(payload);
    await refresh('life');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('day')}>Ritmo<span>.</span></button>
        <button className="life-link" onClick={() => navigate('life')}>Life</button>
      </header>

      {view !== 'life' && (
        <nav className="scale-switch" aria-label="Time scale">
          {(['day', 'week', 'month', 'year'] as View[]).map((item) => (
            <button key={item} className={view === item ? 'active' : ''} onClick={() => navigate(item)}>
              {item}
            </button>
          ))}
        </nav>
      )}

      <main className={busy ? 'loading' : ''}>
        {view === 'day' && data && (
          <section className="screen">
            <div className="date-hero">
              <div>
                <div className="date-number">{data.date.getDate()}</div>
                <div className="date-meta">
                  <strong>{monthName(data.date).toUpperCase()}</strong>
                  <span>{weekdayName(data.date).toUpperCase()}</span>
                </div>
              </div>
              <div className="countdown">
                <strong>{data.daysLeft}</strong><span>days left</span>
                <strong>{data.weeksLeft}</strong><span>weeks left</span>
              </div>
            </div>

            <WeekStrip medal={data.medal} />

            {data.medal && (
              <div className="medal-card">
                <div className="medal-mark">◎</div>
                <div><strong>Day complete</strong><span>You closed every routine planned for today.</span></div>
              </div>
            )}

            <SectionHeader title="Routine" meta={`${data.routines.filter((x:any)=>x.scheduled && x.done).length} / ${data.routines.filter((x:any)=>x.scheduled).length}`} />
            <div className="stack">
              {data.routines.filter((state:any) => state.scheduled).map((state:any) => (
                <button
                  key={state.routine.routineId}
                  className={`check-row ${state.done ? 'done' : ''}`}
                  onClick={async () => { await service.toggleRoutine(data.date, state.routine.routineId); await refresh('day'); }}
                >
                  <span className="check-circle">{state.done ? '✓' : ''}</span>
                  <span>{state.routine.name}</span>
                </button>
              ))}
              {data.routines.filter((state:any) => state.scheduled).length === 0 && <Empty text="No routines planned for today." />}
            </div>

            <SectionHeader title="Goals" meta={String(data.goals.reduce((sum:number, x:any)=>sum+x.tasks.length,0))} />
            <div className="stack">
              {data.goals.map((group:any) => (
                <article className="goal-block" key={group.goal.id}>
                  <div className="goal-kicker">{group.goal.name}</div>
                  {group.tasks.map(({ task }: { task: GoalTask }) => (
                    <button key={task.id} className={`check-row ${task.status === 'done' ? 'done' : ''}`} onClick={async () => { await service.toggleGoalTask(task); await refresh('day'); }}>
                      <span className="check-circle">{task.status === 'done' ? '✓' : ''}</span>
                      <span>{task.title}</span>
                    </button>
                  ))}
                </article>
              ))}
              {data.goals.length === 0 && <Empty text="No goal tasks in this week yet." />}
            </div>
          </section>
        )}

        {view === 'week' && data && (
          <section className="screen">
            <Eyebrow text={`Week ${data.week.weekNumber}`} />
            <h1>{data.label}</h1>
            <div className="week-grid">
              {data.days.map((day:any) => (
                <div className="day-card" key={day.date.toISOString()}>
                  <span>{weekdayName(day.date, 'short').slice(0,1)}</span>
                  <strong>{day.date.getDate()}</strong>
                  <div className={`medal-dot ${day.medal ? 'earned' : ''}`}>{day.medal ? '✓' : ''}</div>
                  <small>{day.done}/{day.total}</small>
                </div>
              ))}
            </div>
            <SectionHeader title="Goal tasks" meta={`${data.tasks.filter((x:any)=>x.task.status==='done').length} / ${data.tasks.length}`} />
            <div className="stack">
              {data.tasks.map(({ task, goal }: any) => (
                <button key={task.id} className={`check-row ${task.status === 'done' ? 'done' : ''}`} onClick={async()=>{await service.toggleGoalTask(task); await refresh('week');}}>
                  <span className="check-circle">{task.status === 'done' ? '✓' : ''}</span>
                  <span><b>{goal?.name}</b><small>{task.title}</small></span>
                </button>
              ))}
              {!data.tasks.length && <Empty text="No goal tasks planned for this week." />}
            </div>
          </section>
        )}

        {view === 'month' && data && (
          <section className="screen">
            <Eyebrow text={String(data.date.getFullYear())} />
            <h1>{data.name}</h1>
            <div className="calendar-head">{['M','T','W','T','F','S','S'].map((x,i)=><span key={i}>{x}</span>)}</div>
            <div className="month-grid">
              {Array.from({length:(new Date(data.date.getFullYear(), data.date.getMonth(), 1).getDay()+6)%7}).map((_,i)=><span key={`pad-${i}`} />)}
              {data.days.map((day:any)=>(
                <div className={`month-day ${day.medal ? 'earned' : ''} ${!day.known ? 'unknown' : ''}`} key={day.date.toISOString()}>
                  <span>{day.date.getDate()}</span>{day.medal && <b>✓</b>}
                </div>
              ))}
            </div>
            <SectionHeader title="Goals" meta="" />
            <div className="stack">
              {data.goals.map((item:any)=>(
                <div className="progress-row" key={item.goal.id}>
                  <span><strong>{item.goal.name}</strong><small>{item.goal.startDate} → {item.goal.endDate}</small></span>
                  <b>{item.done}/{item.total}</b>
                </div>
              ))}
              {!data.goals.length && <Empty text="No goals yet." />}
            </div>
          </section>
        )}

        {view === 'year' && data && (
          <section className="screen">
            <Eyebrow text="Year" />
            <div className="year-hero">
              <h1>{data.year}</h1>
              <div><strong>{data.currentDay}</strong><span>day of {data.totalDays}</span></div>
            </div>
            <div className="year-counts">
              <div><strong>{data.daysLeft}</strong><span>days left</span></div>
              <div><strong>{data.weeksLeft}</strong><span>weeks left</span></div>
            </div>
            <div className="months-grid">
              {data.months.map((month:any)=>(
                <div className="month-card" key={month.month}>
                  <strong>{month.label.toUpperCase()}</strong>
                  <span>{month.medals} medals</span>
                  <div className="month-bar"><i style={{width:`${month.knownDays ? Math.round(month.medals/month.knownDays*100) : 0}%`}} /></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === 'life' && data && (
          <section className="screen">
            <Eyebrow text="Life" />
            <h1>Your system</h1>
            <div className="segmented">
              <button className={lifeTab==='routines'?'active':''} onClick={()=>setLifeTab('routines')}>Routines</button>
              <button className={lifeTab==='goals'?'active':''} onClick={()=>setLifeTab('goals')}>Goals</button>
            </div>

            {lifeTab === 'routines' && (
              <>
                <div className="form-card">
                  <label>{routineDraft.id ? 'Edit routine' : 'New routine'}<input value={routineDraft.name} onChange={(e)=>setRoutineDraft({...routineDraft,name:e.target.value})} placeholder="Gym, water, walk the dog…" /></label>
                  <div className="weekday-picker">
                    {weekdays.map((day)=>(
                      <button key={day.value} className={routineDraft.weekdays.includes(day.value)?'active':''} onClick={()=>setRoutineDraft({...routineDraft,weekdays:routineDraft.weekdays.includes(day.value)?routineDraft.weekdays.filter(x=>x!==day.value):[...routineDraft.weekdays,day.value]})}>{day.label}</button>
                    ))}
                  </div>
                  <button className="primary" onClick={createRoutine}>{routineDraft.id ? 'Save routine' : 'Add routine'}</button>
                </div>
                <div className="stack">
                  {data.routines.map((routine: Routine)=>(
                    <div className="manage-row" key={routine.id}>
                      <button className="manage-main" onClick={()=>setRoutineDraft({id:routine.id,name:routine.name,weekdays:routine.weekdays})}>
                        <strong>{routine.name}</strong><small>{routine.weekdays.map((n)=>weekdays[n-1].label).join(' · ')}</small>
                      </button>
                      <button className={`status-pill ${routine.active?'active':''}`} onClick={async()=>{await service.updateRoutine({...routine,active:!routine.active});await refresh('life');}}>{routine.active?'On':'Off'}</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {lifeTab === 'goals' && (
              <>
                <div className="form-card">
                  <label>New goal<input value={goalDraft.name} onChange={(e)=>setGoalDraft({...goalDraft,name:e.target.value})} placeholder="Release first game" /></label>
                  <div className="date-fields">
                    <label>Start<input type="date" value={goalDraft.startDate} onChange={(e)=>setGoalDraft({...goalDraft,startDate:e.target.value})}/></label>
                    <label>End<input type="date" value={goalDraft.endDate} onChange={(e)=>setGoalDraft({...goalDraft,endDate:e.target.value})}/></label>
                  </div>
                  <button className="primary" onClick={createGoal}>Add goal</button>
                </div>
                <div className="stack">
                  {data.goals.map((goal: Goal)=>{
                    const goalTasks = data.tasks.filter((task:GoalTask)=>task.goalId===goal.id);
                    return (
                      <article className="goal-manage" key={goal.id}>
                        <div className="goal-head"><div><strong>{goal.name}</strong><small>{goal.startDate} → {goal.endDate}</small></div><button className="status-pill active" onClick={async()=>{await service.updateGoal({...goal,status:goal.status==='done'?'active':'done'});await refresh('life');}}>{goal.status}</button></div>
                        {goalTasks.map((task:GoalTask)=><button className={`check-row ${task.status==='done'?'done':''}`} key={task.id} onClick={async()=>{await service.toggleGoalTask(task);await refresh('life');}}><span className="check-circle">{task.status==='done'?'✓':''}</span><span>{task.title}</span></button>)}
                        <div className="task-add"><input value={taskDraft[goal.id]||''} onChange={(e)=>setTaskDraft({...taskDraft,[goal.id]:e.target.value})} placeholder="Weekly task" /><button onClick={async()=>{const value=taskDraft[goal.id]?.trim();if(!value)return;await service.addGoalTask(goal.id,value);setTaskDraft({...taskDraft,[goal.id]:''});await refresh('life');}}>+</button></div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}

            <SectionHeader title="Backup" meta="JSON" />
            <div className="backup-row">
              <button className="secondary" onClick={exportBackup}>Export</button>
              <button className="secondary" onClick={()=>importRef.current?.click()}>Import</button>
              <input ref={importRef} hidden type="file" accept="application/json" onChange={(e)=>void importBackup(e.target.files?.[0])}/>
            </div>
          </section>
        )}
      </main>

      <footer className="bottom-nav">
        <button className={view!=='life'?'active':''} onClick={()=>navigate('day')}><span>◉</span>Timeline</button>
        <button className={view==='life'?'active':''} onClick={()=>navigate('life')}><span>⌁</span>Life</button>
      </footer>
    </div>
  );
}

function SectionHeader({ title, meta }: { title: string; meta: string }) {
  return <div className="section-header"><h2>{title}</h2><span>{meta}</span></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function Eyebrow({ text }: { text: string }) {
  return <div className="eyebrow">{text}</div>;
}

function WeekStrip({ medal }: { medal: boolean }) {
  const start = weekStart(new Date());
  const today = toISODate(new Date());
  return (
    <div className="week-strip">
      {Array.from({length:7},(_,index)=>{
        const date=addDays(start,index);
        const isToday=toISODate(date)===today;
        return <div className={isToday?'today':''} key={index}><span>{weekdayName(date,'short').slice(0,1)}</span><b>{date.getDate()}</b>{isToday&&medal?<i>✓</i>:<i/>}</div>;
      })}
    </div>
  );
}
