import { useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  changeEmail,
  describeAuthError,
  profileOf,
  saveProfile,
  AVATARS,
  type AvatarKind
} from '../../infrastructure/cloud';
import type { SyncStatus } from '../cloudSync';
import type { BeforeInstallPromptEvent } from '../views/LifeScreen';
import { Avatar } from './Avatar';
import { AuthForm } from './CloudPanel';
import { EditorSheet } from './EditorSheet';
import { ChevronRight } from './icons';
import { ThemePicker } from './ThemePicker';

const STATUS: Record<SyncStatus, string> = {
  off: '',
  idle: 'Готово к синхронизации',
  syncing: 'Синхронизация…',
  synced: 'Всё сохранено в облаке',
  error: 'Не удалось синхронизировать'
};

interface Actions {
  onSync: () => void;
  onSignOut: () => void;
  onExport: () => void;
  onImport: (file?: File) => void;
  installPrompt: BeforeInstallPromptEvent | null;
  onInstall: () => void;
  onClose: () => void;
}

/** Everything about me and the app in one place: profile, look, data, account. */
export function ProfileSheet({
  session,
  status,
  ...actions
}: { session: Session | null; status: SyncStatus } & Actions) {
  if (!session) {
    return (
      <EditorSheet title="Профиль" onClose={actions.onClose}>
        <AuthForm showTitle={false} intro="Войдите, чтобы хранить данные в облаке. Новый аккаунт создастся сам." />
      </EditorSheet>
    );
  }
  return <SignedIn session={session} status={status} {...actions} />;
}

function SignedIn({
  session,
  status,
  onSync,
  onSignOut,
  onExport,
  onImport,
  installPrompt,
  onInstall,
  onClose
}: { session: Session; status: SyncStatus } & Actions) {
  const initial = profileOf(session);
  const [name, setName] = useState(initial.name);
  const [avatar, setAvatar] = useState<AvatarKind>(initial.avatar);
  const [email, setEmail] = useState(session.user.email ?? '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const dirty = name.trim() !== initial.name || avatar !== initial.avatar
    || email.trim() !== (session.user.email ?? '');

  const save = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await saveProfile({ name: name.trim(), avatar, reminder: initial.reminder });
      const nextEmail = email.trim();
      if (nextEmail && nextEmail !== session.user.email) {
        await changeEmail(nextEmail);
        setNote(`Мы отправили письмо на ${nextEmail}. Почта сменится после подтверждения.`);
        setEmail(session.user.email ?? '');
      } else {
        setNote('Сохранено');
      }
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  const showInstall = Boolean(installPrompt) || (isIOS() && !isStandalone());

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

        {error && <span role="alert" className="cloud-error">{error}</span>}
        {note && <span className="profile-note">{note}</span>}
        {dirty && (
          <button type="submit" className="primary profile-save" disabled={busy}>Сохранить</button>
        )}
      </form>

      <section className="profile-section">
        <ThemePicker />
      </section>

      <section className="profile-section">
        <h3>Напоминания</h3>
        <p className="profile-muted">Появятся в приложении для телефона.</p>
      </section>

      <section className="profile-section">
        <h3>Данные</h3>
        <div className="profile-row">
          <span>{STATUS[status]}</span>
          <button type="button" className="link-button" disabled={status === 'syncing'} onClick={onSync}>
            Синхронизировать
          </button>
        </div>
        <div className="backup-actions">
          <button type="button" onClick={onExport}>Скачать копию</button>
          <button type="button" onClick={() => importRef.current?.click()}>Восстановить</button>
          <input
            ref={importRef}
            hidden
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              onImport(file);
            }}
          />
        </div>
      </section>

      {showInstall && (
        <section className="profile-section">
          {installPrompt ? (
            <button type="button" className="utility-row" onClick={onInstall}>
              <span><strong>Установить Ritmo</strong><small>Иконка на главном экране</small></span>
              <ChevronRight />
            </button>
          ) : (
            <div className="ios-hint">
              <strong>На экран «Домой»</strong>
              <span>Safari → Поделиться → На экран «Домой»</span>
            </div>
          )}
        </section>
      )}

      <section className="profile-section profile-account">
        <button type="button" className="profile-signout" onClick={onSignOut}>Выйти</button>
      </section>
    </EditorSheet>
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}
