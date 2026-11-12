import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  NotebookPen,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { api } from './api';
import type { User } from './types';
export function AuthForm({
  onAuthenticated,
  reauthEmail,
}: {
  onAuthenticated: (user: User) => void;
  reauthEmail?: string;
}) {
  const [signup, setSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(reauthEmail ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = signup
        ? await api.register({ name, email, password })
        : await api.login({ email, password });
      onAuthenticated(result.user);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to sign in. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={reauthEmail ? 'auth-page reauth' : 'auth-page'}>
      <section className="auth-story" aria-label="About Shine Notes">
        <a className="brand" href="/">
          <span className="brand-icon">
            <NotebookPen size={23} />
          </span>
          shine<span className="brand-light">notes</span>
        </a>
        <div className="story-content">
          <span className="eyebrow">
            <Sparkles size={14} /> A LITTLE ROOM TO THINK
          </span>
          <h1>
            Good ideas
            <br />
            start with
            <br />
            <em>a little space.</em>
          </h1>
          <p>
            Your thoughts, plans, and light-bulb moments.
            <br />
            All together. All yours.
          </p>
          <div className="story-note">
            <span className="paper-label">A NOTE TO SELF</span>
            <p>Make room for what matters.</p>
            <div>
              <Check size={16} /> One thought at a time.
            </div>
          </div>
        </div>
        <span className="story-footer">A quieter corner of the internet.</span>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <span className="small-label">YOUR PERSONAL WORKSPACE</span>
          <h2>
            {reauthEmail
              ? 'Sign in to continue.'
              : signup
                ? 'A fresh page awaits.'
                : 'Welcome back.'}
          </h2>
          <p className="muted">
            {reauthEmail
              ? 'Your draft will stay here while you sign in.'
              : signup
                ? 'Create your account and make yourself at home.'
                : 'Sign in to pick up where your thoughts left off.'}
          </p>
          <form onSubmit={(event) => void submit(event)}>
            {signup && (
              <label>
                Your name
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={80}
                  placeholder="What should we call you?"
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                readOnly={!!reauthEmail}
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={signup ? 12 : 1}
                maxLength={128}
                placeholder={
                  signup ? 'At least 12 characters' : 'Enter your password'
                }
              />
            </label>
            {signup && (
              <p className="field-help">
                Use at least 12 characters. Spaces and passphrases welcome.
              </p>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <button className="button primary auth-submit" disabled={busy}>
              {busy ? 'Just a moment…' : signup ? 'Create account' : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </form>
          {!reauthEmail && (
            <p className="auth-switch">
              {signup ? 'Already have a space?' : 'New around here?'}{' '}
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setSignup(!signup);
                  setError('');
                  setPassword('');
                }}
              >
                {signup ? 'Sign in instead' : 'Create an account'}
              </button>
            </p>
          )}
          <div className="privacy-note">
            <ShieldCheck size={16} />
            <span>Private by default. Your notes belong to you.</span>
          </div>
        </div>
        <footer className="auth-footer">
          SHINE NOTES <span>Made for your everyday ideas.</span>
        </footer>
      </section>
    </main>
  );
}
