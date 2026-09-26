import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LIVE, queries } from '../../api/hooks';
import { ChartBox, PALETTE } from '../../components/ChartBox';
import { ExportButtons } from '../../components/ExportButtons';
import { CATEGORY_KEYS } from '../../lib/exercises';
import { exerciseTally, fmtINR, membershipStatus, monthKey, monthLabel } from '../../lib/format';
import { summarise } from './Payments';

/** Last `months` calendar months of revenue, split into joinings and renewals. */
function monthlySeries(payments, months = 6) {
  const keys = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  const bucket = (kind, key) => payments
    .filter((p) => monthKey(p.at) === key && p.kind === kind)
    .reduce((t, p) => t + (Number(p.amount) || 0), 0);
  return { labels: keys.map(monthLabel), joins: keys.map((k) => bucket('join', k)), renewals: keys.map((k) => bucket('renewal', k)) };
}

export default function Analytics() {
  const members = useQuery({ ...queries.members(), refetchInterval: LIVE * 6 });
  const payments = useQuery({ ...queries.payments(), refetchInterval: LIVE * 6 });
  const attendance = useQuery({ ...queries.recentAttendance(30), refetchInterval: LIVE * 6 });

  const memberRows = members.data ?? [];
  const paymentRows = payments.data ?? [];
  const attendanceRows = attendance.data ?? [];
  const totals = summarise(paymentRows);
  const renewed = memberRows.filter((m) => m.renewal_count > 0).length;
  const visits = attendanceRows.filter((r) => r.status === 'present').length;
  const tally = exerciseTally(attendanceRows);

  const revenue = useMemo(() => {
    const s = monthlySeries(paymentRows);
    return {
      labels: s.labels,
      datasets: [
        { label: 'Joinings', data: s.joins, backgroundColor: PALETTE[0], borderRadius: 4, stack: 'r' },
        { label: 'Renewals', data: s.renewals, backgroundColor: PALETTE[1], borderRadius: 4, stack: 'r' },
      ],
    };
  }, [paymentRows]);

  const status = useMemo(() => ({
    labels: ['Active', 'Expiring ≤7d', 'Expired'],
    datasets: [{
      data: ['active', 'expiring', 'expired'].map((k) => memberRows.filter((m) => membershipStatus(m.expiry_date).key === k).length),
      backgroundColor: [PALETTE[0], PALETTE[2], '#e53935'], borderWidth: 0,
    }],
  }), [memberRows]);

  const categories = useMemo(() => ({
    labels: CATEGORY_KEYS.map((k) => `Cat ${k}`),
    datasets: [{
      label: 'Members',
      data: CATEGORY_KEYS.map((k) => memberRows.filter((m) => (m.exercise_category || 'A') === k).length),
      backgroundColor: CATEGORY_KEYS.map((_, i) => PALETTE[i % PALETTE.length]), borderRadius: 4,
    }],
  }), [memberRows]);

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--card-accent': '#39e56a' }}><div className="kpi-lbl">💰 Revenue</div><div className="kpi-val">{fmtINR(totals.total)}</div><div className="kpi-sub">All time</div></div>
        <div className="kpi-card" style={{ '--card-accent': '#4da6ff' }}><div className="kpi-lbl">📊 Avg / Member</div><div className="kpi-val">{memberRows.length ? fmtINR(Math.round(totals.total / memberRows.length)) : '₹0'}</div><div className="kpi-sub">Lifetime value</div></div>
        <div className="kpi-card" style={{ '--card-accent': '#f5a623' }}><div className="kpi-lbl">🔄 Retention</div><div className="kpi-val">{memberRows.length ? `${Math.round((renewed / memberRows.length) * 100)}%` : '–'}</div><div className="kpi-sub">Members who renewed</div></div>
        <div className="kpi-card" style={{ '--card-accent': '#c084fc' }}><div className="kpi-lbl">✅ Visits (30d)</div><div className="kpi-val">{visits}</div><div className="kpi-sub">Attendance marks</div></div>
      </div>
      <div className="grid-2">
        <div className="panel"><div className="panel-hdr"><div className="panel-ttl">Revenue — last 6 months</div></div><ChartBox type="bar" data={revenue} stacked /></div>
        <div className="panel"><div className="panel-hdr"><div className="panel-ttl">Membership status</div></div><ChartBox type="doughnut" data={status} /></div>
        <div className="panel"><div className="panel-hdr"><div className="panel-ttl">Exercise categories</div></div><ChartBox type="bar" data={categories} legend={false} /></div>
        <div className="panel">
          <div className="panel-hdr">
            <div className="panel-ttl">Most-done exercises (30d)</div>
            <ExportButtons getData={() => ({
              name: 'exercise-popularity', title: 'Most-done exercises (last 30 days)',
              columns: ['Rank', 'Exercise', 'Times logged'], rows: tally.map((x, i) => [i + 1, x.name, x.count]),
            })} />
          </div>
          <ul className="list">
            {!tally.length && <li className="muted">No attendance logged in the last 30 days.</li>}
            {tally.slice(0, 8).map((x, i) => <li key={x.name}><span className="rank">{i + 1}</span>{x.name}<strong style={{ marginLeft: 'auto' }}>{x.count}</strong></li>)}
          </ul>
        </div>
      </div>
    </>
  );
}
