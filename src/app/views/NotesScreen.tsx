import { useState } from 'react';
import type { NotesView } from '../../application/ritmoService';
import type { Note, NoteEntry } from '../../domain/types';
import { addDays, plural, toISODate } from '../../domain/time';
import { Collapse } from '../components/Collapse';
import { EditorSheet } from '../components/EditorSheet';
import { Chevron, ChevronRight } from '../components/icons';
import { Empty } from '../components/ui';

type Sheet =
  | { kind: 'note'; note: Note }
  | { kind: 'entry'; entry: NoteEntry }
  | { kind: 'goal'; entry: NoteEntry }
  | null;

export function NotesScreen({
  data,
  onCreateNote,
  onRenameNote,
  onDeleteNote,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onAddEntryToGoals
}: {
  data: NotesView;
  onCreateNote: (title: string) => Promise<void>;
  onRenameNote: (note: Note, title: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onAddEntry: (noteId: string, text: string) => Promise<void>;
  onUpdateEntry: (entry: NoteEntry, text: string) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onAddEntryToGoals: (entry: NoteEntry, startDate: string, endDate: string) => Promise<void>;
}) {
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [entryDrafts, setEntryDrafts] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<Sheet>(null);

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
                  {entries.map((entry) => (
                    <button
                      type="button"
                      className="note-entry"
                      key={entry.id}
                      onClick={() => setSheet({ kind: 'entry', entry })}
                    >
                      <span>{entry.text}</span>
                      <ChevronRight />
                    </button>
                  ))}
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
          onClose={() => setSheet(null)}
          onUpdate={onUpdateEntry}
          onDelete={onDeleteEntry}
          onAddToGoals={() => setSheet({ kind: 'goal', entry: sheet.entry })}
        />
      )}

      {sheet?.kind === 'goal' && (
        <GoalSheet
          entry={sheet.entry}
          onClose={() => setSheet(null)}
          onConfirm={onAddEntryToGoals}
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

function EntrySheet({
  entry,
  onClose,
  onUpdate,
  onDelete,
  onAddToGoals
}: {
  entry: NoteEntry;
  onClose: () => void;
  onUpdate: (entry: NoteEntry, text: string) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
  onAddToGoals: () => void;
}) {
  const [text, setText] = useState(entry.text);

  return (
    <EditorSheet title="Запись" onClose={onClose}>
      <label className="field">
        <span>Текст</span>
        <input autoFocus value={text} onChange={(event) => setText(event.target.value)} />
      </label>

      <button
        type="button"
        className="primary"
        onClick={() => void onUpdate(entry, text).then(onClose)}
      >
        Сохранить
      </button>

      <div className="editor-divider" />

      <button type="button" className="utility-row" onClick={onAddToGoals}>
        <span><strong>Сделать целью</strong><small>Указать даты начала и конца</small></span>
        <ChevronRight />
      </button>

      <button
        type="button"
        className="danger-link"
        onClick={() => void onDelete(entry.id).then(onClose)}
      >
        Удалить запись
      </button>
    </EditorSheet>
  );
}

function GoalSheet({
  entry,
  onClose,
  onConfirm
}: {
  entry: NoteEntry;
  onClose: () => void;
  onConfirm: (entry: NoteEntry, startDate: string, endDate: string) => Promise<void>;
}) {
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [endDate, setEndDate] = useState(toISODate(addDays(new Date(), 30)));

  const invalid = endDate < startDate;

  return (
    <EditorSheet title="Сделать целью" onClose={onClose}>
      <div className="data-sheet-copy">
        <strong>{entry.text}</strong>
        <span>Появится активная цель. Запись останется в заметке.</span>
      </div>

      <div className="date-fields">
        <label className="field">
          <span>Начало</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Конец</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
      </div>

      {invalid && <div className="field-error">Дата конца раньше даты начала.</div>}

      <button
        type="button"
        className="primary"
        disabled={invalid}
        onClick={() => void onConfirm(entry, startDate, endDate).then(onClose)}
      >
        Создать цель
      </button>
    </EditorSheet>
  );
}
