// Member · My Activity — attendance history with streak, the member's own exercise
// rotation, and their payment receipts. The old portal kept all of this admin-only.
import { watchPersonHistory, currentStreak, STATUS } from '../attendance/attendance.service.js';
import { watchMemberPayments } from '../payments/payments.service.js';
import { watchMember } from '../members/members.service.js';
import { watchGym } from '../settings/settings.service.js';
import { exercisesFor } from '../exercises/exercises.service.js';
import { $, esc } from '../../shared/dom.js';
import { fmtDate, fmtINR } from '../../shared/format.js';
import { printReceipt } from '../../shared/receipt.js';
import { toast } from '../../shared/toast.js';

export default {
  id: 'activity',
  title: 'My Activity',
  label: 'Activity',
  icon: '🔥',
  section: 'Main',

  template: () => `
    <div class="kpi-grid">
      <div class="kpi-card" style="--card-accent:#f5a623"><div class="kpi-lbl">🔥 Current Streak</div><div class="kpi-val" id="ac-streak">–</div><div class="kpi-sub">Consecutive days</div></div>
      <div class="kpi-card" style="--card-accent:#39e56a"><div class="kpi-lbl">✅ Total Visits</div><div class="kpi-val" id="ac-visits">–</div><div class="kpi-sub">Days present</div></div>
      <div class="kpi-card" style="--card-accent:#4da6ff"><div class="kpi-lbl">💰 Total Paid</div><div class="kpi-val" id="ac-paid">–</div><div class="kpi-sub">All payments</div></div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-hdr"><div class="panel-ttl">📋 My Exercise Rotation</div><span class="panel-tag" id="ac-cat">–</span></div>
        <ol class="rotation" id="ac-rotation"></ol>
      </div>
      <div class="panel">
        <div class="panel-hdr"><div class="panel-ttl">✅ Attendance History</div></div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Date</th><th>Status</th><th>Exercises</th></tr></thead>
          <tbody id="ac-att"></tbody>
        </table></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-hdr"><div class="panel-ttl">🧾 My Payments</div></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Plan</th><th>Type</th><th>Amount</th><th></th></tr></thead>
        <tbody id="ac-pay"></tbody>
      </table></div>
    </div>`,

  init({ el, user }) {
    let payments = [];
    let gym = {};
    watchGym((g) => { gym = g; });

    watchMember(user.uid, (m) => {
      if (!m) return;
      const cat = m.exerciseCategory || 'A';
      $('#ac-cat', el).textContent = `Category ${cat}`;
      $('#ac-rotation', el).innerHTML = exercisesFor(cat).map((x) => `<li>${esc(x)}</li>`).join('');
      $('#ac-paid', el).textContent = fmtINR(m.paid);
    });

    watchPersonHistory(user.uid, (rows) => {
      $('#ac-streak', el).textContent = currentStreak(rows);
      $('#ac-visits', el).textContent = rows.filter((r) => r.status === STATUS.PRESENT).length;
      $('#ac-att', el).innerHTML = rows.length
        ? rows.slice(0, 30).map((r) => `<tr>
            <td>${esc(r.date)}</td>
            <td><span class="status-badge status-${r.status === STATUS.PRESENT ? 'active' : 'muted'}">${esc(r.status)}</span></td>
            <td>${(r.exercises || []).length ? (r.exercises || []).map((x) => `<span class="chip">${esc(x)}</span>`).join('') : '<span class="muted">–</span>'}</td>
          </tr>`).join('')
        : '<tr class="empty"><td colspan="3">No attendance recorded yet.</td></tr>';
    });

    watchMemberPayments(user.uid, (rows) => {
      payments = rows;
      $('#ac-pay', el).innerHTML = rows.length
        ? rows.map((p) => `<tr>
            <td>${p.at ? fmtDate(p.at) : '–'}</td>
            <td><span class="plan-tag">${esc(p.planName)}</span> <span class="muted small">${p.months || 1} mo</span></td>
            <td>${p.kind === 'renewal' ? 'Renewal' : 'Joining'}</td>
            <td><strong>${fmtINR(p.amount)}</strong></td>
            <td><button class="btn btn-ghost btn-sm" data-receipt="${p.id}">🧾 Receipt</button></td>
          </tr>`).join('')
        : '<tr class="empty"><td colspan="5">No payments recorded yet.</td></tr>';
    });

    $('#ac-pay', el).addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-receipt]');
      if (!btn) return;
      const payment = payments.find((p) => p.id === btn.dataset.receipt);
      if (payment && !printReceipt({ payment, gym })) {
        toast('Allow pop-ups for this site to print receipts.', 'err');
      }
    });
  },
};
