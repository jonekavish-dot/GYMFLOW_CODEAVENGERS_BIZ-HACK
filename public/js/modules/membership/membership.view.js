// Member · My Membership — validity, expiry alert banner and goals (used for AI recommendations).
import { watchMember, updateGoals, membershipStatus } from '../members/members.service.js';
import { watchMyBookings } from '../bookings/bookings.service.js';
import { $ } from '../../shared/dom.js';
import { fmtDate } from '../../shared/format.js';
import { onSubmit } from '../../shared/forms.js';

export default {
  id: 'home',
  title: 'My Membership',
  label: 'Membership',
  icon: '🪪',
  section: 'Main',

  template: () => `
    <div id="expiry-banner" class="banner" hidden></div>
    <div class="sec-title">Membership</div>
    <div class="kpi-grid">
      <div class="kpi-card" style="--card-accent:#39e56a"><div class="kpi-lbl">📆 Days Left</div><div class="kpi-val" id="kpi-days">–</div><div class="kpi-sub" id="kpi-days-sub">&nbsp;</div></div>
      <div class="kpi-card" style="--card-accent:#4da6ff"><div class="kpi-lbl">🎟️ Classes Booked</div><div class="kpi-val" id="kpi-booked">–</div><div class="kpi-sub">Upcoming</div></div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-hdr"><div class="panel-ttl">🪪 My Membership</div><span id="status-pill" class="status-badge">–</span></div>
        <dl class="facts">
          <dt>Plan</dt><dd id="m-plan">–</dd>
          <dt>Started</dt><dd id="m-start">–</dd>
          <dt>Valid until</dt><dd id="m-expiry">–</dd>
        </dl>
      </div>
      <form id="goals-form" class="panel" onsubmit="return false">
        <div class="panel-hdr"><div class="panel-ttl">🎯 My Goals</div><span class="panel-tag">AI</span></div>
        <label>What do you want to achieve? <textarea name="goals" rows="3" placeholder="e.g. lose 5 kg, build stamina"></textarea></label>
        <button type="submit" class="btn btn-primary btn-block">Save Goals</button>
      </form>
    </div>`,

  init({ el, user, shell }) {
    const goalsForm = $('#goals-form', el);
    let goalsLoaded = false;

    watchMember(user.uid, (m) => {
      if (!m) return;
      const s = membershipStatus(m.expiryDate);
      const pill = $('#status-pill', el);
      pill.className = `status-badge status-${s.key}`;
      pill.textContent = s.label;
      $('#kpi-days', el).textContent = Math.max(0, s.days);
      $('#kpi-days-sub', el).textContent = s.key === 'expired' ? 'Expired — renew to book' : `Until ${fmtDate(m.expiryDate)}`;
      $('#m-plan', el).textContent = m.planName;
      $('#m-start', el).textContent = fmtDate(m.startDate);
      $('#m-expiry', el).textContent = fmtDate(m.expiryDate);
      shell.setOwnerBadges([m.planName]);

      const banner = $('#expiry-banner', el);
      banner.hidden = s.key === 'active';
      banner.className = `banner banner-${s.key}`;
      banner.textContent = s.key === 'expired'
        ? 'Your membership has expired — renew it to book classes.'
        : `Heads up: your membership ends in ${s.days} day${s.days === 1 ? '' : 's'}. Renew to keep booking.`;

      if (!goalsLoaded) { goalsForm.goals.value = m.goals || ''; goalsLoaded = true; }
    });

    watchMyBookings(user.uid, (list) => { $('#kpi-booked', el).textContent = list.length; });

    onSubmit(goalsForm, (f) => updateGoals(user.uid, f.goals.value.trim()), 'Goals saved');
  },
};
