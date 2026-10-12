import { AuthForm } from '../components/CloudPanel';

/** Entry to the app: sign in or create an account with an email code. */
export function WelcomeScreen() {
  return (
    <div className="app-shell welcome">
      <h1 className="brand">Ritmo<span>.</span></h1>
      <p className="welcome-lead">
        Рутины, цели и заметки — в одном ритме. Войдите или создайте аккаунт: у каждого свой личный список, он сохраняется в облаке и доступен на всех ваших устройствах.
      </p>
      <AuthForm
        className="cloud-panel welcome-form"
        showTitle={false}
        intro="Введите email — мы пришлём код. Если аккаунта ещё нет, он создастся автоматически."
      />
    </div>
  );
}
