// Admin · Trainers — staff roster with specialities, ported from the old portal's
// trainers page (including the owner flag and skill chips).
import { createTrainer, updateTrainer, deleteTrainer, watchTrainers } from './trainers.service.js';
import { $, esc } from '../../shared/dom.js';
import { initials } from '../../shared/format.js';
import { onSubmit } from '../../shared/forms.js';
import { openModal, confirmAction } from '../../shared/modal.js';
import { toast } from '../../shared/toast.js';

export default {
  id: 'trainers',
  title: 'Trainers',
  label: 'Trainers',
  icon: '🧑‍🏫',
  section: 'Operations',

  template: () => `
    <div class="grid-2">
      <form id="trainer-form" class="panel" onsubmit="return false">
        <div class="panel-hdr"><div class="panel-ttl">+ Add Trainer</div></div>
        <label>Name <input name="trainerName" required></label>
        <label>Speciality <input name="role" required placeholder="Strength & Conditioning"></label>
        <div class="form-row">
          <label>Experience (yrs) <input type="number" name="exp" min="0" value="1"></label>
          <label>Phone <input type="tel" name="phone"></label>
        </div>
        <label>Title <input name="title" placeholder="e.g. Mr. Tamil Nadu"></label>
        <label>Skills <input name="skills" placeholder="Comma separated"></label>
        <label class="check-line"><input type="checkbox" name="isOwner"> Gym owner</label>
        <button type="submit" class="btn btn-primary btn-block">Add Trainer</button>
      </form>
      <div class="panel">
        <div class="panel-hdr"><div class="panel-ttl">Team</div></div>
        <div id="trainer-cards" class="trainer-grid"></div>
      </div>
    </div>`,

  init({ el }) {
    let trainers = [];

    watchTrainers((list) => {
      trainers = list;
      $('#trainer-cards', el).innerHTML = list.length
        ? list.map((t) => `<div class="trainer-card">
            <div class="tc-top"><span class="av-sm">${esc(initials(t.name))}</span>
              <div><strong>${esc(t.name)}</strong>
                <div class="muted small">${esc(t.role || '')}${t.exp ? ` · ${t.exp} yr${t.exp > 1 ? 's' : ''}` : ''}</div></div>
              ${t.isOwner ? '<span class="status-badge status-active">Owner</span>' : ''}</div>
            ${t.title ? `<div class="tc-title">🥇 ${esc(t.title)}</div>` : ''}
            ${(t.skills || []).length ? `<div class="chip-row">${t.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>` : ''}
            ${t.phone ? `<div class="muted small">📞 ${esc(t.phone)}</div>` : ''}
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" data-edit="${t.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-del="${t.id}">Remove</button>
            </div>
          </div>`).join('')
        : '<p class="muted">No trainers yet.</p>';
    });

    onSubmit($('#trainer-form', el), async (f) => {
      await createTrainer({
        name: f.trainerName.value.trim(),
        role: f.role.value.trim(),
        exp: f.exp.value,
        phone: f.phone.value.trim(),
        title: f.title.value.trim(),
        skills: f.skills.value.split(',').map((s) => s.trim()).filter(Boolean),
        isOwner: f.isOwner.checked,
      });
      f.reset();
      f.exp.value = 1;
    }, 'Trainer added');

    $('#trainer-cards', el).addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-edit],[data-del]');
      if (!btn) return;
      const trainer = trainers.find((t) => t.id === (btn.dataset.edit || btn.dataset.del));
      if (!trainer) return;

      if (btn.dataset.del) {
        const ok = await confirmAction({
          title: `Remove ${trainer.name}?`,
          message: 'They disappear from the roster and attendance roll call.',
          confirmLabel: 'Remove trainer',
        });
        if (ok) { await deleteTrainer(trainer.id); toast(`${trainer.name} removed`); }
        return;
      }

      const { el: modal, close } = openModal({
        title: `Edit · ${trainer.name}`,
        body: `<form id="tr-edit" onsubmit="return false">
          <label>Name <input name="trainerName" value="${esc(trainer.name)}" required></label>
          <label>Speciality <input name="role" value="${esc(trainer.role || '')}"></label>
          <div class="form-row">
            <label>Experience (yrs) <input type="number" name="exp" min="0" value="${trainer.exp || 0}"></label>
            <label>Phone <input type="tel" name="phone" value="${esc(trainer.phone || '')}"></label>
          </div>
          <label>Title <input name="title" value="${esc(trainer.title || '')}"></label>
          <label>Skills <input name="skills" value="${esc((trainer.skills || []).join(', '))}"></label>
          <label class="check-line"><input type="checkbox" name="isOwner" ${trainer.isOwner ? 'checked' : ''}> Gym owner</label>
          <button type="submit" class="btn btn-primary btn-block">Save</button>
        </form>`,
      });

      onSubmit($('#tr-edit', modal), async (f) => {
        await updateTrainer(trainer.id, {
          name: f.trainerName.value.trim(),
          role: f.role.value.trim(),
          exp: Number(f.exp.value) || 0,
          phone: f.phone.value.trim(),
          title: f.title.value.trim(),
          skills: f.skills.value.split(',').map((s) => s.trim()).filter(Boolean),
          isOwner: f.isOwner.checked,
        });
        close();
      }, 'Trainer updated');
    });
  },
};
