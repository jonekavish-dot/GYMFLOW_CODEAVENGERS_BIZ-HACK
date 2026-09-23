// Member · Book Classes — live seat counts, book / cancel (capacity enforced by transaction + rules).
import { bookClass, cancelBooking, watchMyBookings } from './bookings.service.js';
import { watchUpcomingClasses } from '../classes/classes.service.js';
import { watchMember, membershipStatus } from '../members/members.service.js';
import { $, esc } from '../../shared/dom.js';
import { fmtDateTime } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';
import { authErrorMessage } from '../../core/auth.js';

export default {
  id: 'classes',
  title: 'Book Classes',
  label: 'Classes',
  icon: '📅',
  section: 'Main',

  template: () => `
    <div class="sec-title">Upcoming Classes</div>
    <div class="panel">
      <div class="panel-hdr"><div class="panel-ttl">📅 Book a Slot</div><span class="panel-tag">Live</span></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Class</th><th>When</th><th>Seats Left</th><th></th></tr></thead>
        <tbody id="class-rows"></tbody>
      </table></div>
    </div>`,

  init({ el, user, shell }) {
    let classes = [];
    let booked = new Set();
    let canBook = false;

    const render = () => {
      $('#class-rows', el).innerHTML = classes.length
        ? classes.map((c) => {
          const left = c.capacity - c.bookedCount;
          const action = booked.has(c.id)
            ? `<span class="status-badge status-active">✓ Booked</span> <button class="btn btn-ghost btn-sm" data-cancel="${c.id}">Cancel</button>`
            : `<button class="btn btn-primary btn-sm" data-book="${c.id}" ${!canBook || left <= 0 ? 'disabled' : ''}>${left <= 0 ? 'Full' : 'Book'}</button>`;
          const seat = left <= 0 ? 'expired' : left <= 3 ? 'expiring' : 'active';
          const tags = (c.tags || []).length ? ` · ${esc(c.tags.join(', '))}` : '';
          return `<tr><td data-label="Class"><strong>${esc(c.title)}</strong><span class="sub">${esc(c.trainer)}${tags}</span></td>
            <td data-label="When">${fmtDateTime(c.startAt)}</td><td data-label="Seats Left"><span class="status-badge status-${seat}">${left} / ${c.capacity}</span></td><td class="row-actions">${action}</td></tr>`;
        }).join('')
        : '<tr class="empty"><td colspan="4">No upcoming classes yet.</td></tr>';
    };

    watchMember(user.uid, (m) => { canBook = !!m && membershipStatus(m.expiryDate).key !== 'expired'; render(); });
    watchUpcomingClasses((list) => { classes = list; render(); });
    watchMyBookings(user.uid, (list) => {
      booked = new Set(list.map((b) => b.classId));
      shell.setBadge('classes', booked.size);
      render();
    });

    $('#class-rows', el).addEventListener('click', async (ev) => {
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
  },
};
