import { useEffect, useState } from 'react';
import { describeAuthError, requestCode, verifyCode } from '../../infrastructure/cloud';


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
  // Seconds until another code may be requested; email providers throttle.
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

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
            setCooldown(60);
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
      {!sent && <input
        autoComplete="name"
        placeholder="Как вас зовут (необязательно)"
        value={name}
        disabled={sent || busy}
        onChange={(event) => setName(event.target.value)}
      />}
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
        {sent && (
          <button
            type="button"
            disabled={busy || cooldown > 0}
            onClick={() => void run(async () => {
              await requestCode(email.trim(), name.trim() || undefined);
              setCooldown(60);
            })}
          >
            {cooldown > 0 ? `Новый код через ${cooldown} с` : 'Отправить код ещё раз'}
          </button>
        )}
        {sent && <button type="button" onClick={() => { setSent(false); setCode(''); setError(null); }}>Другая почта</button>}
      </div>
    </form>
  );
}
