import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cloudConfigured, describeAuthError, requestCode, verifyCode } from '../../infrastructure/cloud';
import type { SyncStatus } from '../cloudSync';

const STATUS_LABELS: Record<SyncStatus, string> = {
  off: '',
  idle: 'Готово к синхронизации',
  syncing: 'Синхронизация…',
  synced: 'Всё сохранено в облаке',
  error: 'Не удалось синхронизировать'
};

/** Email + one-time code. The same flow signs in and registers. */
export function AuthForm({
  intro,
  className = 'cloud-panel',
  showTitle = true
}: {
  intro?: string;
  className?: string;
  showTitle?: boolean;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          if (!sent) {
            await requestCode(email.trim(), name.trim() || undefined);
            setSent(true);
          } else {
            await verifyCode(email.trim(), code.trim());
            setCode('');
            setSent(false);
          }
        });
      }}
    >
      <div className="data-sheet-copy">
        {showTitle && <strong>Облако</strong>}
        <span>
          {sent
            ? `Код ушёл на ${email}. Введите его ниже.`
            : intro ?? 'Введите почту, мы пришлём код. Пароль не нужен.'}
        </span>
      </div>
      <input
        autoComplete="name"
        placeholder="Как вас зовут (необязательно)"
        value={name}
        disabled={sent || busy}
        onChange={(event) => setName(event.target.value)}
      />
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="Почта"
        value={email}
        disabled={sent || busy}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      {sent && (
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Код из письма"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
        />
      )}
      {error && <span role="alert" className="cloud-error">{error}</span>}
      <div className="backup-actions">
        <button type="submit" className="primary" disabled={busy}>{sent ? 'Войти' : 'Получить код'}</button>
        {sent && <button type="button" onClick={() => { setSent(false); setCode(''); }}>Другая почта</button>}
      </div>
    </form>
  );
}

export function CloudPanel({
  session,
  status,
  message,
  onSync,
  onSignOut
}: {
  session: Session | null;
  status: SyncStatus;
  message: string | null;
  onSync: () => void;
  onSignOut: () => void;
}) {
  if (!cloudConfigured) return null;
  if (!session) return <AuthForm />;

  return (
    <div className="cloud-panel">
      <div className="data-sheet-copy">
        <strong>Облако</strong>
        <span>{(session.user.user_metadata?.name as string | undefined) ?? session.user.email}</span>
      {session.user.user_metadata?.name ? <span>{session.user.email}</span> : null}
        <span>{STATUS_LABELS[status]}{message ? `: ${message}` : ''}</span>
      </div>
      <div className="backup-actions">
        <button type="button" disabled={status === 'syncing'} onClick={onSync}>Синхронизировать</button>
        <button type="button" onClick={onSignOut}>Выйти</button>
      </div>
    </div>
  );
}
