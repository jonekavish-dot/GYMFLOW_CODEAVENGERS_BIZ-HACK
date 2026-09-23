// Admin · Payments — revenue ledger with receipts and exports, replacing the old
// portal's payments page (which recomputed revenue from member records each render).
import { watchPayments, summarise } from './payments.service.js';
import { watchGym } from '../settings/settings.service.js';
import { $, esc } from '../../shared/dom.js';
import { fmtDate, fmtINR } from '../../shared/format.js';
import { dataTable } from '../../shared/table.js';
import { wireExportMenu, exportButtons } from '../../shared/export.js';
import { printReceipt } from '../../shared/receipt.js';
import { toast } from '../../shared/toast.js';

export default {
  id: 'payments',
  title: 'Payments & Revenue',
  label: 'Payments',
  icon: '💰',
  section: 'Operations',

  template: () => `
    <div class="sec-title">Revenue</div>
    <div class="kpi-grid">
      <div class="kpi-card" style="--card-accent:#39e56a"><div class="kpi-lbl">💰 Total Collected</div><div class="kpi-val" id="pay-total">–</div><div class="kpi-sub">All time</div></div>
      <div class="kpi-card" style="--card-accent:#4da6ff"><div class="kpi-lbl">📅 This Month</div><div class="kpi-val" id="pay-month">–</div><div class="kpi-sub">Joins + renewals</div></div>
      <div class="kpi-card" style="--card-accent:#f5a623"><div class="kpi-lbl">🔄 Renewal Revenue</div><div class="kpi-val" id="pay-renew">–</div><div class="kpi-sub">Repeat business</div></div>
      <div class="kpi-card" style="--card-accent:#c084fc"><div class="kpi-lbl">☀️ Today</div><div class="kpi-val" id="pay-today">–</div><div class="kpi-sub">Collected today</div></div>
    </div>
    <div class="panel">
      <div class="panel-hdr">
        <div class="panel-ttl">Payment History</div>
        <div class="hdr-tools">
          <input id="pay-search" class="search-input" type="search" placeholder="Search member, method…">
          ${exportButtons()}
        </div>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th data-sort="date">Date</th><th data-sort="member">Member</th><th data-sort="plan">Plan</th>
          <th data-sort="kind">Type</th><th data-sort="method">Method</th><th data-sort="amount">Amount</th><th></th>
        </tr></thead>
        <tbody id="pay-rows"></tbody>
      </table></div>
      <div class="pager" id="pay-pager"></div>
    </div>`,

  init({ el }) {
    let payments = [];
    let gym = {};
    watchGym((g) => { gym = g; });

    const table = dataTable({
      el,
      body: '#pay-rows',
      search: '#pay-search',
      pager: '#pay-pager',
      cols: 7,
      sort: 'date',
      dir: 'desc',
      pageSize: 12,
      empty: 'No payments recorded yet.',
      fields: {
        date: (p) => p.at?.toMillis?.() || 0,
        member: (p) => p.memberName,
        plan: (p) => p.planName,
        kind: (p) => p.kind,
        method: (p) => p.method,
        amount: (p) => Number(p.amount) || 0,
      },
      match: (p) => [p.memberName, p.customId, p.planName, p.method, p.kind].join(' '),
      render: (p) => `<tr>
        <td data-label="Date">${p.at ? fmtDate(p.at) : '–'}</td>
        <td data-label="Member"><strong>${esc(p.memberName)}</strong><span class="sub">${esc(p.customId || '')}</span></td>
        <td data-label="Plan"><span class="plan-tag">${esc(p.planName)}</span><span class="sub">${p.months || 1} mo</span></td>
        <td data-label="Type"><span class="status-badge status-${p.kind === 'renewal' ? 'expiring' : 'active'}">${p.kind === 'renewal' ? 'Renewal' : 'Joining'}</span></td>
        <td data-label="Method">${esc(p.method || 'Cash')}</td>
        <td data-label="Amount"><strong>${fmtINR(p.amount)}</strong></td>
        <td class="row-actions"><button class="btn btn-ghost btn-sm" data-receipt="${p.id}">🧾 Receipt</button></td>
      </tr>`,
    });

    watchPayments((list) => {
      payments = list;
      table.set(list);
      const s = summarise(list);
      $('#pay-total', el).textContent = fmtINR(s.total);
      $('#pay-month', el).textContent = fmtINR(s.month);
      $('#pay-renew', el).textContent = fmtINR(s.renewals);
      $('#pay-today', el).textContent = fmtINR(s.today);
    });

    $('#pay-rows', el).addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-receipt]');
      if (!btn) return;
      const payment = payments.find((p) => p.id === btn.dataset.receipt);
      if (payment && !printReceipt({ payment, gym })) {
        toast('Allow pop-ups for this site to print receipts.', 'err');
      }
    });

    wireExportMenu($('.export-row', el), () => ({
      name: 'payments',
      title: `${gym.name || 'GymFlow'} — Payments`,
      columns: ['Date', 'Member', 'Member ID', 'Plan', 'Months', 'Type', 'Method', 'Amount'],
      rows: table.visible.map((p) => [
        p.at ? fmtDate(p.at) : '', p.memberName, p.customId || '', p.planName,
        p.months || 1, p.kind === 'renewal' ? 'Renewal' : 'Joining', p.method || 'Cash', Number(p.amount) || 0,
      ]),
    }));
  },
};
