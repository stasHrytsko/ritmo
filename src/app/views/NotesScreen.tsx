import { useState, type ReactNode } from 'react';
import type { NotesView } from '../../application/ritmoService';
import type { Note, NoteEntry, NoteEntryOutcome, Routine } from '../../domain/types';
import { guessRoutine } from '../../domain/entryGuess';
import { addDays, plural, toISODate } from '../../domain/time';
import { Collapse } from '../components/Collapse';
import { EditorSheet } from '../components/EditorSheet';
import { Chevron, GoalMark, RoutineMark, TaskMark, TrashMark } from '../components/icons';
import { Empty } from '../components/ui';

type Sheet =
  | { kind: 'note'; note: Note }
  | { kind: 'entry'; entry: NoteEntry }
  | null;

/** Where an entry goes: a new goal, a task of a goal, or a routine. */
export type EntryTarget =
  | { kind: 'goal'; startDate: string; endDate: string }
  | { kind: 'task'; goalId: string }
  | { kind: 'routine'; weekdays: number[]; timing: Routine['timing']; time?: string };

const OUTCOME_MARKS: Record<NoteEntryOutcome, { icon: ReactNode; label: string }> = {
  goal: { icon: <GoalMark />, label: 'стала целью' },
  task: { icon: <TaskMark />, label: 'стала задачей' },
  routine: { icon: <RoutineMark />, label: 'стала рутиной' }
};

export function NotesScreen({
  data,
  onCreateNote,
  onRenameNote,
  onDeleteNote,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onConvertEntry
}: {
  data: NotesView;
  onCreateNote: (title: string) => Promise<void>;
  onRenameNote: (note: Note, title: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onAddEntry: (noteId: string, text: string) => Promise<void>;
  onUpdateEntry: (entry: NoteEntry, text: string) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onConvertEntry: (entry: NoteEntry, text: string, target: EntryTarget) => Promise<void>;
}) {
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [entryDrafts, setEntryDrafts] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<Sheet>(null);
  // The entry just turned into something, so its mark can pop in once.
  const [justMade, setJustMade] = useState<string | null>(null);

  const createNote = async () => {
    if (!titleDraft.trim()) return;
    await onCreateNote(titleDraft);
    setTitleDraft('');
    setCreating(false);
  };

  const addEntry = async (noteId: string) => {
    const text = entryDrafts[noteId] ?? '';
    if (!text.trim()) return;
    setEntryDrafts((current) => ({ ...current, [noteId]: '' }));
    await onAddEntry(noteId, text);
    setOpenNotes((current) => ({ ...current, [noteId]: true }));
  };

  return (
    <section className="screen notes-screen">
      <div className="eyebrow">Бэклог</div>
      <h1>Заметки</h1>

      <button type="button" className="add-new" onClick={() => setCreating(true)}>
        <span>＋</span>
        Новая заметка
      </button>

      <div className="notes-list">
        {data.notes.map(({ note, entries }) => {
          const open = openNotes[note.id] ?? false;

          return (
            <article className="note-card nested-accordion" key={note.id}>
              <div className="note-card-head">
                <button
                  type="button"
                  className="goal-accordion-header"
                  aria-expanded={open}
                  onClick={() => setOpenNotes((current) => ({ ...current, [note.id]: !open }))}
                >
                  <span className="goal-accordion-copy">
                    <strong>{note.title}</strong>
                    <small>{entries.length} {plural(entries.length, ['запись', 'записи', 'записей'])}</small>
                  </span>
                  <Chevron />
                </button>
                <button
                  type="button"
                  className="note-menu"
                  aria-label={`Изменить заметку: ${note.title}`}
                  onClick={() => setSheet({ kind: 'note', note })}
                >
                  ⋯
                </button>
              </div>

              <Collapse open={open}>
                <div className="note-entries">
                  {entries.map((entry) => {
                    const mark = entry.madeInto ? OUTCOME_MARKS[entry.madeInto] : undefined;
                    return (
                      <button
                        type="button"
                        className={`note-entry${mark ? ' is-made' : ''}`}
                        key={entry.id}
                        aria-label={mark ? `${entry.text}, ${mark.label}` : undefined}
                        onClick={() => setSheet({ kind: 'entry', entry })}
                      >
                        <span>{entry.text}</span>
                        {mark && (
                          <i className={`entry-mark${justMade === entry.id ? ' is-fresh' : ''}`}>{mark.icon}</i>
                        )}
                      </button>
                    );
                  })}
                  {entries.length === 0 && <Empty text="Пока ничего не записано." />}

                  <div className="task-add">
                    <input
                      value={entryDrafts[note.id] ?? ''}
                      aria-label={`Добавить в «${note.title}»`}
                      placeholder="Ещё одна строка…"
                      onChange={(event) =>
                        setEntryDrafts((current) => ({ ...current, [note.id]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void addEntry(note.id);
                        }
                      }}
                    />
                    <button type="button" aria-label="Добавить строку" onClick={() => void addEntry(note.id)}>
                      ＋
                    </button>
                  </div>
                </div>
              </Collapse>
            </article>
          );
        })}
        {data.notes.length === 0 && <Empty text="Заметок пока нет." />}
      </div>

      {creating && (
        <EditorSheet
          title="Новая заметка"
          onClose={() => { setTitleDraft(''); setCreating(false); }}
        >
          <label className="field">
            <span>Название</span>
            <input
              autoFocus
              value={titleDraft}
              placeholder="Дом, работа, когда-нибудь…"
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void createNote();
                }
              }}
            />
          </label>
          <button type="button" className="primary" onClick={() => void createNote()}>Добавить</button>
        </EditorSheet>
      )}

      {sheet?.kind === 'note' && (
        <NoteSheet
          note={sheet.note}
          onClose={() => setSheet(null)}
          onRename={onRenameNote}
          onDelete={onDeleteNote}
        />
      )}

      {sheet?.kind === 'entry' && (
        <EntrySheet
          entry={sheet.entry}
          goals={data.goals}
          onClose={() => setSheet(null)}
          onUpdate={onUpdateEntry}
          onDelete={onDeleteEntry}
          onConvert={async (text, target) => {
            await onConvertEntry(sheet.entry, text, target);
            setJustMade(sheet.entry.id);
          }}
        />
      )}
    </section>
  );
}

