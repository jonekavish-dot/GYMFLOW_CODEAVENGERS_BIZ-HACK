import { useQuery } from '@tanstack/react-query';
import { LIVE, queries } from '../../api/hooks';
import { DataTable, SearchBox, useDataTable } from '../../components/DataTable';
import { ExportButtons } from '../../components/ExportButtons';
import { useToast } from '../../components/Toast';
import { fmtDate, fmtINR, monthKey, todayStr } from '../../lib/format';
import { printReceipt } from '../../lib/receipt';

export const summarise = (payments) => {
  const today = todayStr();
  const month = monthKey(new Date());
  const sum = (rows) => rows.reduce((t, p) => t + (Number(p.amount) || 0), 0);
  return {
    total: sum(payments),
    today: sum(payments.filter((p) => todayStr(new Date(p.at)) === today)),
    month: sum(payments.filter((p) => monthKey(p.at) === month)),
    renewals: sum(payments.filter((p) => p.kind === 'renewal')),
  };
};

export default function Payments() {
  const toast = useToast();
  const payments = useQuery({ ...queries.payments(), refetchInterval: LIVE * 6 });
  const gym = useQuery(queries.gym());
  const rows = payments.data ?? [];
  const s = summarise(rows);

  const table = useDataTable({
    rows, sort: 'date', dir: 'desc', pageSize: 12,
    match: (p) => [p.member_name, p.custom_id, p.plan_name, p.method, p.kind].join(' '),
    fields: { date: (p) => new Date(p.at).getTime(), member: (p) => p.member_name, plan: (p) => p.plan_name, kind: (p) => p.kind, method: (p) => p.method, amount: (p) => p.amount },
  });

  const columns = [
    { label: 'Date', sort: 'date', render: (p) => fmtDate(p.at) },
    { label: 'Member', sort: 'member', render: (p) => <><strong>{p.member_name}</strong><span className="sub">{p.custom_id}</span></> },
    { label: 'Plan', sort: 'plan', render: (p) => <><span className="plan-tag">{p.plan_name}</span><span className="sub">{p.months || 1} mo</span></> },
    { label: 'Type', sort: 'kind', render: (p) => <span className={`status-badge status-${p.kind === 'renewal' ? 'expiring' : 'active'}`}>{p.kind === 'renewal' ? 'Renewal' : 'Joining'}</span> },
    { label: 'Method', sort: 'method', render: (p) => p.method || 'Cash' },
    { label: 'Amount', sort: 'amount', render: (p) => <strong>{fmtINR(p.amount)}</strong> },
    { label: 'Receipt', actions: true, render: (p) => (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (!printReceipt({ payment: p, gym: gym.data })) toast('Allow pop-ups for this site to print receipts.', 'err'); }}>🧾 Receipt</button>
    ) },
  ];

  const getExport = () => ({
    name: 'payments', title: `${gym.data?.name || 'GymFlow'} — Payments`,
    columns: ['Date', 'Member', 'Member ID', 'Plan', 'Months', 'Type', 'Method', 'Amount'],
    rows: table.visible.map((p) => [fmtDate(p.at), p.member_name, p.custom_id, p.plan_name, p.months || 1, p.kind === 'renewal' ? 'Renewal' : 'Joining', p.method || 'Cash', p.amount]),
  });

  return (
    <>
      <div className="sec-title">Revenue</div>
      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--card-accent': '#39e56a' }}><div className="kpi-lbl">💰 Total Collected</div><div className="kpi-val">{fmtINR(s.total)}</div><div className="kpi-sub">All time</div></div>
        <div className="kpi-card" style={{ '--card-accent': '#4da6ff' }}><div className="kpi-lbl">📅 This Month</div><div className="kpi-val">{fmtINR(s.month)}</div><div className="kpi-sub">Joins + renewals</div></div>
        <div className="kpi-card" style={{ '--card-accent': '#f5a623' }}><div className="kpi-lbl">🔄 Renewal Revenue</div><div className="kpi-val">{fmtINR(s.renewals)}</div><div className="kpi-sub">Repeat business</div></div>
        <div className="kpi-card" style={{ '--card-accent': '#c084fc' }}><div className="kpi-lbl">☀️ Today</div><div className="kpi-val">{fmtINR(s.today)}</div><div className="kpi-sub">Collected today</div></div>
      </div>
      <div className="panel">
        <div className="panel-hdr">
          <div className="panel-ttl">Payment History</div>
          <div className="hdr-tools"><SearchBox table={table} placeholder="Search member, method…" /><ExportButtons getData={getExport} /></div>
        </div>
        <DataTable table={table} columns={columns} empty="No payments recorded yet." />
      </div>
    </>
  );
}
