// Admin · Gym Slots — schedule workout time slots with max customer overload,
// view live attendee counts, inspect attendee rosters, and toggle status.
import {
  createSlot, deleteSlot, updateSlotStatus, watchUpcomingSlots, watchSlotBookings,
} from './slots.service.js';
import { $, esc } from '../../shared/dom.js';
import { fmtDateTime } from '../../shared/format.js';
import { onSubmit } from '../../shared/forms.js';
import { openModal } from '../../shared/modal.js';
import { toast } from '../../shared/toast.js';
import { authErrorMessage } from '../../core/auth.js';

export default {
  id: 'slots',
  title: 'Gym Workout Slots',
  label: 'Slots',
  icon: '⏱️',
  section: 'Operations',

  template: () => `
    <div class="grid-2">
      <form id="slot-form" class="panel" onsubmit="return false">
        <div class="panel-hdr"><div class="panel-ttl">+ Create Gym Slot</div></div>
        <label>Slot Title / Area <input name="slotTitle" required placeholder="e.g. Morning Workout (Floor A)"></label>
        <div class="form-row">
          <label>Starts At <input type="datetime-local" name="startAt" required></label>
          <label>Duration (mins) <input type="number" name="durationMin" min="15" step="15" value="60" required></label>
        </div>
        <div class="form-row">
          <label>Max Customers (Capacity) <input type="number" name="capacity" min="1" value="15" required></label>
          <label>Initial Status <select name="status">
            <option value="open">Open for Booking</option>
            <option value="closed">Closed / Reserved</option>
          </select></label>
        </div>
        <label>Notes / Restrictions <input name="notes" placeholder="e.g. Bring personal gym towel & water"></label>
        <button type="submit" class="btn btn-primary btn-block">⚡ Create Workout Slot</button>
      </form>

      <div class="panel">
        <div class="panel-hdr">
          <div class="panel-ttl">Scheduled Gym Slots</div>
          <span class="panel-tag">Live</span>
        </div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr>
            <th>Slot</th>
            <th>When</th>
            <th>Booked</th>
            <th>Status</th>
            <th></th>
          </tr></thead>
          <tbody id="slot-rows"></tbody>
        </table></div>
      </div>
    </div>`,

  init({ el }) {
    let slots = [];

    const render = () => {
      $('#slot-rows', el).innerHTML = slots.length
        ? slots.map((s) => {
          const isFull = s.bookedCount >= s.capacity;
          const isClosed = s.status === 'closed';
          const badgeClass = isClosed || isFull ? 'expired' : s.capacity - s.bookedCount <= 3 ? 'expiring' : 'active';
          const badgeText = isClosed
            ? 'Closed'
            : isFull
              ? `FULL ${s.bookedCount}/${s.capacity}`
              : `${s.bookedCount} / ${s.capacity}`;

          return `<tr>
            <td data-label="Slot"><strong>${esc(s.title)}</strong>${s.notes ? `<span class="sub">${esc(s.notes)}</span>` : ''}</td>
            <td data-label="When">${fmtDateTime(s.startAt)} <span class="sub">${s.durationMin} min</span></td>
            <td data-label="Booked"><span class="status-badge status-${badgeClass}">${badgeText}</span></td>
            <td data-label="Status">
              <button class="btn btn-ghost btn-sm" data-toggle="${s.id}" data-current="${s.status || 'open'}">
                ${isClosed ? '🔴 Closed' : '🟢 Open'}
              </button>
            </td>
            <td class="row-actions">
              <button class="btn btn-primary btn-sm" data-roster="${s.id}">👥 Roster</button>
              <button class="btn btn-danger btn-sm" data-del="${s.id}">✕</button>
            </td>
          </tr>`;
        }).join('')
        : '<tr class="empty"><td colspan="5">No upcoming workout slots created yet.</td></tr>';
    };

    watchUpcomingSlots((list) => { slots = list; render(); });

    $('#slot-rows', el).addEventListener('click', async (ev) => {
      const toggleBtn = ev.target.closest('[data-toggle]');
      const rosterBtn = ev.target.closest('[data-roster]');
      const delBtn = ev.target.closest('[data-del]');

      if (toggleBtn) {
        const id = toggleBtn.dataset.toggle;
        const next = toggleBtn.dataset.current === 'open' ? 'closed' : 'open';
        try { await updateSlotStatus(id, next); toast(`Slot marked ${next}`); }
        catch (e) { toast(authErrorMessage(e), 'err'); }
        return;
      }

      if (rosterBtn) {
        const slot = slots.find((s) => s.id === rosterBtn.dataset.roster);
        if (slot) openSlotRoster(slot);
        return;
      }

      if (delBtn) {
        if (!confirm('Delete this workout slot?')) return;
        try { await deleteSlot(delBtn.dataset.del); toast('Slot deleted'); }
        catch (e) { toast(authErrorMessage(e), 'err'); }
      }
    });

    onSubmit($('#slot-form', el), async (f) => {
      await createSlot({
        title: f.slotTitle.value.trim(),
        startAt: f.startAt.value,
        durationMin: f.durationMin.value,
        capacity: f.capacity.value,
        status: f.status.value,
        notes: f.notes.value.trim(),
      });
      f.reset();
      f.durationMin.value = '60';
      f.capacity.value = '15';
    }, 'Workout slot created');

    function openSlotRoster(slot) {
      let unsub;
      const { el: modal } = openModal({
        title: `Attendee Roster · ${slot.title}`,
        wide: true,
        body: `
          <div class="panel-hdr">
            <div>
              <strong>${fmtDateTime(slot.startAt)}</strong>
              <div class="muted small">Max capacity: ${slot.capacity} · Booked: <span id="roster-count">${slot.bookedCount}</span></div>
            </div>
            <span class="status-badge status-${slot.bookedCount >= slot.capacity ? 'expired' : 'active'}">
              ${slot.bookedCount >= slot.capacity ? 'FULL' : `${slot.capacity - slot.bookedCount} spots left`}
            </span>
          </div>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Member</th><th>Member ID</th><th>Booked At</th></tr></thead>
            <tbody id="roster-rows"><tr class="empty"><td colspan="3">Loading…</td></tr></tbody>
          </table></div>`,
        onClose: () => { unsub?.(); },
      });

      unsub = watchSlotBookings(slot.id, (bookings) => {
        $('#roster-count', modal).textContent = bookings.length;
        $('#roster-rows', modal).innerHTML = bookings.length
          ? bookings.map((b) => `<tr>
              <td data-label="Member"><strong>${esc(b.memberName || '–')}</strong></td>
              <td data-label="Member ID"><span class="chip">${esc(b.customId || '–')}</span></td>
              <td data-label="Booked At">${b.createdAt ? fmtDateTime(b.createdAt) : '–'}</td>
            </tr>`).join('')
          : '<tr class="empty"><td colspan="3">No members have booked this slot yet.</td></tr>';
      });
    }
  },
};
