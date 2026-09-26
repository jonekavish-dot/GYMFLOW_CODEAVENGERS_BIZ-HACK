import { useState } from 'react';
import { post, setAccessToken } from '../api/client';
import { useAction } from '../api/hooks';

/** Available to both roles. Success rotates this device's session; every other device is signed out. */
export function ChangePassword() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const mismatch = form.confirm && form.next !== form.confirm;

  const change = useAction(
    (body) => post('/auth/change-password', body).then((data) => { setAccessToken(data.access_token); return data; }),
    { success: 'Password changed. Other devices were signed out.' },
  );

  return (
    <form className="panel" onSubmit={(e) => {
      e.preventDefault();
      if (mismatch) return;
      change.mutate({ current_password: form.current, new_password: form.next }, { onSuccess: () => setForm({ current: '', next: '', confirm: '' }) });
    }}>
      <div className="panel-hdr"><div className="panel-ttl">🔑 Change Password</div></div>
      <label>Current password <input type="password" autoComplete="current-password" value={form.current} onChange={set('current')} required /></label>
      <label>New password <input type="password" autoComplete="new-password" minLength={8} value={form.next} onChange={set('next')} required placeholder="8+ characters" /></label>
      <label>Confirm new password <input type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} required /></label>
      {mismatch && <p className="form-error">Passwords don't match.</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={change.isPending || !!mismatch}>Change Password</button>
      <p className="muted small">Signs you out of every other device.</p>
    </form>
  );
}
