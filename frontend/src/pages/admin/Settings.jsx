import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { del, post, put } from '../../api/client';
import { queries, useAction } from '../../api/hooks';
import { ChangePassword } from '../../components/ChangePassword';
import { useConfirm } from '../../components/Modal';
import { CATEGORIES, DEFAULT_EXERCISES } from '../../lib/exercises';
import { applyTheme, getTheme } from '../../lib/theme';
import { useToast } from '../../components/Toast';

export default function Settings() {
  const gym = useQuery(queries.gym());
  return (
    <div className="grid-2">
      <div className="stack">
        {gym.data ? <GymForm initial={gym.data} /> : <div className="panel muted">Loading…</div>}
        <ChangePassword />
      </div>
      <div className="stack">
        <Appearance />
        <Exercises />
      </div>
    </div>
  );
}

// Mounted only once the profile has loaded, so the form's own state starts from the saved values
// and a background refetch never overwrites what someone is typing.
function GymForm({ initial }) {
  const [form, setForm] = useState(initial);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const save = useAction((body) => put('/settings/gym', body), { invalidate: ['gym'], success: 'Gym profile saved' });

  return (
    <form className="panel" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
      <div className="panel-hdr"><div className="panel-ttl">🏋️ Gym Profile</div></div>
      <label>Gym Name <input value={form.name} onChange={set('name')} placeholder="Your gym's name" /></label>
      <label>Owner <input value={form.owner} onChange={set('owner')} /></label>
      <div className="form-row">
        <label>Phone <input type="tel" value={form.phone} onChange={set('phone')} /></label>
        <label>Email <input type="email" value={form.email} onChange={set('email')} /></label>
      </div>
      <label>Address <textarea rows={2} value={form.address} onChange={set('address')} /></label>
      <button type="submit" className="btn btn-primary btn-block" disabled={save.isPending}>Save Profile</button>
      <p className="muted small">Used on printed receipts.</p>
    </form>
  );
}

function Appearance() {
  const [theme, setTheme] = useState(getTheme());
  const pick = (t) => { applyTheme(t); setTheme(t); };
  return (
    <div className="panel">
      <div className="panel-hdr"><div className="panel-ttl">🎨 Appearance</div></div>
      <div className="theme-row">
        <button type="button" className={`btn btn-ghost${theme === 'dark' ? ' active' : ''}`} onClick={() => pick('dark')}>🌙 Dark</button>
        <button type="button" className={`btn btn-ghost${theme === 'light' ? ' active' : ''}`} onClick={() => pick('light')}>☀️ Light</button>
      </div>
    </div>
  );
}

function Exercises() {
  const confirm = useConfirm();
  const toast = useToast();
  const exercises = useQuery(queries.exercises());
  const custom = exercises.data?.custom ?? [];
  const [name, setName] = useState('');

  const add = useAction((n) => post('/settings/exercises', { name: n }), { invalidate: ['exercises'], success: 'Exercise added' });
  const remove = useAction((n) => del(`/settings/exercises?name=${encodeURIComponent(n)}`), { invalidate: ['exercises'], success: (_, n) => `"${n}" removed` });

  return (
    <div className="panel">
      <div className="panel-hdr"><div className="panel-ttl">💪 Exercises</div></div>
      <form className="inline-form" onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        if (DEFAULT_EXERCISES.includes(n) || custom.includes(n)) return toast(`"${n}" already exists.`, 'err');
        add.mutate(n, { onSuccess: () => setName('') });
      }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a custom exercise" required />
        <button type="submit" className="btn btn-primary btn-sm" disabled={add.isPending}>Add</button>
      </form>
      <p className="muted small">Built-ins come from categories A-F. Custom ones appear for every member.</p>
      <div className="chip-row">
        {DEFAULT_EXERCISES.map((x) => <span key={x} className="chip">{x}</span>)}
        {custom.map((x) => (
          <span key={x} className="chip chip-custom">{x}
            <button type="button" aria-label={`Remove ${x}`}
              onClick={async () => { if (await confirm({ title: `Remove "${x}"?`, confirmLabel: 'Remove', message: 'It disappears from the attendance grid. Past attendance records keep it.' })) remove.mutate(x); }}>✕</button>
          </span>
        ))}
      </div>

      <div className="panel-hdr" style={{ marginTop: 18 }}><div className="panel-ttl">📋 Category Rotations</div></div>
      <div className="cat-list">
        {Object.entries(CATEGORIES).map(([k, list]) => (
          <details key={k} className="cat-block">
            <summary>Category {k} <span className="muted small">· {list.length} days</span></summary>
            <ol className="rotation">{list.map((x) => <li key={x}>{x}</li>)}</ol>
          </details>
        ))}
      </div>
    </div>
  );
}
