import { useState } from 'react';
import type { NotesView } from '../../application/ritmoService';
import type { Note, NoteEntry } from '../../domain/types';
import { addDays, toISODate } from '../../domain/time';
import { EditorSheet } from '../components/EditorSheet';
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
      <div className="eyebrow">Backlog</div>
      <h1>Notes</h1>

      <button type="button" className="add-new" onClick={() => setCreating(true)}>
        <span>＋</span>
        Add new note
      </button>

      <div className="notes-list">
        {data.notes.map(({ note, entries }) => {
          const open = openNotes[note.id] ?? false;

          return (
            <article
              className={`note-card nested-accordion ${open ? 'expanded' : 'collapsed'}`}
              key={note.id}
            >
              <div className="note-card-head">
                <button
                  type="button"
                  className="goal-accordion-header"
                  aria-expanded={open}
                  onClick={() => setOpenNotes((current) => ({ ...current, [note.id]: !open }))}
                >
                  <span className="goal-accordion-copy">
                    <strong>{note.title}</strong>
                    <small>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</small>
                  </span>
                  <span className={`accordion-chevron ${open ? 'open' : ''}`}>⌄</span>
                </button>
                <button
                  type="button"
                  className="note-menu"
                  aria-label={`Edit note: ${note.title}`}
                  onClick={() => setSheet({ kind: 'note', note })}
                >
                  ⋯
                </button>
              </div>

              {open && (
                <div className="note-entries">
                  {entries.map((entry) => (
                    <button
                      type="button"
                      className="note-entry"
                      key={entry.id}
                      onClick={() => setSheet({ kind: 'entry', entry })}
                    >
                      <span>{entry.text}</span>
                      <i>›</i>
                    </button>
                  ))}
                  {entries.length === 0 && <Empty text="Nothing written down yet." />}

                  <div className="task-add">
                    <input
                      value={entryDrafts[note.id] ?? ''}
                      aria-label={`Add to ${note.title}`}
                      placeholder="Write another line…"
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
                    <button type="button" aria-label="Add line" onClick={() => void addEntry(note.id)}>
                      ＋
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {data.notes.length === 0 && <Empty text="No notes yet." />}
      </div>

      {creating && (
        <EditorSheet
          title="New note"
          onClose={() => { setTitleDraft(''); setCreating(false); }}
        >
          <label className="field">
            <span>Name</span>
            <input
              autoFocus
              value={titleDraft}
              placeholder="Home, work, someday…"
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void createNote();
                }
              }}
            />
          </label>
          <button type="button" className="primary" onClick={() => void createNote()}>Add note</button>
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
    <EditorSheet title="Edit note" onClose={onClose}>
      <label className="field">
        <span>Name</span>
        <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <button
        type="button"
        className="primary"
        onClick={() => void onRename(note, title).then(onClose)}
      >
        Save changes
      </button>

      <button
        type="button"
        className="danger-link"
        onClick={() => void onDelete(note.id).then(onClose)}
      >
        Delete note
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
    <EditorSheet title="Entry" onClose={onClose}>
      <label className="field">
        <span>Text</span>
        <input autoFocus value={text} onChange={(event) => setText(event.target.value)} />
      </label>

      <button
        type="button"
        className="primary"
        onClick={() => void onUpdate(entry, text).then(onClose)}
      >
        Save changes
      </button>

      <div className="editor-divider" />

      <button type="button" className="utility-row" onClick={onAddToGoals}>
        <span><strong>Add to goals</strong><small>Give it a start and an end date</small></span>
        <i>›</i>
      </button>

      <button
        type="button"
        className="danger-link"
        onClick={() => void onDelete(entry.id).then(onClose)}
      >
        Delete entry
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
    <EditorSheet title="Add to goals" onClose={onClose}>
      <div className="data-sheet-copy">
        <strong>{entry.text}</strong>
        <span>This becomes an active goal. The entry stays on its note.</span>
      </div>

      <div className="date-fields">
        <label className="field">
          <span>Start</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label className="field">
          <span>End</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
      </div>

      {invalid && <div className="field-error">The end date is before the start date.</div>}

      <button
        type="button"
        className="primary"
        disabled={invalid}
        onClick={() => void onConfirm(entry, startDate, endDate).then(onClose)}
      >
        Create goal
      </button>
    </EditorSheet>
  );
}
