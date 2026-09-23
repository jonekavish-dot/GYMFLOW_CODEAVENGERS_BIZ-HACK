import { requireRole, signOut, authErrorMessage } from '../auth.js';
import { registerMember, watchMembers, membershipStatus } from '../services/members.js';
import { createPlan, watchPlans } from '../services/plans.js';
import { createClass, deleteClass, watchUpcomingClasses } from '../services/classes.js';
import { watchOccupancy } from '../services/checkins.js';
import { $, esc, toast, fmtDate, fmtDateTime, initShell, busy } from '../ui.js';

const { profile } = await requireRole('admin');
initShell(profile);
$('#logout').addEventListener('click', signOut);

const today = new Date().toISOString().slice(0, 10);
$('#member-form').startDate.value = today;

// ── Plans ──
let plans = [];
watchPlans((list) => {
  plans = list;
  $('#plan-list').innerHTML = list.length
    ? list.map((p) => `<li><span class="plan-tag">${esc(p.name)}</span> <strong>₹${p.price}</strong> <span class="muted">· ${p.durationDays} days</span>
        ${p.active ? '' : '<span class="status-badge status-muted">Inactive</span>'}${p.description ? `<span class="muted small" style="flex-basis:100%">${esc(p.description)}</span>` : ''}</li>`).join('')
    : '<li class="muted">No plans yet — create one first, members need a plan.</li>';
  const active = list.filter((p) => p.active);
  $('#member-form').planId.innerHTML = active.length
    ? active.map((p) => `<option value="${p.id}">${esc(p.name)} (${p.durationDays}d · ₹${p.price})</option>`).join('')
    : '<option value="">Create a plan first</option>';
});

$('#plan-form').addEventListener('submit', (ev) => {
  const f = ev.target;
  busy(f, async () => {
    try {
      await createPlan({ name: f.planName.value.trim(), durationDays: f.durationDays.value, price: f.price.value, description: f.description.value.trim() });
      f.reset();
      toast('Plan created');
    } catch (e) { toast(authErrorMessage(e), 'err'); }
  });
});

// ── Members + expiry alerts ──
watchMembers((members) => {
  const rows = members.map((m) => ({ m, s: membershipStatus(m.expiryDate) }));
  $('#member-rows').innerHTML = rows.length
    ? rows.map(({ m, s }) => `<tr><td><strong>${esc(m.name)}</strong><span class="sub">${esc(m.email)}</span></td>
        <td><span class="plan-tag">${esc(m.planName)}</span></td><td>${fmtDate(m.expiryDate)}</td>
        <td><span class="status-badge status-${s.key}">${s.label}</span></td></tr>`).join('')
    : '<tr class="empty"><td colspan="4">No members yet — register one on the left.</td></tr>';

  const expiring = rows.filter((r) => r.s.key === 'expiring');
  const expired = rows.filter((r) => r.s.key === 'expired');
  $('#kpi-members').textContent = members.length;
  $('#kpi-expiring').textContent = expiring.length;
  $('#kpi-expired').textContent = expired.length;
  const alerts = [...expired, ...expiring];
  $('#nav-alerts').hidden = !alerts.length;
  $('#nav-alerts').textContent = alerts.length;
  $('#alerts').innerHTML = alerts.length
    ? alerts.map(({ m, s }) => `<li><span class="status-badge status-${s.key}">${s.label}</span> <strong>${esc(m.name)}</strong>
        <span class="muted">· ${esc(m.planName)} · ends ${fmtDate(m.expiryDate)}</span></li>`).join('')
    : '<li class="muted">✅ All memberships are healthy.</li>';
});

$('#member-form').addEventListener('submit', (ev) => {
  const f = ev.target;
  const plan = plans.find((p) => p.id === f.planId.value);
  if (!plan) return toast('Create a plan first.', 'err');
  busy(f, async () => {
    try {
      await registerMember({
        name: f.fullName.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(),
        password: f.password.value, plan, startDate: f.startDate.value, goals: f.goals.value.trim(),
      });
      f.reset();
      f.startDate.value = today;
      toast('Member registered — share their email + temporary password.');
    } catch (e) { toast(authErrorMessage(e), 'err'); }
  });
});

// ── Classes ──
watchUpcomingClasses((classes) => {
  $('#class-rows').innerHTML = classes.length
    ? classes.map((c) => {
      const full = c.bookedCount >= c.capacity;
      return `<tr><td><strong>${esc(c.title)}</strong><span class="sub">${esc(c.trainer)}</span></td>
        <td>${fmtDateTime(c.startAt)}</td>
        <td><span class="status-badge status-${full ? 'expired' : 'active'}">${c.bookedCount}/${c.capacity}</span></td>
        <td><button class="btn btn-danger btn-sm" data-del="${c.id}">Delete</button></td></tr>`;
    }).join('')
    : '<tr class="empty"><td colspan="4">No upcoming classes.</td></tr>';
});

$('#class-rows').addEventListener('click', async (ev) => {
  const id = ev.target.dataset.del;
  if (!id || !confirm('Delete this class?')) return;
  try { await deleteClass(id); toast('Class deleted'); } catch (e) { toast(authErrorMessage(e), 'err'); }
});

$('#class-form').addEventListener('submit', (ev) => {
  const f = ev.target;
  busy(f, async () => {
    try {
      await createClass({
        title: f.classTitle.value.trim(), trainer: f.trainer.value.trim(), startAt: f.startAt.value,
        durationMin: f.durationMin.value, capacity: f.capacity.value,
        tags: f.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
      });
      f.reset();
      toast('Class scheduled');
    } catch (e) { toast(authErrorMessage(e), 'err'); }
  });
});

// ── Live occupancy ──
watchOccupancy((count) => { $('#kpi-occupancy').textContent = count; });
