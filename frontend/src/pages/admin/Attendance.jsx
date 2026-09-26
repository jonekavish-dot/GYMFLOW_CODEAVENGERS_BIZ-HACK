import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { del, put } from '../../api/client';
import { LIVE, queries, useAction } from '../../api/hooks';
import { DEFAULT_EXERCISES, exercisesFor } from '../../lib/exercises';
import { initials, membershipStatus, todayStr } from '../../lib/format';
import { useToast } from '../../components/Toast';

export default function Attendance() {
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [tab, setTab] = useState('members');
  const [term, setTerm] = useState('');
  // Exercises ticked for people who haven't been marked yet; a mark needs them all at once.
  const [pending, setPending] = useState({});

  const day = useQuery({ ...queries.dayAttendance(date), refetchInterval: LIVE });
  const members = useQuery(queries.members());
  const trainers = useQuery(queries.trainers());
  const custom = useQuery(queries.exercises());

  const records = new Map((day.data ?? []).map((r) => [`${r.kind}:${r.person_id}`, r]));
  const allExercises = [...new Set([...DEFAULT_EXERCISES, ...(custom.data?.custom ?? [])])];

  const mark = useAction((body) => put('/attendance', { date, ...body }), { invalidate: ['attendance'] });
  const clear = useAction((p) => del(`/attendance?date=${date}&kind=${p.kind}&person_id=${p.id}`), {
    invalidate: ['attendance'],
    success: (_, p) => { setPending((s) => { const n = { ...s }; delete n[`${p.kind}:${p.id}`]; return n; }); return 'Mark removed'; },
  });

  const people = (tab === 'members'
    ? (members.data ?? []).map((m) => ({
      id: m.user_id, name: m.name, kind: 'member', sub: `${m.custom_id || m.email} · Cat ${m.exercise_category || 'A'}`,
      category: m.exercise_category || 'A', expired: membershipStatus(m.expiry_date).key === 'expired',
    }))
    : (trainers.data ?? []).map((t) => ({ id: t.id, name: t.name, kind: 'trainer', sub: t.role || 'Trainer', category: null, expired: false })))
    .filter((p) => !term.trim() || `${p.name} ${p.sub}`.toLowerCase().includes(term.trim().toLowerCase()));

  const keyOf = (p) => `${p.kind}:${p.id}`;
  const statusOf = (p) => records.get(keyOf(p))?.status;
  const present = people.filter((p) => statusOf(p) === 'present').length;
  const absent = people.filter((p) => statusOf(p) === 'absent').length;

  const ticked = (p) => pending[keyOf(p)] ?? records.get(keyOf(p))?.exercises ?? [];

  const toggle = (p, exercise, on) => {
    const current = ticked(p);
    const next = on ? [...new Set([...current, exercise])] : current.filter((x) => x !== exercise);
    const rec = records.get(keyOf(p));
    if (!rec) { setPending((s) => ({ ...s, [keyOf(p)]: next })); return; }
    // Unticking the last exercise of someone marked present can't leave them "present with nothing".
    const status = rec.status === 'present' && p.kind === 'member' && !next.length ? 'absent' : rec.status;
    mark.mutate({ kind: p.kind, person_id: p.id, status, exercises: next });
  };

  const setStatus = (p, status) => {
    if (status === 'present' && p.kind === 'member' && !ticked(p).length) return toast('Tick at least one exercise first.', 'err');
    mark.mutate({ kind: p.kind, person_id: p.id, status, exercises: ticked(p) }, {
      onSuccess: () => {
        setPending((s) => { const n = { ...s }; delete n[keyOf(p)]; return n; });
        toast(`${p.name} marked ${status}`);
      },
    });
  };

  return (
    <div className="panel">
      <div className="panel-hdr">
        <div className="panel-ttl">Roll Call</div>
        <div className="att-controls">
          <input type="date" className="search-input" value={date} onChange={(e) => setDate(e.target.value)} />
          <input type="search" className="search-input" placeholder="Search…" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
      </div>
      <div className="tab-row">
        <button type="button" className={`tab-btn${tab === 'members' ? ' active' : ''}`} onClick={() => setTab('members')}>👥 Members</button>
        <button type="button" className={`tab-btn${tab === 'trainers' ? ' active' : ''}`} onClick={() => setTab('trainers')}>🧑‍🏫 Trainers</button>
      </div>

      <div className="att-stats">
        <span className="att-stat"><strong>{people.length}</strong> on roll</span>
        <span className="att-stat ok"><strong>{present}</strong> present</span>
        <span className="att-stat bad"><strong>{absent}</strong> absent</span>
        <span className="att-stat"><strong>{people.length - present - absent}</strong> unmarked</span>
      </div>

      <div className="att-list">
        {!people.length && <p className="muted">No {tab} to show.</p>}
        {people.map((p) => {
          const status = statusOf(p);
          const on = ticked(p);
          const rotation = p.kind === 'member' ? exercisesFor(p.category).filter((x) => x !== 'Rest') : [];
          const extras = allExercises.filter((x) => !rotation.includes(x));
          const chip = (x) => (
            <label key={x} className={`ex-chk${on.includes(x) ? ' on' : ''}`}>
              <input type="checkbox" checked={on.includes(x)} onChange={(e) => toggle(p, x, e.target.checked)} />{x}
            </label>
          );
          return (
            <div key={keyOf(p)} className={`att-card${status ? ` marked-${status}` : ''}`}>
              <div className="att-who">
                <span className="av-sm">{initials(p.name)}</span>
                <div><strong>{p.name}</strong><div className="muted small">{p.sub}</div></div>
                {p.expired && <span className="status-badge status-expired">Expired</span>}
                {status && <span className={`status-badge status-${status === 'present' ? 'active' : 'muted'}`}>{status}</span>}
              </div>
              {p.kind === 'member' && (
                <div className="ex-grid">
                  {rotation.map(chip)}
                  {extras.length > 0 && <details className="ex-more"><summary>+ {extras.length} more</summary><div className="ex-grid">{extras.map(chip)}</div></details>}
                </div>
              )}
              <div className="att-actions">
                <button type="button" className="btn btn-primary btn-sm" disabled={p.kind === 'member' && !on.length}
                  title={p.kind === 'member' && !on.length ? 'Tick at least one exercise' : undefined}
                  onClick={() => setStatus(p, 'present')}>Present</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(p, 'absent')}>Absent</button>
                {status && <button type="button" className="btn btn-ghost btn-sm" onClick={() => clear.mutate(p)}>Undo</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
