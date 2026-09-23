// Member · Gym Slots — browse available gym workout slots with live capacity,
// book/cancel slots. Slots reaching max customer capacity are automatically hidden.
import {
  bookSlot, watchUpcomingSlots, watchMySlotBookings,
} from './slots.service.js';
import { watchMember, membershipStatus } from '../members/members.service.js';
import { $, esc } from '../../shared/dom.js';
import { fmtDateTime } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';
import { authErrorMessage } from '../../core/auth.js';

export default {
  id: 'member-slots',
  title: 'Gym Workout Slots',
  label: 'Gym Slots',
  icon: '⏱️',
  section: 'Main',

  template: () => `
    <div class="sec-title">Book a Gym Slot</div>

    <div class="panel">
      <div class="panel-hdr">
        <div class="panel-ttl">🎟️ My Booked Slots</div>
        <span class="panel-tag" id="my-slots-count">0</span>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Slot</th><th>When</th><th>Status</th></tr></thead>
        <tbody id="my-slot-rows">
          <tr class="empty"><td colspan="3">You have no upcoming workout slots booked.</td></tr>
        </tbody>
      </table></div>
    </div>

    <div class="panel">
      <div class="panel-hdr">
        <div class="panel-ttl">⚡ Available Workout Slots</div>
        <span class="panel-tag">Live</span>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Slot</th><th>When</th><th>Spots Left</th><th></th></tr></thead>
        <tbody id="available-slot-rows">
          <tr class="empty"><td colspan="4">Loading available slots…</td></tr>
        </tbody>
      </table></div>
    </div>`,

  init({ el, user, profile, shell }) {
    let allSlots = [];
    let bookedSlotIds = new Set();
    let memberData = profile;
    let canBook = false;

    const render = () => {
      // ── My booked slots (no cancel button — confirmed once booked) ──
      const myBooked = allSlots.filter((s) => bookedSlotIds.has(s.id));
      $('#my-slots-count', el).textContent = myBooked.length;

      $('#my-slot-rows', el).innerHTML = myBooked.length
        ? myBooked.map((s) => `<tr>
            <td data-label="Slot">
              <strong>${esc(s.title)}</strong>
              ${s.trainer ? `<span class="sub">🧑‍🏫 Trainer: ${esc(s.trainer)}</span>` : ''}
              ${s.notes ? `<span class="sub">${esc(s.notes)}</span>` : ''}
            </td>
            <td data-label="When">${fmtDateTime(s.startAt)} <span class="sub">${s.durationMin} min</span></td>
            <td data-label="Status">
              <span class="status-badge status-active">✓ Booked</span>
            </td>
          </tr>`).join('')
        : '<tr class="empty"><td colspan="3">You have no upcoming workout slots booked.</td></tr>';

      // ── Available slots (hide full / closed / already-booked) ──
      const available = allSlots.filter((s) => {
        if (bookedSlotIds.has(s.id)) return false;
        if (s.status === 'closed') return false;
        if ((s.bookedCount || 0) >= s.capacity) return false;
        return true;
      });

      $('#available-slot-rows', el).innerHTML = available.length
        ? available.map((s) => {
          const left = Math.max(0, s.capacity - (s.bookedCount || 0));
          const seat = left <= 3 ? 'expiring' : 'active';
          return `<tr>
            <td data-label="Slot">
              <strong>${esc(s.title)}</strong>
              ${s.trainer ? `<span class="sub">🧑‍🏫 Trainer: ${esc(s.trainer)}</span>` : ''}
              ${s.notes ? `<span class="sub">${esc(s.notes)}</span>` : ''}
            </td>
            <td data-label="When">${fmtDateTime(s.startAt)} <span class="sub">${s.durationMin} min</span></td>
            <td data-label="Spots Left"><span class="status-badge status-${seat}">${left} / ${s.capacity}</span></td>
            <td class="row-actions">
              <button class="btn btn-primary btn-sm" data-book-slot="${s.id}" ${!canBook ? 'disabled' : ''}>${canBook ? 'Book' : 'Expired'}</button>
            </td>
          </tr>`;
        }).join('')
        : '<tr class="empty"><td colspan="4">No open slots available right now.</td></tr>';
    };

    watchMember(user.uid, (m) => {
      if (!m) return;
      memberData = m;
      canBook = membershipStatus(m.expiryDate).key !== 'expired';
      render();
    });

    watchUpcomingSlots((list) => { allSlots = list; render(); });

    watchMySlotBookings(user.uid, (list) => {
      bookedSlotIds = new Set(list.map((b) => b.slotId));
      shell.setBadge('member-slots', bookedSlotIds.size);
      render();
    });

    // Book
    $('#available-slot-rows', el).addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-book-slot]');
      if (!btn) return;
      const slotId = btn.dataset.bookSlot;

      // Time Security Check: Ensure member does not have an overlapping slot booking
      const targetSlot = allSlots.find((s) => s.id === slotId);
      if (targetSlot) {
        const targetStart = targetSlot.startAt?.toMillis ? targetSlot.startAt.toMillis() : new Date(targetSlot.startAt).getTime();
        const targetEnd = targetSlot.endAt?.toMillis
          ? targetSlot.endAt.toMillis()
          : targetStart + (targetSlot.durationMin || 60) * 60000;

        const overlap = allSlots.find((s) => {
          if (!bookedSlotIds.has(s.id)) return false;
          const sStart = s.startAt?.toMillis ? s.startAt.toMillis() : new Date(s.startAt).getTime();
          const sEnd = s.endAt?.toMillis ? s.endAt.toMillis() : sStart + (s.durationMin || 60) * 60000;
          return targetStart < sEnd && targetEnd > sStart;
        });

        if (overlap) {
          toast(`Time Conflict: You already have a slot booked ("${overlap.title}") at this time.`, 'err');
          return;
        }
      }

      btn.disabled = true;
      try {
        await bookSlot(slotId, {
          uid: user.uid,
          name: memberData?.name || user.email,
          customId: memberData?.customId || '',
        });
        toast('Slot booked! 🎉');
      } catch (e) {
        toast(authErrorMessage(e), 'err');
        btn.disabled = false;
      }
    });
  },
};
