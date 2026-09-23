// Admin · Dashboard — KPIs, live occupancy and auto-expiry alerts.
import { watchMembers, membershipStatus } from '../members/members.service.js';
import { watchOccupancy } from '../checkins/checkins.service.js';
import { $, esc } from '../../shared/dom.js';
import { fmtDate } from '../../shared/format.js';

export default {
  id: 'dashboard',
  title: 'Overview Dashboard',
  label: 'Dashboard',
  icon: '📊',
  section: 'Main',

  template: () => `
    <div class="sec-title">Key Metrics</div>
    <div class="kpi-grid">
      <div class="kpi-card" style="--card-accent:#39e56a"><div class="kpi-lbl">👥 Members</div><div class="kpi-val" id="kpi-members">–</div><div class="kpi-sub">Registered</div></div>
      <div class="kpi-card" style="--card-accent:#f5a623"><div class="kpi-lbl">⏳ Expiring ≤ 7d</div><div class="kpi-val" id="kpi-expiring">–</div><div class="kpi-sub">Renew soon</div></div>
      <div class="kpi-card" style="--card-accent:#e53935"><div class="kpi-lbl">⛔ Expired</div><div class="kpi-val" id="kpi-expired">–</div><div class="kpi-sub">Can't book classes</div></div>
      <div class="kpi-card" style="--card-accent:#4da6ff"><div class="kpi-lbl">🏋️ Inside Now</div><div class="kpi-val" id="kpi-occupancy">–</div><div class="kpi-sub">Live occupancy</div></div>
    </div>
    <div class="sec-title">Alerts</div>
    <div class="panel">
      <div class="panel-hdr"><div class="panel-ttl">🔔 Membership Alerts</div><span class="panel-tag">Auto</span></div>
      <ul id="alerts" class="list"><li class="muted">Loading…</li></ul>
    </div>`,

  init({ el, shell }) {
    watchMembers((members) => {
      const rows = members.map((m) => ({ m, s: membershipStatus(m.expiryDate) }));
      const expiring = rows.filter((r) => r.s.key === 'expiring');
      const expired = rows.filter((r) => r.s.key === 'expired');
      const alerts = [...expired, ...expiring];
      $('#kpi-members', el).textContent = members.length;
      $('#kpi-expiring', el).textContent = expiring.length;
      $('#kpi-expired', el).textContent = expired.length;
      shell.setBadge('dashboard', alerts.length);
      $('#alerts', el).innerHTML = alerts.length
        ? alerts.map(({ m, s }) => `<li><span class="status-badge status-${s.key}">${s.label}</span> <strong>${esc(m.name)}</strong>
            <span class="muted">· ${esc(m.planName)} · ends ${fmtDate(m.expiryDate)}</span></li>`).join('')
        : '<li class="muted">✅ All memberships are healthy.</li>';
    });
    watchOccupancy((count) => { $('#kpi-occupancy', el).textContent = count; });
  },
};
