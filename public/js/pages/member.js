import { requireRole, signOut, authErrorMessage } from '../auth.js';
import { watchMember, updateGoals, membershipStatus } from '../services/members.js';
import { watchUpcomingClasses } from '../services/classes.js';
import { bookClass, cancelBooking, watchMyBookings } from '../services/bookings.js';
import { $, esc, toast, fmtDate, fmtDateTime, initTabs, busy } from '../ui.js';

const { user, profile } = await requireRole('member');
document.body.hidden = false;
$('#who').textContent = profile.name || profile.email;
$('#logout').addEventListener('click', signOut);
initTabs();

// ── Membership validity + expiry alert ──
let status = null;
let goalsLoaded = false;
watchMember(user.uid, (m) => {
  if (!m) return;
  status = membershipStatus(m.expiryDate);
  const pill = $('#status-pill');
  pill.className = `pill pill-${status.key}`;
  pill.textContent = status.label;
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
watchMyBookings(user.uid, (list) => { booked = new Set(list.map((b) => b.classId)); renderClasses(); });

function renderClasses() {
  const canBook = status && status.key !== 'expired';
  $('#class-rows').innerHTML = classes.length
    ? classes.map((c) => {
      const left = c.capacity - c.bookedCount;
      const action = booked.has(c.id)
        ? `<button class="btn btn-ghost btn-sm" data-cancel="${c.id}">Cancel</button>`
        : `<button class="btn btn-primary btn-sm" data-book="${c.id}" ${!canBook || left <= 0 ? 'disabled' : ''}>${left <= 0 ? 'Full' : 'Book'}</button>`;
      return `<tr><td>${esc(c.title)}<br><span class="muted small">${esc(c.trainer)}</span></td>
        <td>${fmtDateTime(c.startAt)}</td><td>${left} / ${c.capacity}</td><td>${action}</td></tr>`;
    }).join('')
    : '<tr><td colspan="4" class="muted">No upcoming classes.</td></tr>';
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
