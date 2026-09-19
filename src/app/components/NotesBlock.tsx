import { useState } from 'react';
import type { Note } from '../../domain/types';
import { AccordionHeader, Empty } from './ui';

/**
 * The standing backlog: anything to do some day. Not tied to the date on
 * screen — it is the same list whichever day you open.
 */
export function NotesBlock({
  notes,
  open,
  onToggleOpen,
  onAdd,
  onToggle,
  onDelete
}: {
  notes: Note[];
  open: boolean;
  onToggleOpen: () => void;
  onAdd: (text: string) => Promise<void>;
  onToggle: (note: Note) => Promise<void>;
  onDelete: (note: Note) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const openCount = notes.filter((note) => note.status === 'open').length;

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await onAdd(text);
  };

  return (
    <section className={`content-block accordion-block ${open ? 'expanded' : 'collapsed'}`}>
      <AccordionHeader
        title="Notes"
        meta={String(openCount)}
        open={open}
        onToggle={onToggleOpen}
      />

      {open && (
        <div className="accordion-content">
          <div className="task-add note-add">
            <input
              value={draft}
              aria-label="New note"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void add();
                }
              }}
              placeholder="Something to do some day…"
            />
            <button type="button" aria-label="Add note" onClick={() => void add()}>＋</button>
          </div>

          <div className="note-list">
            {notes.map((note) => (
              <div className={`note-row ${note.status === 'done' ? 'done' : ''}`} key={note.id}>
                <button
                  type="button"
                  className="note-check"
                  aria-pressed={note.status === 'done'}
                  aria-label={note.text}
                  onClick={() => void onToggle(note)}
                >
                  <span className="check-circle">{note.status === 'done' ? '✓' : ''}</span>
                  <span className="note-text">{note.text}</span>
                </button>
                <button
                  type="button"
                  className="note-delete"
                  aria-label={`Delete note: ${note.text}`}
                  onClick={() => void onDelete(note)}
                >
                  ×
                </button>
              </div>
            ))}
            {notes.length === 0 && <Empty text="Nothing noted yet." />}
          </div>
        </div>
      )}
    </section>
  );
}
