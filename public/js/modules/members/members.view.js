// Admin · Members — register members (creates their login) and list membership status.
import { registerMember, watchMembers, membershipStatus } from './members.service.js';
import { watchPlans } from '../plans/plans.service.js';
import { $, esc } from '../../shared/dom.js';
import { fmtDate } from '../../shared/format.js';
import { onSubmit } from '../../shared/forms.js';

const today = () => new Date().toISOString().slice(0, 10);

export default {
  id: 'members',
  title: 'Members',
  label: 'Members',
  icon: '👥',
  section: 'Main',

  template: () => `
    <div class="grid-2">
      <form id="member-form" class="panel" onsubmit="return false">
        <div class="panel-hdr"><div class="panel-ttl">+ Register Member</div></div>
        <label>Full Name <input name="fullName" required></label>
        <label>Email <input type="email" name="email" required></label>
        <div class="form-row">
          <label>Phone <input type="tel" name="phone"></label>
          <label>Temp Password <input name="password" required minlength="6"></label>
        </div>
        <label>Plan <select name="planId" required></select></label>
        <label>Start Date <input type="date" name="startDate" required></label>
        <label>Goals <textarea name="goals" rows="2" placeholder="e.g. lose 5 kg, build stamina"></textarea></label>
        <button type="submit" class="btn btn-primary btn-block">Register Member</button>
      </form>
      <div class="panel">
        <div class="panel-hdr"><div class="panel-ttl">All Members</div></div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Member</th><th>Plan</th><th>Expiry</th><th>Status</th></tr></thead>
          <tbody id="member-rows"></tbody>
        </table></div>
      </div>
    </div>`,

  init({ el }) {
    const form = $('#member-form', el);
    form.startDate.value = today();

    let plans = [];
    watchPlans((list) => {
      plans = list.filter((p) => p.active);
      form.planId.innerHTML = plans.length
        ? plans.map((p) => `<option value="${p.id}">${esc(p.name)} (${p.durationDays}d · ₹${p.price})</option>`).join('')
        : '<option value="">Create a plan first</option>';
    });

    watchMembers((members) => {
      $('#member-rows', el).innerHTML = members.length
        ? members.map((m) => {
          const s = membershipStatus(m.expiryDate);
          return `<tr><td><strong>${esc(m.name)}</strong><span class="sub">${esc(m.email)}</span></td>
            <td><span class="plan-tag">${esc(m.planName)}</span></td><td>${fmtDate(m.expiryDate)}</td>
            <td><span class="status-badge status-${s.key}">${s.label}</span></td></tr>`;
        }).join('')
        : '<tr class="empty"><td colspan="4">No members yet — register one on the left.</td></tr>';
    });

    onSubmit(form, async (f) => {
      const plan = plans.find((p) => p.id === f.planId.value);
      if (!plan) throw new Error('Create a plan first.');
      await registerMember({
        name: f.fullName.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(),
        password: f.password.value, plan, startDate: f.startDate.value, goals: f.goals.value.trim(),
      });
      f.reset();
      f.startDate.value = today();
    }, 'Member registered — share their email + temporary password.');
  },
};
