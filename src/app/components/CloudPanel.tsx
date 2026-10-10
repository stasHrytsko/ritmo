import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cloudConfigured, requestCode, signOut, verifyCode } from '../../infrastructure/cloud';
import type { SyncStatus } from '../cloudSync';

const STATUS_LABELS: Record<SyncStatus, string> = {
  off: '',
  idle: 'Готово к синхронизации',
  syncing: 'Синхронизация…',
  synced: 'Всё сохранено в облаке',
  error: 'Не удалось синхронизировать'
};

export function CloudPanel({
  session,
  status,
  message,
  onSync
}: {
  session: Session | null;
  status: SyncStatus;
  message: string | null;
  onSync: () => void;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!cloudConfigured) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (session) {
    return (
      <div className="cloud-panel">
        <div className="data-sheet-copy">
          <strong>Облако</strong>
          <span>{session.user.email}</span>
          <span>{STATUS_LABELS[status]}{message ? `: ${message}` : ''}</span>
        </div>
        <div className="backup-actions">
          <button type="button" disabled={status === 'syncing'} onClick={onSync}>Синхронизировать</button>
          <button type="button" onClick={() => void run(signOut)}>Выйти</button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="cloud-panel"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          if (!sent) {
            await requestCode(email.trim());
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
        <strong>Облако</strong>
        <span>
          {sent
            ? `Мы отправили код на ${email}. Введите его — или откройте ссылку из письма.`
            : 'Войдите по email, чтобы хранить данные в облаке и открывать их на любом устройстве. Новый аккаунт создастся сам.'}
        </span>
      </div>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="Email"
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
        <button type="submit" disabled={busy}>{sent ? 'Войти' : 'Получить код'}</button>
        {sent && <button type="button" onClick={() => { setSent(false); setCode(''); }}>Другой email</button>}
      </div>
    </form>
  );
}
