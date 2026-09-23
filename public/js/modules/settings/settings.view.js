// Admin · Settings — gym profile, theme and the custom exercise list.
// Replaces the old portal's settings page; the Firebase config panel is gone because
// config now ships in js/config/firebase.config.js instead of being pasted at runtime.
import { watchGym, saveGym, getTheme, applyTheme } from './settings.service.js';
import { watchExercises, addCustomExercise, removeCustomExercise, DEFAULT_EXERCISES, CATEGORIES } from '../exercises/exercises.service.js';
import { $, $$, esc } from '../../shared/dom.js';
import { onSubmit } from '../../shared/forms.js';
import { confirmAction } from '../../shared/modal.js';
import { toast } from '../../shared/toast.js';

export default {
  id: 'settings',
  title: 'Settings',
  label: 'Settings',
  icon: '⚙️',
  section: 'System',

  template: () => `
    <div class="grid-2">
      <form id="gym-form" class="panel" onsubmit="return false">
        <div class="panel-hdr"><div class="panel-ttl">🏋️ Gym Profile</div></div>
        <label>Gym Name <input name="gymName" placeholder="A.S. Fitness"></label>
        <label>Owner <input name="owner"></label>
        <div class="form-row">
          <label>Phone <input type="tel" name="phone"></label>
          <label>Email <input type="email" name="gymEmail"></label>
        </div>
        <label>Address <textarea name="address" rows="2"></textarea></label>
        <button type="submit" class="btn btn-primary btn-block">Save Profile</button>
        <p class="muted small">Used on printed receipts.</p>
      </form>

      <div class="panel">
        <div class="panel-hdr"><div class="panel-ttl">🎨 Appearance</div></div>
        <div class="theme-row" id="theme-row">
          <button class="btn btn-ghost" data-theme="dark">🌙 Dark</button>
          <button class="btn btn-ghost" data-theme="light">☀️ Light</button>
        </div>

        <div class="panel-hdr" style="margin-top:18px"><div class="panel-ttl">💪 Exercises</div></div>
        <form id="ex-form" class="inline-form" onsubmit="return false">
          <input name="exName" placeholder="Add a custom exercise" required>
          <button type="submit" class="btn btn-primary btn-sm">Add</button>
        </form>
        <p class="muted small">Built-ins come from categories A–F. Custom ones appear for every member.</p>
        <div id="ex-chips" class="chip-row"></div>

        <div class="panel-hdr" style="margin-top:18px"><div class="panel-ttl">📋 Category Rotations</div></div>
        <div class="cat-list">
          ${Object.entries(CATEGORIES).map(([k, list]) => `<details class="cat-block">
            <summary>Category ${k} <span class="muted small">· ${list.length} days</span></summary>
            <ol class="rotation">${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
          </details>`).join('')}
        </div>
      </div>
    </div>`,

  init({ el }) {
    const form = $('#gym-form', el);
    let loaded = false;

    watchGym((g) => {
      if (loaded) return; // don't clobber what the admin is typing
      loaded = true;
      form.gymName.value = g.name || '';
      form.owner.value = g.owner || '';
      form.phone.value = g.phone || '';
      form.gymEmail.value = g.email || '';
      form.address.value = g.address || '';
    });

    onSubmit(form, (f) => saveGym({
      name: f.gymName.value.trim(),
      owner: f.owner.value.trim(),
      phone: f.phone.value.trim(),
      email: f.gymEmail.value.trim(),
      address: f.address.value.trim(),
    }), 'Gym profile saved');

    const paintTheme = () => {
      const current = getTheme();
      $$('[data-theme]', el).forEach((b) => b.classList.toggle('active', b.dataset.theme === current));
    };
    $('#theme-row', el).addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-theme]');
      if (!btn) return;
      applyTheme(btn.dataset.theme);
      paintTheme();
    });
    paintTheme();

    let custom = [];
    watchExercises(({ custom: list }) => {
      custom = list;
      $('#ex-chips', el).innerHTML = [
        ...DEFAULT_EXERCISES.map((x) => `<span class="chip">${esc(x)}</span>`),
        ...list.map((x) => `<span class="chip chip-custom">${esc(x)}<button data-rm="${esc(x)}" aria-label="Remove">✕</button></span>`),
      ].join('');
    });

    onSubmit($('#ex-form', el), async (f) => {
      const name = f.exName.value.trim();
      if (DEFAULT_EXERCISES.includes(name) || custom.includes(name)) throw new Error(`"${name}" already exists.`);
      await addCustomExercise(name);
      f.reset();
    }, 'Exercise added');

    $('#ex-chips', el).addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-rm]');
      if (!btn) return;
      const name = btn.dataset.rm;
      const ok = await confirmAction({
        title: `Remove "${name}"?`,
        message: 'It disappears from the attendance grid. Past attendance records keep it.',
        confirmLabel: 'Remove',
      });
      if (ok) { await removeCustomExercise(name); toast(`"${name}" removed`); }
    });
  },
};
