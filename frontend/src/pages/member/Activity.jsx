import { useQuery } from '@tanstack/react-query';
import { queries } from '../../api/hooks';
import { useToast } from '../../components/Toast';
import { exercisesFor } from '../../lib/exercises';
import { currentStreak, fmtDate, fmtINR } from '../../lib/format';
import { printReceipt } from '../../lib/receipt';

export default function Activity() {
  const toast = useToast();
  const me = useQuery(queries.me());
  const attendance = useQuery(queries.myAttendance());
  const payments = useQuery(queries.myPayments());
  const gym = useQuery(queries.gym());

  const rows = attendance.data ?? [];
  const pays = payments.data ?? [];
  const cat = me.data?.exercise_category || 'A';

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--card-accent': '#f5a623' }}><div className="kpi-lbl">🔥 Current Streak</div><div className="kpi-val">{currentStreak(rows)}</div><div className="kpi-sub">Consecutive days</div></div>
        <div className="kpi-card" style={{ '--card-accent': '#39e56a' }}><div className="kpi-lbl">✅ Total Visits</div><div className="kpi-val">{rows.filter((r) => r.status === 'present').length}</div><div className="kpi-sub">Days present</div></div>
        <div className="kpi-card" style={{ '--card-accent': '#4da6ff' }}><div className="kpi-lbl">💰 Total Paid</div><div className="kpi-val">{fmtINR(me.data?.paid)}</div><div className="kpi-sub">All payments</div></div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-hdr"><div className="panel-ttl">📋 My Exercise Rotation</div><span className="panel-tag">Category {cat}</span></div>
          <ol className="rotation">{exercisesFor(cat).map((x) => <li key={x}>{x}</li>)}</ol>
        </div>
        <div className="panel">
          <div className="panel-hdr"><div className="panel-ttl">✅ Attendance History</div></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Status</th><th>Exercises</th></tr></thead>
              <tbody>
                {!rows.length && <tr className="empty"><td colSpan={3}>No attendance recorded yet.</td></tr>}
                {rows.slice(0, 30).map((r) => (
                  <tr key={r.id}>
                    <td data-label="Date">{r.date}</td>
                    <td data-label="Status"><span className={`status-badge status-${r.status === 'present' ? 'active' : 'muted'}`}>{r.status}</span></td>
                    <td data-label="Exercises">{r.exercises.length ? r.exercises.map((x) => <span key={x} className="chip">{x}</span>) : <span className="muted">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-hdr"><div className="panel-ttl">🧾 My Payments</div></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Plan</th><th>Type</th><th>Amount</th><th /></tr></thead>
            <tbody>
              {!pays.length && <tr className="empty"><td colSpan={5}>No payments recorded yet.</td></tr>}
              {pays.map((p) => (
                <tr key={p.id}>
                  <td data-label="Date">{fmtDate(p.at)}</td>
                  <td data-label="Plan"><span className="plan-tag">{p.plan_name}</span> <span className="muted small">{p.months || 1} mo</span></td>
                  <td data-label="Type">{p.kind === 'renewal' ? 'Renewal' : 'Joining'}</td>
                  <td data-label="Amount"><strong>{fmtINR(p.amount)}</strong></td>
                  <td className="row-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (!printReceipt({ payment: p, gym: gym.data })) toast('Allow pop-ups for this site to print receipts.', 'err'); }}>🧾 Receipt</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
