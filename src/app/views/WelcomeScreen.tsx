import { AuthForm } from '../components/CloudPanel';

/** Entry to the app: sign in or create an account with an email code. */
export function WelcomeScreen() {
  return (
    <div className="app-shell welcome">
      <h1 className="brand">Ritmo<span>.</span></h1>
      <h2 className="welcome-title">Свой ритм каждый день</h2>
      <p className="welcome-lead">Рутины, цели и заметки в одном месте. Всё только ваше и всегда с вами.</p>
      <AuthForm className="cloud-panel welcome-form" showTitle={false} />
    </div>
  );
}