function NoteSheet({
  note,
  onClose,
  onRename,
  onDelete
}: {
  note: Note;
  onClose: () => void;
  onRename: (note: Note, title: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(note.title);

  return (
    <EditorSheet title="Заметка" onClose={onClose}>
      <label className="field">
        <span>Название</span>
        <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <button
        type="button"
        className="primary"
        onClick={() => void onRename(note, title).then(onClose)}
      >
        Сохранить
      </button>

      <button
        type="button"
        className="danger-link"
        onClick={() => void onDelete(note.id).then(onClose)}
      >
        Удалить заметку
      </button>
    </EditorSheet>
  );
}

const SPANS = [
  { label: 'Неделя', days: 7 },
  { label: 'Месяц', days: 30 },
  { label: '3 месяца', days: 91 }
];

const PARTS = [
  { label: 'Утро', time: '08:00' },
  { label: 'День', time: '13:00' },
  { label: 'Вечер', time: '19:00' },
  { label: 'Любое', time: '' }
];

const WEEKDAYS = [
  { value: 1, label: 'П', name: 'Понедельник' },
  { value: 2, label: 'В', name: 'Вторник' },
  { value: 3, label: 'С', name: 'Среда' },
  { value: 4, label: 'Ч', name: 'Четверг' },
  { value: 5, label: 'П', name: 'Пятница' },
  { value: 6, label: 'С', name: 'Суббота' },
  { value: 7, label: 'В', name: 'Воскресенье' }
];

const shortDate = (date: Date) =>
  new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(date).replace('.', '');

const CREATE_LABELS: Record<EntryTarget['kind'], string> = {
  goal: 'Создать цель',
  task: 'Добавить в цель',
  routine: 'Создать рутину'
};

function EntrySheet({
  entry,
  goals,
  onClose,
  onUpdate,
  onDelete,
  onConvert
}: {
  entry: NoteEntry;
  goals: NotesView['goals'];
  onClose: () => void;
  onUpdate: (entry: NoteEntry, text: string) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
  onConvert: (text: string, target: EntryTarget) => Promise<void>;
}) {
  const [text, setText] = useState(entry.text);
  const [kind, setKind] = useState<EntryTarget['kind'] | null>(null);
  const [span, setSpan] = useState(1);
  const [goalId, setGoalId] = useState(goals[0]?.id);
  const [guess] = useState(() => guessRoutine(entry.text));
  const [part, setPart] = useState(guess.part);
  const [time, setTime] = useState(PARTS[guess.part].time || '08:00');
  const [weekdays, setWeekdays] = useState(guess.weekdays);
  const [saving, setSaving] = useState(false);

  const start = new Date();
  const end = addDays(start, SPANS[span].days);
  const spanShare = SPANS[span].days / SPANS[SPANS.length - 1].days;
  const trimmed = text.trim();

  // Leaving the sheet keeps an edited text; nothing else needs a save button.
  const close = () => {
    if (trimmed && trimmed !== entry.text) void onUpdate(entry, trimmed);
    onClose();
  };

  const target = (): EntryTarget | null => {
    if (kind === 'goal') return { kind, startDate: toISODate(start), endDate: toISODate(end) };
    if (kind === 'task') return goalId ? { kind, goalId } : null;
    if (kind === 'routine') {
      const anytime = PARTS[part].time === '';
      return { kind, weekdays, timing: anytime ? 'anytime' : 'exact', time: anytime ? undefined : time };
    }
    return null;
  };

  const create = async () => {
    const chosen = target();
    if (!chosen || !trimmed || saving) return;
    setSaving(true);
    try {
      await onConvert(trimmed, chosen);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const tiles: Array<{ value: EntryTarget['kind']; label: string; icon: ReactNode; disabled?: boolean }> = [
    { value: 'goal', label: 'Цель', icon: <GoalMark /> },
    { value: 'task', label: 'Задача', icon: <TaskMark />, disabled: goals.length === 0 },
    { value: 'routine', label: 'Рутина', icon: <RoutineMark /> }
  ];

  return (
    <EditorSheet title="Запись" onClose={close}>
      <div className="entry-edit">
        <input
          value={text}
          aria-label="Текст записи"
          onChange={(event) => setText(event.target.value)}
        />
        <button
          type="button"
          className="icon-button danger"
          aria-label="Удалить запись"
          onClick={() => void onDelete(entry.id).then(onClose)}
        >
          <TrashMark />
        </button>
      </div>

      <div className="make-tiles" role="group" aria-label="Сделать из записи">
        {tiles.map((tile) => (
          <button
            type="button"
            key={tile.value}
            className="make-tile"
            aria-pressed={kind === tile.value}
            disabled={tile.disabled}
            onClick={() => setKind(tile.value)}
          >
            {tile.icon}
            {tile.label}
          </button>
        ))}
      </div>

      <Collapse open={kind === 'goal'}>
        <div className="make-options">
          <div className="chips" role="group" aria-label="Срок">
            {SPANS.map((option, index) => (
              <button
                type="button"
                key={option.label}
                className="chip"
                aria-pressed={span === index}
                onClick={() => setSpan(index)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="span-line" aria-label={`С ${shortDate(start)} по ${shortDate(end)}`}>
            <span className="span-track" />
            <span className="span-fill" style={{ width: `${spanShare * 100}%` }} />
            <span className="span-date">{shortDate(start)}</span>
            <span className="span-date is-end" style={{ left: `${spanShare * 100}%` }}>{shortDate(end)}</span>
          </div>
        </div>
      </Collapse>

      <Collapse open={kind === 'task'}>
        <div className="make-options">
          <div className="chips" role="group" aria-label="В какую цель">
            {goals.map((goal) => (
              <button
                type="button"
                key={goal.id}
                className="chip"
                aria-pressed={goalId === goal.id}
                onClick={() => setGoalId(goal.id)}
              >
                {goal.name}
              </button>
            ))}
          </div>
        </div>
      </Collapse>

      <Collapse open={kind === 'routine'}>
        <div className="make-options">
          <div className="chips" role="group" aria-label="Когда">
            {PARTS.map((option, index) => (
              <button
                type="button"
                key={option.label}
                className="chip"
                aria-pressed={part === index}
                onClick={() => {
                  setPart(index);
                  if (option.time) setTime(option.time);
                }}
              >
                {option.label}
                {option.time && <small>{index === part ? time : option.time}</small>}
              </button>
            ))}
          </div>
          {PARTS[part].time !== '' && (
            <input
              type="time"
              className="make-time"
              aria-label="Во сколько"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          )}
          <div className="weekday-picker" role="group" aria-label="Дни">
            {WEEKDAYS.map((day) => {
              const selected = weekdays.includes(day.value);
              return (
                <button
                  type="button"
                  key={day.value}
                  className={selected ? 'active' : ''}
                  aria-pressed={selected}
                  aria-label={day.name}
                  onClick={() =>
                    setWeekdays((current) =>
                      selected
                        ? current.length > 1 ? current.filter((value) => value !== day.value) : current
                        : [...current, day.value].sort((a, b) => a - b)
                    )
                  }
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>
      </Collapse>

      {kind && (
        <button
          type="button"
          className="primary make-create"
          disabled={!trimmed || saving || !target()}
          onClick={() => void create()}
        >
          {CREATE_LABELS[kind]}
        </button>
      )}
    </EditorSheet>
  );
}
