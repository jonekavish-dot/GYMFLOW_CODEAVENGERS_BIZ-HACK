// Admin · Analytics — revenue trend, plan mix, category spread and exercise
// popularity. Charts are built from the payment ledger and attendance rows, so the
// numbers are real rather than the old portal's partly-synthetic series.
import { watchPayments, monthlySeries, summarise } from '../payments/payments.service.js';
import { watchMembers, membershipStatus } from '../members/members.service.js';
import { watchRecent, exerciseTally, STATUS } from '../attendance/attendance.service.js';
import { CATEGORY_KEYS } from '../exercises/exercises.service.js';
import { $, esc } from '../../shared/dom.js';
import { fmtINR } from '../../shared/format.js';
import { chartStore, paint, PALETTE } from '../../shared/charts.js';
import { wireExportMenu, exportButtons } from '../../shared/export.js';
import { toast } from '../../shared/toast.js';

export default {
  id: 'analytics',
  title: 'Analytics',
  label: 'Analytics',
  icon: '📈',
  section: 'Operations',

  template: () => `
    <div class="kpi-grid">
      <div class="kpi-card" style="--card-accent:#39e56a"><div class="kpi-lbl">💰 Revenue</div><div class="kpi-val" id="an-rev">–</div><div class="kpi-sub">All time</div></div>
      <div class="kpi-card" style="--card-accent:#4da6ff"><div class="kpi-lbl">📊 Avg / Member</div><div class="kpi-val" id="an-avg">–</div><div class="kpi-sub">Lifetime value</div></div>
      <div class="kpi-card" style="--card-accent:#f5a623"><div class="kpi-lbl">🔄 Retention</div><div class="kpi-val" id="an-ret">–</div><div class="kpi-sub">Members who renewed</div></div>
      <div class="kpi-card" style="--card-accent:#c084fc"><div class="kpi-lbl">✅ Visits (30d)</div><div class="kpi-val" id="an-visits">–</div><div class="kpi-sub">Attendance marks</div></div>
    </div>
    <div class="grid-2">
      <div class="panel"><div class="panel-hdr"><div class="panel-ttl">Revenue — last 6 months</div></div>
        <div class="chart-box"><canvas id="ch-rev"></canvas></div></div>
      <div class="panel"><div class="panel-hdr"><div class="panel-ttl">Membership status</div></div>
        <div class="chart-box"><canvas id="ch-status"></canvas></div></div>
      <div class="panel"><div class="panel-hdr"><div class="panel-ttl">Exercise categories</div></div>
        <div class="chart-box"><canvas id="ch-cat"></canvas></div></div>
      <div class="panel">
        <div class="panel-hdr"><div class="panel-ttl">Most-done exercises (30d)</div>${exportButtons()}</div>
        <ul id="an-top" class="list"></ul>
      </div>
    </div>`,

  init({ el }) {
    let members = [];
    let payments = [];
    let attendance = [];
    let store = null;
    let tally = [];

    chartStore().then((s) => { store = s; redraw(); }).catch((e) => toast(e.message, 'err'));

    watchMembers((list) => { members = list; redraw(); });
    watchPayments((list) => { payments = list; redraw(); });
    watchRecent(30, (rows) => { attendance = rows; redraw(); });

    function redraw() {
      const s = summarise(payments);
      const renewed = members.filter((m) => (m.renewalCount || 0) > 0).length;
      const visits = attendance.filter((r) => r.status === STATUS.PRESENT).length;

      $('#an-rev', el).textContent = fmtINR(s.total);
      $('#an-avg', el).textContent = members.length ? fmtINR(Math.round(s.total / members.length)) : '₹0';
      $('#an-ret', el).textContent = members.length ? `${Math.round((renewed / members.length) * 100)}%` : '–';
      $('#an-visits', el).textContent = visits;

      tally = exerciseTally(attendance);
      $('#an-top', el).innerHTML = tally.length
        ? tally.slice(0, 8).map((x, i) => `<li><span class="rank">${i + 1}</span>${esc(x.name)}
            <strong style="margin-left:auto">${x.count}</strong></li>`).join('')
        : '<li class="muted">No attendance logged in the last 30 days.</li>';

      if (!store) return;

      const series = monthlySeries(payments, 6);
      paint(store, 'rev', $('#ch-rev', el), {
        type: 'bar',
        data: {
          labels: series.labels,
          datasets: [
            { label: 'Joinings', data: series.joins, backgroundColor: PALETTE[0], borderRadius: 4, stack: 'r' },
            { label: 'Renewals', data: series.renewals, backgroundColor: PALETTE[1], borderRadius: 4, stack: 'r' },
          ],
        },
        options: { scales: { x: { stacked: true }, y: { stacked: true } } },
      });

      const buckets = ['active', 'expiring', 'expired'];
      paint(store, 'status', $('#ch-status', el), {
        type: 'doughnut',
        data: {
          labels: ['Active', 'Expiring ≤7d', 'Expired'],
          datasets: [{
            data: buckets.map((k) => members.filter((m) => membershipStatus(m.expiryDate).key === k).length),
            backgroundColor: [PALETTE[0], PALETTE[2], '#e53935'],
            borderWidth: 0,
          }],
        },
      });

      paint(store, 'cat', $('#ch-cat', el), {
        type: 'bar',
        data: {
          labels: CATEGORY_KEYS.map((k) => `Cat ${k}`),
          datasets: [{
            label: 'Members',
            data: CATEGORY_KEYS.map((k) => members.filter((m) => (m.exerciseCategory || 'A') === k).length),
            backgroundColor: CATEGORY_KEYS.map((_, i) => PALETTE[i % PALETTE.length]),
            borderRadius: 4,
          }],
        },
        options: { plugins: { legend: { display: false } } },
      });
    }

    wireExportMenu($('.export-row', el), () => ({
      name: 'exercise-popularity',
      title: 'Most-done exercises (last 30 days)',
      columns: ['Rank', 'Exercise', 'Times logged'],
      rows: tally.map((x, i) => [i + 1, x.name, x.count]),
    }));
  },
};
