import { useEffect, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { api, ApiError } from './api';
import type { User } from './types';
import { AuthForm } from './AuthForm';
import { Dashboard } from './Dashboard';
export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function restore() {
    setLoading(true);
    setError('');
    try {
      setUser((await api.me()).user);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status !== 401)
        setError(cause.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void restore();
  }, []);
  if (loading)
    return (
      <div className="page-loading" role="status">
        <NotebookPen size={30} />
        <span>Opening your workspace…</span>
      </div>
    );
  if (error)
    return (
      <div className="page-loading">
        <p role="alert">{error}</p>
        <button className="button primary" onClick={() => void restore()}>
          Try again
        </button>
      </div>
    );
  return user ? (
    <Dashboard user={user} onLogout={() => setUser(null)} />
  ) : (
    <AuthForm onAuthenticated={setUser} />
  );
}
