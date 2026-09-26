import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patch } from '../../api/client';
import { queries, useAction } from '../../api/hooks';
import { ChangePassword } from '../../components/ChangePassword';
import { fmtDate, membershipStatus } from '../../lib/format';

export default function Membership() {
  const me = useQuery({ ...queries.me(), refetchInterval: 30000 });
  const classes = useQuery(queries.classes());
  if (!me.data) return <div className="panel muted">Loading…</div>;

  const m = me.data;
  const s = membershipStatus(m.expiry_date);
  const booked = (classes.data ?? []).filter((c) => c.booked).length;

  return (
    <>
      {s.key !== 'active' && (
        <div className={`banner banner-${s.key}`}>
          {s.key === 'expired'
            ? 'Your membership has expired. Renew it to book classes.'
            : `Heads up: your membership ends in ${s.days} day${s.days === 1 ? '' : 's'}. Renew to keep booking.`}
        </div>
      )}
      <div className="sec-title">Membership</div>
      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--card-accent': '#39e56a' }}><div className="kpi-lbl">📆 Days Left</div><div className="kpi-val">{Math.max(0, s.days)}</div><div className="kpi-sub">{s.key === 'expired' ? 'Expired. Renew to book' : `Until ${fmtDate(m.expiry_date)}`}</div></div>
        <div className="kpi-card" style={{ '--card-accent': '#4da6ff' }}><div className="kpi-lbl">🎟️ Classes Booked</div><div className="kpi-val">{booked}</div><div className="kpi-sub">Upcoming</div></div>
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-hdr"><div className="panel-ttl">🪪 My Membership</div><span className={`status-badge status-${s.key}`}>{s.label}</span></div>
          <dl className="facts">
            <dt>Plan</dt><dd>{m.plan_name}</dd>
            <dt>Member ID</dt><dd>{m.custom_id || '–'}</dd>
            <dt>Started</dt><dd>{fmtDate(m.start_date)}</dd>
            <dt>Valid until</dt><dd>{fmtDate(m.expiry_date)}</dd>
          </dl>
        </div>
        <GoalsForm initial={m.goals} />
      </div>
      <div className="grid-2"><ChangePassword /></div>
    </>
  );
}

function GoalsForm({ initial }) {
  const [goals, setGoals] = useState(initial || '');
  const save = useAction((g) => patch('/members/me', { goals: g.trim() }), { invalidate: ['me'], success: 'Goals saved' });
  return (
    <form className="panel" onSubmit={(e) => { e.preventDefault(); save.mutate(goals); }}>
      <div className="panel-hdr"><div className="panel-ttl">🎯 My Goals</div></div>
      <label>What do you want to achieve? <textarea rows={3} value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="e.g. lose 5 kg, build stamina" /></label>
      <button type="submit" className="btn btn-primary btn-block" disabled={save.isPending}>Save Goals</button>
    </form>
  );
}
