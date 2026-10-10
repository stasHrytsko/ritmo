import { AuthForm } from '../components/CloudPanel';

/** First-run entry: sign in or register with an email code, or stay local-only. */
export function WelcomeScreen({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="app-shell welcome">
      <h1 className="brand">Ritmo<span>.</span></h1>
      <p className="welcome-lead">Рутины, цели и заметки — в одном ритме. Войдите или создайте аккаунт, чтобы данные были в облаке и на всех ваших устройствах.</p>
      <AuthForm
        className="cloud-panel welcome-form"
        intro="Введите email — мы пришлём код. Если аккаунта ещё нет, он создастся автоматически."
      />
      <button type="button" className="welcome-skip" onClick={onSkip}>
        Продолжить без аккаунта
      </button>
    </div>
  );
}
