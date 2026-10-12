import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  changeEmail,
  describeAuthError,
  profileOf,
  saveProfile,
  AVATARS,
  type AvatarKind,
  type ReminderMode
} from '../../infrastructure/cloud';
import type { SyncStatus } from '../cloudSync';
import { Avatar } from './Avatar';
import { AuthForm } from './CloudPanel';
import { Chevron } from './icons';
import { Collapse } from './Collapse';
import { EditorSheet } from './EditorSheet';

const REMINDERS: { value: ReminderMode; label: string; hint: string }[] = [
  { value: 'off', label: 'Выключено', hint: 'Без напоминаний' },
  { value: 'morning', label: 'Утром', hint: 'Раз в день — перед первым действием в графике' },
  { value: 'evening', label: 'Вечером', hint: 'Раз в день — перед последним действием в графике' },
  { value: 'each', label: 'Каждое действие', hint: 'Перед каждым действием из графика' }
];

const STATUS: Record<SyncStatus, string> = {
  off: '',
  idle: 'Готово к синхронизации',
  syncing: 'Синхронизация…',
  synced: 'Всё сохранено в облаке',
  error: 'Не удалось синхронизировать'
};

export function ProfileSheet({
  session,
  status,
  onSync,
  onSignOut,
  onClose
}: {
  session: Session | null;
  status: SyncStatus;
  onSync: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  if (!session) {
    return (
      <EditorSheet title="Профиль" onClose={onClose}>
        <AuthForm showTitle={false} intro="Войдите, чтобы хранить данные в облаке. Новый аккаунт создастся сам." />
      </EditorSheet>
    );
  }
  return <SignedIn session={session} status={status} onSync={onSync} onSignOut={onSignOut} onClose={onClose} />;
}

function SignedIn({
  session,
  status,
  onSync,
  onSignOut,
  onClose
}: {
  session: Session;
  status: SyncStatus;
  onSync: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const initial = profileOf(session);
  const [name, setName] = useState(initial.name);
  const [avatar, setAvatar] = useState<AvatarKind>(initial.avatar);
  const [reminder, setReminder] = useState<ReminderMode>(initial.reminder);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [email, setEmail] = useState(session.user.email ?? '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await saveProfile({ name: name.trim(), avatar, reminder });
      const nextEmail = email.trim();
      if (nextEmail && nextEmail !== session.user.email) {
        await changeEmail(nextEmail);
        setNote(`Мы отправили письмо на ${nextEmail}. Почта сменится после подтверждения.`);
        setEmail(session.user.email ?? '');
      } else {
        onClose();
      }
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <EditorSheet title="Профиль" onClose={onClose}>
      <form
        className="profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="avatar-picker" role="radiogroup" aria-label="Аватар">
          {AVATARS.map((kind, index) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={avatar === kind}
              aria-label={`Аватар ${index + 1}`}
              className={avatar === kind ? 'selected' : ''}
              onClick={() => setAvatar(kind)}
            >
              <Avatar kind={kind} size={66} />
            </button>
          ))}
        </div>

        <label className="profile-field">
          <span>Имя</span>
          <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="profile-field">
          <span>Почта</span>
          <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <div className="profile-reminders">
          <button
            type="button"
            className="profile-reminders-toggle"
            aria-expanded={remindersOpen}
            onClick={() => setRemindersOpen((current) => !current)}
          >
            <span>
              <small>Напоминание</small>
              <strong>{REMINDERS.find((option) => option.value === reminder)?.label}</strong>
            </span>
            <Chevron />
          </button>
          <Collapse open={remindersOpen}>
            <div className="profile-reminder-options" role="radiogroup" aria-label="Напоминание">
              {REMINDERS.map((option) => (
                <label key={option.value} className={reminder === option.value ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="reminder"
                    checked={reminder === option.value}
                    onChange={() => {
                      setReminder(option.value);
                      setRemindersOpen(false);
                    }}
                  />
                  <span><strong>{option.label}</strong><small>{option.hint}</small></span>
                </label>
              ))}
            </div>
          </Collapse>
        </div>

        {error && <span role="alert" className="cloud-error">{error}</span>}
        {note && <span className="profile-note">{note}</span>}

        <div className="backup-actions">
          <button type="submit" className="primary" disabled={busy}>Сохранить</button>
          <button type="button" onClick={onSignOut}>Выйти</button>
        </div>

        <div className="profile-sync">
          <span>{STATUS[status]}</span>
          <button type="button" disabled={status === 'syncing'} onClick={onSync}>Синхронизировать</button>
        </div>
      </form>
    </EditorSheet>
  );
}
