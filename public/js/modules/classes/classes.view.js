// Admin · Classes — schedule classes with a capacity and watch bookings fill up live.
import { createClass, deleteClass, watchUpcomingClasses } from './classes.service.js';
import { $, esc } from '../../shared/dom.js';
import { fmtDateTime } from '../../shared/format.js';
import { onSubmit } from '../../shared/forms.js';
import { toast } from '../../shared/toast.js';
import { authErrorMessage } from '../../core/auth.js';

export default {
  id: 'classes',
  title: 'Class Schedule',
  label: 'Classes',
  icon: '📅',
  section: 'Operations',

  template: () => `
    <div class="grid-2">
      <form id="class-form" class="panel" onsubmit="return false">
        <div class="panel-hdr"><div class="panel-ttl">+ Schedule Class</div></div>
        <label>Title <input name="classTitle" required placeholder="HIIT Blast"></label>
        <label>Trainer <input name="trainer" required></label>
        <label>Starts <input type="datetime-local" name="startAt" required></label>
        <div class="form-row">
          <label>Duration (min) <input type="number" name="durationMin" min="10" value="60" required></label>
          <label>Capacity <input type="number" name="capacity" min="1" value="20" required></label>
        </div>
        <label>Tags <input name="tags" placeholder="cardio, strength, beginner"></label>
        <button type="submit" class="btn btn-primary btn-block">Schedule Class</button>
      </form>
      <div class="panel">
        <div class="panel-hdr"><div class="panel-ttl">Upcoming Classes</div><span class="panel-tag">Live</span></div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Class</th><th>When</th><th>Booked</th><th></th></tr></thead>
          <tbody id="class-rows"></tbody>
        </table></div>
      </div>
    </div>`,

  init({ el }) {
    watchUpcomingClasses((classes) => {
      $('#class-rows', el).innerHTML = classes.length
        ? classes.map((c) => {
          const full = c.bookedCount >= c.capacity;
          return `<tr><td><strong>${esc(c.title)}</strong><span class="sub">${esc(c.trainer)}</span></td>
            <td>${fmtDateTime(c.startAt)}</td>
            <td><span class="status-badge status-${full ? 'expired' : 'active'}">${c.bookedCount}/${c.capacity}</span></td>
            <td><button class="btn btn-danger btn-sm" data-del="${c.id}">Delete</button></td></tr>`;
        }).join('')
        : '<tr class="empty"><td colspan="4">No upcoming classes.</td></tr>';
    });

    $('#class-rows', el).addEventListener('click', async (ev) => {
      const id = ev.target.dataset.del;
      if (!id || !confirm('Delete this class?')) return;
      try { await deleteClass(id); toast('Class deleted'); } catch (e) { toast(authErrorMessage(e), 'err'); }
    });

    onSubmit($('#class-form', el), async (f) => {
      await createClass({
        title: f.classTitle.value.trim(), trainer: f.trainer.value.trim(), startAt: f.startAt.value,
        durationMin: f.durationMin.value, capacity: f.capacity.value,
        tags: f.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
      });
      f.reset();
    }, 'Class scheduled');
  },
};
