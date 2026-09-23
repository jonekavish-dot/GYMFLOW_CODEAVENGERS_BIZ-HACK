// Admin · Members — register, search, renew, inspect and remove members.
// Ports the old portal's member form (custom ID, exercise category, fee, method,
// notes), its sortable/paginated table, and its renew + detail modals.
import {
  registerMember, renewMembership, deleteMember, updateMember,
  watchMembers, membershipStatus, daysLeft, nextCustomId,
} from './members.service.js';
import { watchPlans, monthlyRate, RENEW_MONTHS } from '../plans/plans.service.js';
import { CATEGORY_KEYS, exercisesFor } from '../exercises/exercises.service.js';
import { METHODS } from '../payments/payments.service.js';
import { $, esc } from '../../shared/dom.js';
import { fmtDate, fmtINR, initials, todayStr } from '../../shared/format.js';
import { onSubmit } from '../../shared/forms.js';
import { dataTable } from '../../shared/table.js';
import { openModal, confirmAction } from '../../shared/modal.js';
import { wireExportMenu, exportButtons } from '../../shared/export.js';
import { toast } from '../../shared/toast.js';

const methodOptions = (sel = 'Cash') => METHODS
  .map((m) => `<option ${m === sel ? 'selected' : ''}>${m}</option>`).join('');

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
        <div class="form-row">
          <label>Member ID <input name="customId" required placeholder="ASF001"></label>
          <label>Full Name <input name="fullName" required></label>
        </div>
        <label>Email <input type="email" name="email" required></label>
        <div class="form-row">
          <label>Phone <input type="tel" name="phone" required></label>
          <label>Temp Password <input name="password" required minlength="6"></label>
        </div>
        <div class="form-row">
          <label>Plan <select name="planId" required></select></label>
          <label>Duration <select name="months">
            ${RENEW_MONTHS.map((d) => `<option value="${d.months}">${d.label} (${d.months}mo)</option>`).join('')}
          </select></label>
        </div>
        <div class="form-row">
          <label>Join Date <input type="date" name="startDate" required></label>
          <label>Exercise Category <select name="exerciseCategory">
            ${CATEGORY_KEYS.map((k) => `<option value="${k}">Category ${k}</option>`).join('')}
          </select></label>
        </div>
        <div class="form-row">
          <label>Fee Paid (₹) <input type="number" name="paid" min="0" required></label>
          <label>Payment Method <select name="method">${methodOptions()}</select></label>
        </div>
        <label>Goals <textarea name="goals" rows="2" placeholder="e.g. lose 5 kg, build stamina"></textarea></label>
        <label>Notes <input name="notes" placeholder="Optional"></label>
        <button type="submit" class="btn btn-primary btn-block">Register Member</button>
      </form>
      <div class="panel">
        <div class="panel-hdr">
          <div class="panel-ttl">All Members</div>
          <div class="hdr-tools">
            <input id="member-search" class="search-input" type="search" placeholder="Search name, ID, phone…">
            ${exportButtons()}
          </div>
        </div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr>
            <th data-sort="name">Member</th><th data-sort="plan">Plan</th><th data-sort="cat">Cat</th>
            <th data-sort="paid">Paid</th><th data-sort="expiry">Expiry</th><th>Actions</th>
          </tr></thead>
          <tbody id="member-rows"></tbody>
        </table></div>
        <div class="pager" id="member-pager"></div>
      </div>
    </div>`,

  init({ el }) {
    const form = $('#member-form', el);
    form.startDate.value = todayStr();

    let plans = [];
    let members = [];

    const planOptions = (selId) => plans
      .map((p) => `<option value="${p.id}" ${p.id === selId ? 'selected' : ''}>${esc(p.name)} · ${fmtINR(monthlyRate(p))}/mo</option>`)
      .join('');

    // Fee auto-fills from plan × months, but stays editable for discounts.
    const syncFee = () => {
      const plan = plans.find((p) => p.id === form.planId.value);
      if (plan) form.paid.value = monthlyRate(plan) * Number(form.months.value);
    };

    watchPlans((list) => {
      plans = list.filter((p) => p.active);
      form.planId.innerHTML = plans.length ? planOptions() : '<option value="">Create a plan first</option>';
      syncFee();
    });

    form.planId.addEventListener('change', syncFee);
    form.months.addEventListener('change', syncFee);

    const table = dataTable({
      el,
      body: '#member-rows',
      search: '#member-search',
      pager: '#member-pager',
      cols: 6,
      sort: 'expiry',
      empty: 'No members yet — register one on the left.',
      fields: {
        name: (m) => m.name,
        plan: (m) => m.planName,
        cat: (m) => m.exerciseCategory || '',
        paid: (m) => m.paid || 0,
        expiry: (m) => daysLeft(m.expiryDate),
      },
      match: (m) => [m.name, m.customId, m.phone, m.email, m.planName].join(' '),
      render: (m) => {
        const s = membershipStatus(m.expiryDate);
        return `<tr>
          <td><div class="cell-user"><span class="av-sm">${esc(initials(m.name))}</span>
            <span><strong>${esc(m.name)}</strong><span class="sub">${esc(m.customId || m.email)}</span></span></div></td>
          <td><span class="plan-tag">${esc(m.planName)}</span></td>
          <td><span class="cat-tag">${esc(m.exerciseCategory || '–')}</span></td>
          <td>${fmtINR(m.paid)}</td>
          <td>${fmtDate(m.expiryDate)}<span class="sub"><span class="status-badge status-${s.key}">${s.label}</span></span></td>
          <td class="row-actions">
            <button class="btn btn-primary btn-sm" data-renew="${m.uid}">Renew</button>
            <button class="btn btn-ghost btn-sm" data-view="${m.uid}">View</button>
            <button class="btn btn-danger btn-sm" data-del="${m.uid}">✕</button>
          </td></tr>`;
      },
    });

    watchMembers((list) => {
      members = list;
      table.set(list);
      if (!form.customId.value || form.dataset.idAuto === '1') {
        form.customId.value = nextCustomId(list);
        form.dataset.idAuto = '1';
      }
    });
    form.customId.addEventListener('input', () => { form.dataset.idAuto = '0'; });

    wireExportMenu($('.export-row', el), () => ({
      name: 'members',
      title: 'GymFlow — Members',
      columns: ['Member ID', 'Name', 'Email', 'Phone', 'Plan', 'Category', 'Joined', 'Expiry', 'Status', 'Paid', 'Renewals'],
      rows: table.visible.map((m) => [
        m.customId || '', m.name, m.email, m.phone || '', m.planName, m.exerciseCategory || '',
        fmtDate(m.startDate), fmtDate(m.expiryDate), membershipStatus(m.expiryDate).key,
        Number(m.paid) || 0, m.renewalCount || 0,
      ]),
    }));

    $('#member-rows', el).addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-renew],[data-view],[data-del]');
      if (!btn) return;
      const member = members.find((m) => m.uid === (btn.dataset.renew || btn.dataset.view || btn.dataset.del));
      if (!member) return;
      if (btn.dataset.renew) openRenew(member);
      else if (btn.dataset.view) openDetail(member);
      else removeMember(member);
    });

    onSubmit(form, async (f) => {
      const plan = plans.find((p) => p.id === f.planId.value);
      if (!plan) throw new Error('Create a plan first.');
      if (members.some((m) => (m.customId || '').toUpperCase() === f.customId.value.trim().toUpperCase())) {
        throw new Error(`Member ID ${f.customId.value.trim()} is already taken.`);
      }
      await registerMember({
        customId: f.customId.value.trim().toUpperCase(),
        name: f.fullName.value.trim(),
        email: f.email.value.trim(),
        phone: f.phone.value.trim(),
        password: f.password.value,
        plan,
        months: Number(f.months.value),
        startDate: f.startDate.value,
        exerciseCategory: f.exerciseCategory.value,
        paid: Number(f.paid.value),
        method: f.method.value,
        goals: f.goals.value.trim(),
        notes: f.notes.value.trim(),
      });
      f.reset();
      f.startDate.value = todayStr();
      f.dataset.idAuto = '1';
      f.customId.value = nextCustomId(members);
      syncFee();
    }, 'Member registered — share their email + temporary password.');

    // ── Renew ──
    function openRenew(member) {
      const s = membershipStatus(member.expiryDate);
      const { el: modal, close } = openModal({
        title: `Renew · ${member.name}`,
        body: `
          <div class="renew-who">
            <span class="av-sm">${esc(initials(member.name))}</span>
            <div><strong>${esc(member.name)}</strong>
              <div class="muted small">${esc(member.customId || member.email)} · ${esc(member.planName)}
                · <span class="status-badge status-${s.key}">${s.label}</span></div>
              <div class="muted small">Paid so far: <strong>${fmtINR(member.paid)}</strong></div></div>
          </div>
          <form id="renew-form" onsubmit="return false">
            <label>Plan <select name="planId">${planOptions(member.planId)}</select></label>
            <label>Duration <select name="months">
              ${RENEW_MONTHS.map((d) => `<option value="${d.months}">${d.label} · ${d.months} month${d.months > 1 ? 's' : ''}</option>`).join('')}
            </select></label>
            <div class="renew-preview" id="renew-preview"></div>
            <div class="form-row">
              <label>Fee (₹) <input type="number" name="fee" min="0" required></label>
              <label>Method <select name="method">${methodOptions(member.method)}</select></label>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Confirm Renewal</button>
          </form>`,
      });

      const rf = $('#renew-form', modal);
      const preview = () => {
        const plan = plans.find((p) => p.id === rf.planId.value);
        const months = Number(rf.months.value);
        if (!plan) return;
        const from = daysLeft(member.expiryDate) < 0 ? new Date() : member.expiryDate;
        const until = new Date(from?.toDate ? from.toDate() : from);
        until.setMonth(until.getMonth() + months);
        rf.fee.value = monthlyRate(plan) * months;
        $('#renew-preview', modal).innerHTML = `New expiry <strong>${fmtDate(until)}</strong>
          <span class="muted">· ${fmtINR(monthlyRate(plan))}/mo × ${months}
          ${daysLeft(member.expiryDate) < 0 ? '· restarts today (expired)' : '· stacks on remaining days'}</span>`;
      };
      rf.planId.addEventListener('change', preview);
      rf.months.addEventListener('change', preview);
      preview();

      onSubmit(rf, async (f) => {
        const plan = plans.find((p) => p.id === f.planId.value);
        const expiry = await renewMembership({
          member, plan, months: Number(f.months.value), fee: Number(f.fee.value), method: f.method.value,
        });
        close();
        toast(`${member.name} renewed to ${fmtDate(expiry)} · ${fmtINR(f.fee.value)} collected`);
      });
    }

    // ── Detail ──
    function openDetail(member) {
      const s = membershipStatus(member.expiryDate);
      const rotation = exercisesFor(member.exerciseCategory);
      const { el: modal } = openModal({
        title: member.name,
        wide: true,
        body: `
          <dl class="facts">
            <dt>Member ID</dt><dd>${esc(member.customId || '–')}</dd>
            <dt>Status</dt><dd><span class="status-badge status-${s.key}">${s.label}</span></dd>
            <dt>Plan</dt><dd>${esc(member.planName)}</dd>
            <dt>Joined</dt><dd>${fmtDate(member.startDate)}</dd>
            <dt>Expires</dt><dd>${fmtDate(member.expiryDate)}</dd>
            <dt>Phone</dt><dd>${esc(member.phone || '–')}</dd>
            <dt>Email</dt><dd>${esc(member.email)}</dd>
            <dt>Total paid</dt><dd>${fmtINR(member.paid)}</dd>
            <dt>Renewals</dt><dd>${member.renewalCount || 0}</dd>
            <dt>Goals</dt><dd>${esc(member.goals || '–')}</dd>
            <dt>Notes</dt><dd>${esc(member.notes || '–')}</dd>
          </dl>
          <div class="sec-title">Exercise Category</div>
          <form id="cat-form" class="cat-editor" onsubmit="return false">
            <select name="exerciseCategory">
              ${CATEGORY_KEYS.map((k) => `<option value="${k}" ${k === member.exerciseCategory ? 'selected' : ''}>Category ${k}</option>`).join('')}
            </select>
            <button type="submit" class="btn btn-primary btn-sm">Save</button>
          </form>
          <ul class="rotation">${rotation.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`,
      });

      onSubmit($('#cat-form', modal), async (f) => {
        await updateMember(member.uid, { exerciseCategory: f.exerciseCategory.value });
        $('.rotation', modal).innerHTML = exercisesFor(f.exerciseCategory.value)
          .map((x) => `<li>${esc(x)}</li>`).join('');
      }, 'Exercise category updated');
    }

    async function removeMember(member) {
      const ok = await confirmAction({
        title: `Remove ${member.name}?`,
        message: 'Their membership and portal access are deleted. Payment history is kept for the revenue records.',
        confirmLabel: 'Remove member',
      });
      if (!ok) return;
      try {
        await deleteMember(member.uid);
        toast(`${member.name} removed`);
      } catch (e) {
        toast(e.message, 'err');
      }
    }
  },
};
