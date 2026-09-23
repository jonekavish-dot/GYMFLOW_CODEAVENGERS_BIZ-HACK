import { requireRole, signOut, authErrorMessage } from '../auth.js';
import { watchMember, updateGoals, membershipStatus } from '../services/members.js';
import { watchUpcomingClasses } from '../services/classes.js';
import { bookClass, cancelBooking, watchMyBookings } from '../services/bookings.js';
import { $, esc, toast, fmtDate, fmtDateTime, initShell, busy } from '../ui.js';

const { user, profile } = await requireRole('member');
initShell(profile);
$('#logout').addEventListener('click', signOut);

// ── Membership validity + expiry alert ──
let status = null;
let goalsLoaded = false;
watchMember(user.uid, (m) => {
  if (!m) return;
  status = membershipStatus(m.expiryDate);
  const pill = $('#status-pill');
  pill.className = `status-badge status-${status.key}`;
  pill.textContent = status.label;
  $('#kpi-days').textContent = Math.max(0, status.days);
  $('#kpi-days-sub').textContent = status.key === 'expired' ? 'Expired — renew at desk' : `Until ${fmtDate(m.expiryDate)}`;
  $('#ow-plan').textContent = m.planName;
  $('#m-plan').textContent = m.planName;
  $('#m-start').textContent = fmtDate(m.startDate);
  $('#m-expiry').textContent = fmtDate(m.expiryDate);

  const banner = $('#expiry-banner');
  banner.hidden = status.key === 'active';
  banner.className = `banner banner-${status.key}`;
  banner.textContent = status.key === 'expired'
    ? 'Your membership has expired — renew at the front desk to book classes.'
    : `Heads up: your membership ends in ${status.days} day${status.days === 1 ? '' : 's'}. Renew to keep booking.`;

  if (!goalsLoaded) { $('#goals-form').goals.value = m.goals || ''; goalsLoaded = true; }
  renderClasses();
});

$('#goals-form').addEventListener('submit', (ev) => {
  const f = ev.target;
  busy(f, async () => {
    try { await updateGoals(user.uid, f.goals.value.trim()); toast('Goals saved'); } catch (e) { toast(authErrorMessage(e), 'err'); }
  });
});

// ── Class booking ──
let classes = [];
let booked = new Set();
watchUpcomingClasses((list) => { classes = list; renderClasses(); });
watchMyBookings(user.uid, (list) => {
  booked = new Set(list.map((b) => b.classId));
  $('#kpi-booked').textContent = booked.size;
  $('#nav-booked').hidden = !booked.size;
  $('#nav-booked').textContent = booked.size;
  renderClasses();
});

function renderClasses() {
  const canBook = status && status.key !== 'expired';
  $('#class-rows').innerHTML = classes.length
    ? classes.map((c) => {
      const left = c.capacity - c.bookedCount;
      const action = booked.has(c.id)
        ? `<span class="status-badge status-active">✓ Booked</span> <button class="btn btn-ghost btn-sm" data-cancel="${c.id}">Cancel</button>`
        : `<button class="btn btn-primary btn-sm" data-book="${c.id}" ${!canBook || left <= 0 ? 'disabled' : ''}>${left <= 0 ? 'Full' : 'Book'}</button>`;
      const seat = left <= 0 ? 'expired' : left <= 3 ? 'expiring' : 'active';
      return `<tr><td><strong>${esc(c.title)}</strong><span class="sub">${esc(c.trainer)}${(c.tags || []).length ? ' · ' + esc(c.tags.join(', ')) : ''}</span></td>
        <td>${fmtDateTime(c.startAt)}</td><td><span class="status-badge status-${seat}">${left} / ${c.capacity}</span></td><td>${action}</td></tr>`;
    }).join('')
    : '<tr class="empty"><td colspan="4">No upcoming classes yet.</td></tr>';
}

$('#class-rows').addEventListener('click', async (ev) => {
  const { book, cancel } = ev.target.dataset;
  if (!book && !cancel) return;
  ev.target.disabled = true;
  try {
    if (book) { await bookClass(book, user.uid); toast('Booked!'); } else { await cancelBooking(cancel, user.uid); toast('Booking cancelled'); }
  } catch (e) {
    toast(authErrorMessage(e), 'err');
    ev.target.disabled = false;
  }
});
