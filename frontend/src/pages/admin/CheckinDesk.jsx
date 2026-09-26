import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { del, post } from '../../api/client';
import { LIVE, queries, useAction } from '../../api/hooks';
import { QRCode } from '../../components/QRCode';
import { fmtDateTime, initials, membershipStatus } from '../../lib/format';

export default function CheckinDesk() {
  const session = useQuery({ ...queries.session(), refetchInterval: LIVE });
  const inside = useQuery({ ...queries.inside(), refetchInterval: LIVE });
  const members = useQuery(queries.members());

  const [amount, setAmount] = useState(30);
  const [unit, setUnit] = useState('minutes');
  const [term, setTerm] = useState('');
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  const s = session.data;
  const left = s ? new Date(s.expires_at).getTime() - Date.now() : -1;
  const active = left > 0;

  const generate = useAction((minutes) => post('/checkin/session', { validity_minutes: minutes }), { invalidate: ['session'], success: 'New check-in code is live' });
  const revoke = useAction(() => del('/checkin/session'), { invalidate: ['session'], success: 'Code revoked' });
  const manual = useAction((userId) => post('/checkin/manual', { user_id: userId }), { invalidate: ['inside'], success: 'Checked in' });
  const checkout = useAction((id) => post(`/checkin/${id}/checkout`), { invalidate: ['inside'], success: 'Checked out' });

  const needle = term.trim().toLowerCase();
  const matches = needle
    ? (members.data ?? []).filter((m) => `${m.name} ${m.custom_id} ${m.email}`.toLowerCase().includes(needle)).slice(0, 6)
    : [];

  const mm = Math.floor(Math.max(0, left) / 60000);
  const ss = Math.floor((Math.max(0, left) % 60000) / 1000);

  return (
    <>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-hdr"><div className="panel-ttl">🔐 Active Code</div><span className={`panel-tag${active ? ' panel-tag-live' : ''}`}>{active ? 'Active' : 'Inactive'}</span></div>
          <form className="inline-form" onSubmit={(e) => {
            e.preventDefault();
            generate.mutate(unit === 'hours' ? Number(amount) * 60 : Number(amount));
          }}>
            <label style={{ flex: 1 }}>Valid for
              <div className="form-row">
                <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                <select value={unit} onChange={(e) => setUnit(e.target.value)}><option value="minutes">Minutes</option><option value="hours">Hours</option></select>
              </div>
            </label>
            <button type="submit" className="btn btn-primary" disabled={generate.isPending}>⚡ Generate New Code</button>
          </form>

          {active ? (
            <div className="checkin-code-display">
              <QRCode value={s.code} />
              <div className="checkin-digits">{s.code.split('').join(' ')}</div>
              <div className="checkin-countdown">Expires in {mm}:{String(ss).padStart(2, '0')}</div>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => revoke.mutate()}>Revoke now</button>
            </div>
          ) : (
            <p className="muted small">No active code. Generate one so members can self-check-in.</p>
          )}
        </div>

        <div className="panel">
          <div className="panel-hdr"><div className="panel-ttl">✋ Manual Check-In</div></div>
          <p className="muted small">Front-desk override, no code needed.</p>
          <label>Search member <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Name, ID or email" autoComplete="off" /></label>
          <div className="checkin-results">
            {needle && !matches.length && <p className="muted small">No matches.</p>}
            {matches.map((m) => {
              const st = membershipStatus(m.expiry_date);
              return (
                <div key={m.user_id} className="checkin-result">
                  <span className="av-sm">{initials(m.name)}</span>
                  <div><strong>{m.name}</strong><span className="sub">{m.custom_id || m.email} · <span className={`status-badge status-${st.key}`}>{st.label}</span></span></div>
                  <button type="button" className="btn btn-primary btn-sm" disabled={st.key === 'expired' || manual.isPending}
                    title={st.key === 'expired' ? 'Membership expired' : undefined}
                    onClick={() => manual.mutate(m.user_id, { onSuccess: () => setTerm('') })}>Check In</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-hdr"><div className="panel-ttl">🏋️ Inside Now</div><span className="panel-tag">{inside.data?.length ?? 0}</span></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Member</th><th>Method</th><th>Since</th><th /></tr></thead>
            <tbody>
              {!inside.data?.length && <tr className="empty"><td colSpan={4}>Nobody checked in right now.</td></tr>}
              {(inside.data ?? []).map((c) => (
                <tr key={c.id}>
                  <td data-label="Member"><strong>{c.name}</strong><span className="sub">{c.custom_id}</span></td>
                  <td data-label="Method"><span className="chip">{c.method}</span></td>
                  <td data-label="Since">{fmtDateTime(c.at)}</td>
                  <td className="row-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => checkout.mutate(c.id)}>Check Out</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
