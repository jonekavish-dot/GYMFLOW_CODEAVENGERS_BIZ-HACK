import { useQuery } from '@tanstack/react-query';
import { LIVE, queries } from '../../api/hooks';
import { fmtDate, membershipStatus } from '../../lib/format';

export default function Dashboard() {
  const members = useQuery({ ...queries.members(), refetchInterval: LIVE * 6 });
  const inside = useQuery({ ...queries.inside(), refetchInterval: LIVE });

  const rows = (members.data ?? []).map((m) => ({ m, s: membershipStatus(m.expiry_date) }));
  const expiring = rows.filter((r) => r.s.key === 'expiring');
  const expired = rows.filter((r) => r.s.key === 'expired');
  const alerts = [...expired, ...expiring];

  return (
    <>
      <div className="sec-title">Key Metrics</div>
      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--card-accent': '#39e56a' }}><div className="kpi-lbl">👥 Members</div><div className="kpi-val">{members.data ? rows.length : '–'}</div><div className="kpi-sub">Registered</div></div>
        <div className="kpi-card" style={{ '--card-accent': '#f5a623' }}><div className="kpi-lbl">⏳ Expiring ≤ 7d</div><div className="kpi-val">{members.data ? expiring.length : '–'}</div><div className="kpi-sub">Renew soon</div></div>
        <div className="kpi-card" style={{ '--card-accent': '#e53935' }}><div className="kpi-lbl">⛔ Expired</div><div className="kpi-val">{members.data ? expired.length : '–'}</div><div className="kpi-sub">Can't book classes</div></div>
        <div className="kpi-card" style={{ '--card-accent': '#4da6ff' }}><div className="kpi-lbl">🏋️ Inside Now</div><div className="kpi-val">{inside.data ? inside.data.length : '–'}</div><div className="kpi-sub">Live occupancy</div></div>
      </div>

      <div className="sec-title">Alerts</div>
      <div className="panel">
        <div className="panel-hdr"><div className="panel-ttl">🔔 Membership Alerts</div><span className="panel-tag">Auto</span></div>
        <ul className="list">
          {!members.data && <li className="muted">Loading…</li>}
          {members.data && !alerts.length && <li className="muted">✅ All memberships are healthy.</li>}
          {alerts.map(({ m, s }) => (
            <li key={m.user_id}>
              <span className={`status-badge status-${s.key}`}>{s.label}</span> <strong>{m.name}</strong>
              <span className="muted">· {m.plan_name} · ends {fmtDate(m.expiry_date)}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
