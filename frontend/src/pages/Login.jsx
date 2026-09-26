import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { get } from '../api/client';
import { homeFor, useAuth } from '../auth/AuthContext';
import { APP } from '../lib/app';
import { useInstall } from '../lib/pwa';

export default function Login() {
  const { status, user, login, bootstrap } = useAuth();
  const navigate = useNavigate();
  const { canInstall, install } = useInstall();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Doubles as the connection badge and tells us whether first-admin setup is still needed.
  const server = useQuery({ queryKey: ['status'], queryFn: () => get('/auth/status'), retry: 1 });

  if (status === 'authed') return <Navigate to={homeFor(user.role)} replace />;

  const submit = (action) => async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    setError('');
    setBusy(true);
    try {
      const signedIn = await action(f);
      navigate(homeFor(signedIn.role), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const connClass = server.isSuccess ? 'conn-ok' : server.isError ? 'conn-err' : '';
  const connText = server.isSuccess ? 'Connected · GymFlow API' : server.isError ? 'Cannot reach the server' : 'Checking server…';

  return (
    <div className="lockscreen">
      <main className="lock-box">
        <svg className="lock-mark" width="60" height="60" viewBox="0 0 100 100" aria-hidden="true">
          <rect width="100" height="100" rx="22" fill="#0d0f0e" stroke="#39e56a" strokeWidth="3" />
          <g fill="#39e56a"><rect x="14" y="34" width="12" height="32" rx="3" /><rect x="74" y="34" width="12" height="32" rx="3" /><rect x="28" y="40" width="8" height="20" rx="2" /><rect x="64" y="40" width="8" height="20" rx="2" /><rect x="36" y="46" width="28" height="8" rx="2" /></g>
        </svg>
        <div className="lock-logo">{APP.name}</div>
        <div className="lock-sub">{APP.tagline}</div>

        <div className={`conn ${connClass}`}>{connText}</div>
        <p className="lock-err" role="alert">{error}</p>

        <form onSubmit={submit((f) => login(f.email.value.trim(), f.password.value))}>
          <label>Email Address <input type="email" name="email" required autoComplete="username" placeholder="you@example.com" /></label>
          <label>Password <input type="password" name="password" required autoComplete="current-password" placeholder="Your password" /></label>
          <button type="submit" className="lock-btn" disabled={busy}>{busy ? 'Signing in…' : '🔥 Sign In'}</button>
        </form>

        {server.data && !server.data.bootstrapped && (
          <form className="setup-box" onSubmit={submit((f) => bootstrap(f.fullName.value.trim(), f.email.value.trim(), f.password.value))}>
            <h3>⚡ First-time setup</h3>
            <p>No admin exists yet. Create the admin account. This form disappears afterwards.</p>
            <label>Name <input name="fullName" required placeholder="Your name" /></label>
            <label>Email Address <input type="email" name="email" required autoComplete="username" /></label>
            <label>Password <input type="password" name="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /></label>
            <button type="submit" className="lock-btn" disabled={busy}>Create Admin Account</button>
          </form>
        )}

        <div className="lock-hint">
          ℹ️ <span className="hl">Members:</span> your login is created by an admin when you're registered. Admins and members use this same page, and you're taken to the right portal automatically. Forgot your password? Ask the front desk to reset it.
        </div>
        {canInstall && <button type="button" className="install-cta" onClick={install}>⬇ Install GymFlow as an app</button>}
      </main>
    </div>
  );
}
