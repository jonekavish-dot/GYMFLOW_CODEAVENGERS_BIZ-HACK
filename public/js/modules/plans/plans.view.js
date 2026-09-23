// Admin · Plans — create membership plans.
import { createPlan, watchPlans } from './plans.service.js';
import { $, esc } from '../../shared/dom.js';
import { onSubmit } from '../../shared/forms.js';

export default {
  id: 'plans',
  title: 'Membership Plans',
  label: 'Plans',
  icon: '💳',
  section: 'Operations',

  template: () => `
    <div class="grid-2">
      <form id="plan-form" class="panel" onsubmit="return false">
        <div class="panel-hdr"><div class="panel-ttl">+ New Plan</div></div>
        <label>Name <input name="planName" required placeholder="Monthly"></label>
        <div class="form-row">
          <label>Duration (days) <input type="number" name="durationDays" min="1" required value="30"></label>
          <label>Price (₹) <input type="number" name="price" min="0" required></label>
        </div>
        <label>Description <input name="description"></label>
        <button type="submit" class="btn btn-primary btn-block">Create Plan</button>
      </form>
      <div class="panel">
        <div class="panel-hdr"><div class="panel-ttl">Plans</div></div>
        <ul id="plan-list" class="list"></ul>
      </div>
    </div>`,

  init({ el }) {
    watchPlans((list) => {
      $('#plan-list', el).innerHTML = list.length
        ? list.map((p) => `<li><span class="plan-tag">${esc(p.name)}</span> <strong>₹${p.price}</strong> <span class="muted">· ${p.durationDays} days</span>
            ${p.active ? '' : '<span class="status-badge status-muted">Inactive</span>'}
            ${p.description ? `<span class="muted small" style="flex-basis:100%">${esc(p.description)}</span>` : ''}</li>`).join('')
        : '<li class="muted">No plans yet — members need a plan.</li>';
    });

    onSubmit($('#plan-form', el), async (f) => {
      await createPlan({ name: f.planName.value.trim(), durationDays: f.durationDays.value, price: f.price.value, description: f.description.value.trim() });
      f.reset();
    }, 'Plan created');
  },
};
