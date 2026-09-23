import { requireRole, signOut, authErrorMessage } from '../auth.js';
import { registerMember, watchMembers, membershipStatus } from '../services/members.js';
import { createPlan, watchPlans } from '../services/plans.js';
import { createClass, deleteClass, watchUpcomingClasses } from '../services/classes.js';
import { watchOccupancy } from '../services/checkins.js';
import { $, esc, toast, fmtDate, fmtDateTime, initTabs, busy } from '../ui.js';

const { profile } = await requireRole('admin');
document.body.hidden = false;
$('#who').textContent = profile.name || profile.email;
$('#logout').addEventListener('click', signOut);
initTabs();

const today = new Date().toISOString().slice(0, 10);
$('#member-form').startDate.value = today;

// ── Plans ──
let plans = [];
watchPlans((list) => {
  plans = list;
  $('#plan-list').innerHTML = list.length
    ? list.map((p) => `<li><strong>${esc(p.name)}</strong> · ${p.durationDays} days · ₹${p.price}
        ${p.active ? '' : '<span class="pill pill-muted">inactive</span>'}<br><span class="muted">${esc(p.description)}</span></li>`).join('')
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
    ? rows.map(({ m, s }) => `<tr><td>${esc(m.name)}<br><span class="muted small">${esc(m.email)}</span></td>
        <td>${esc(m.planName)}</td><td><span class="pill pill-${s.key}">${s.label}</span></td></tr>`).join('')
    : '<tr><td colspan="3" class="muted">No members yet.</td></tr>';

  const expiring = rows.filter((r) => r.s.key === 'expiring');
  const expired = rows.filter((r) => r.s.key === 'expired');
  $('#kpi-members').textContent = members.length;
  $('#kpi-expiring').textContent = expiring.length;
  $('#kpi-expired').textContent = expired.length;
  const alerts = [...expired, ...expiring];
  $('#alerts').innerHTML = alerts.length
    ? alerts.map(({ m, s }) => `<li><span class="pill pill-${s.key}">${s.label}</span> ${esc(m.name)} · ${esc(m.planName)} · ends ${fmtDate(m.expiryDate)}</li>`).join('')
    : '<li class="muted">All memberships are healthy.</li>';
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
    ? classes.map((c) => `<tr><td>${esc(c.title)}<br><span class="muted small">${esc(c.trainer)}</span></td>
        <td>${fmtDateTime(c.startAt)}</td><td>${c.bookedCount}/${c.capacity}</td>
        <td><button class="btn btn-ghost btn-sm" data-del="${c.id}">Delete</button></td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">No upcoming classes.</td></tr>';
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
