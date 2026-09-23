// Member · Check In — scan the code on admin's screen or type its 6 digits.
// Reachable from the raised scanner button in the mobile nav (see shared/shell.js)
// as well as as a normal tab, so it works the same whether tapped from the FAB or
// the sidebar.
import { selfCheckIn, checkOut, watchMyOpenCheckin } from '../checkins/checkins.service.js';
import { watchMember, membershipStatus } from '../members/members.service.js';
import { mark, watchOwnDay, STATUS } from '../attendance/attendance.service.js';
import { exercisesFor, watchExercises } from '../exercises/exercises.service.js';
import { startScanner } from '../../shared/qrscan.js';
import { $, $$, esc } from '../../shared/dom.js';
import { fmtDateTime, todayStr } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';
import { authErrorMessage } from '../../core/auth.js';

export default {
  id: 'checkin',
  title: 'Check In',
  label: 'Check In',
  icon: '📷',
  section: 'Main',
  fab: true, // shell.js renders this one as the raised center button on the mobile nav

  template: () => `
    <div id="checkin-status" class="panel checkin-active-card" hidden>
      <div class="checkin-active-icon">✅</div>
      <div class="checkin-active-ttl">You're checked in</div>
      <div class="checkin-active-sub" id="checkin-since"></div>

      <div id="today-exercises" class="checkin-today" hidden>
        <div class="checkin-today-hdr">Today's Exercises</div>
        <div class="chip-row" id="today-ex-chips"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="edit-exercises-btn">Edit</button>
      </div>

      <div id="exercise-picker" class="checkin-picker" hidden>
        <div class="checkin-today-hdr">What are you training today?</div>
        <div class="ex-grid" id="checkin-ex-grid"></div>
        <button type="button" class="btn btn-primary btn-block" id="save-exercises-btn" disabled>Save &amp; Start Workout</button>
      </div>

      <button type="button" class="btn btn-danger btn-block" id="checkout-btn">Check Out</button>
    </div>

    <div id="checkin-form-card" hidden>
      <div id="checkin-expired-notice" class="banner banner-expired" hidden>Your membership has expired — renew at the front desk to check in.</div>

      <div class="tab-row">
        <button class="tab-btn active" data-mode="scan">📷 Scan QR</button>
        <button class="tab-btn" data-mode="otp">🔢 Enter Code</button>
      </div>

      <div class="panel" data-mode-panel="scan">
        <p class="muted small">Point your camera at the code shown at the front desk.</p>
        <div class="scan-frame">
          <video id="scan-video" playsinline muted></video>
          <div class="scan-corners"></div>
        </div>
        <p class="checkin-scan-err" id="scan-err"></p>
      </div>

      <div class="panel" data-mode-panel="otp" hidden>
        <p class="muted small">Enter the 6-digit code shown at the front desk.</p>
        <div class="otp-boxes" id="otp-boxes">
          ${Array.from({ length: 6 }).map((_, i) => `<input class="otp-box" inputmode="numeric" pattern="[0-9]" maxlength="1" data-otp="${i}">`).join('')}
        </div>
        <button type="button" class="btn btn-primary btn-block" id="otp-submit" disabled>Check In</button>
      </div>
    </div>`,

  init({ el, user }) {
    let canCheckIn = false;
    let stopScan = null;
    let submitting = false;
    let isOpen = false;
    let member = null;
    let allExercises = [];
    let picking = false; // true while the "Edit" button has forced the picker open

    watchMember(user.uid, (m) => {
      if (!m) return;
      member = m;
      canCheckIn = membershipStatus(m.expiryDate).key !== 'expired';
      $('#checkin-expired-notice', el).hidden = canCheckIn;
      $$('[data-mode-panel] button, .otp-box', el).forEach((n) => { n.disabled = !canCheckIn; });
      renderPicker();
    });

    watchExercises(({ all }) => { allExercises = all; renderPicker(); });

    // ── Post-check-in exercise picker: reuses the same "present needs >=1 exercise"
    // rule the admin attendance card enforces, just filed by the member themselves. ──
    let todaysExercises = [];
    function renderPicker() {
      const rotation = member ? exercisesFor(member.exerciseCategory).filter((x) => x !== 'Rest') : [];
      const extras = allExercises.filter((x) => !rotation.includes(x));
      const chip = (x) => `<label class="ex-chk${todaysExercises.includes(x) ? ' on' : ''}">
        <input type="checkbox" data-pick="${esc(x)}" ${todaysExercises.includes(x) ? 'checked' : ''}>${esc(x)}</label>`;
      $('#checkin-ex-grid', el).innerHTML = `${rotation.map(chip).join('')}
        ${extras.length ? `<details class="ex-more"><summary>+ ${extras.length} more</summary><div class="ex-grid">${extras.map(chip).join('')}</div></details>` : ''}`;

      const done = todaysExercises.length > 0 && !picking;
      $('#today-exercises', el).hidden = !done;
      $('#exercise-picker', el).hidden = done;
      if (done) {
        $('#today-ex-chips', el).innerHTML = todaysExercises.map((x) => `<span class="chip">${esc(x)}</span>`).join('');
      }
    }

    $('#checkin-ex-grid', el).addEventListener('change', (ev) => {
      const box = ev.target.closest('[data-pick]');
      if (!box) return;
      todaysExercises = box.checked
        ? [...new Set([...todaysExercises, box.dataset.pick])]
        : todaysExercises.filter((x) => x !== box.dataset.pick);
      $('#save-exercises-btn', el).disabled = todaysExercises.length === 0;
      box.closest('.ex-chk').classList.toggle('on', box.checked);
    });

    $('#save-exercises-btn', el).addEventListener('click', async () => {
      const btn = $('#save-exercises-btn', el);
      btn.disabled = true;
      try {
        await mark({
          date: todayStr(), uid: user.uid, name: member?.name || user.email,
          kind: 'member', status: STATUS.PRESENT, exercises: todaysExercises,
        });
        picking = false;
        toast('Marked present — have a great workout! 💪');
      } catch (e) {
        toast(authErrorMessage(e) || e.message, 'err');
        btn.disabled = false;
      }
    });

    $('#edit-exercises-btn', el).addEventListener('click', () => { picking = true; renderPicker(); });

    watchOwnDay(user.uid, todayStr(), (mine) => {
      todaysExercises = mine?.exercises || [];
      renderPicker();
    });

    /** @returns {Promise<boolean>} whether the check-in actually succeeded */
    async function doCheckIn(code, method) {
      if (submitting || !canCheckIn) return false;
      submitting = true;
      try {
        await selfCheckIn({ uid: user.uid, code, method });
        toast('Checked in — welcome! 💪');
        return true;
      } catch (e) {
        toast(authErrorMessage(e) || e.message, 'err');
        return false;
      } finally {
        submitting = false;
      }
    }

    // ── Mode tabs (scan / otp) ──
    $$('[data-mode]', el).forEach((btn) => btn.addEventListener('click', () => {
      $$('[data-mode]', el).forEach((b) => b.classList.toggle('active', b === btn));
      $$('[data-mode-panel]', el).forEach((p) => { p.hidden = p.dataset.modePanel !== btn.dataset.mode; });
      syncCamera();
    }));

    function startCamera() {
      if (stopScan) return; // already running
      const video = $('#scan-video', el);
      const errEl = $('#scan-err', el);
      errEl.textContent = '';
      startScanner(video, async (text) => {
        stopCamera(); // pause while the check-in call is in flight, so we don't decode twice
        const ok = await doCheckIn(text.trim(), 'qr');
        // A misread or a stale/expired code shouldn't strand the member on a dead
        // video with no obvious way to try again — resume scanning automatically.
        if (!ok) syncCamera();
      }, (e) => { errEl.textContent = e.message; }).then((stop) => { stopScan = stop; });
    }
    function stopCamera() { stopScan?.(); stopScan = null; }

    // Single source of truth for whether the camera should be running: only while
    // this panel is the visible tab, the member isn't already checked in, and
    // "Scan QR" (not "Enter Code") is the active mode. Called from every place any
    // of those three things can change, instead of duplicating the condition.
    function syncCamera() {
      const scanModeActive = $('[data-mode="scan"]', el)?.classList.contains('active');
      if (!el.hidden && !isOpen && scanModeActive) startCamera();
      else stopCamera();
    }
    new MutationObserver(syncCamera).observe(el, { attributes: true, attributeFilter: ['hidden'] });

    // ── OTP boxes ──
    const boxes = $$('.otp-box', el);
    const otpValue = () => boxes.map((b) => b.value).join('');
    const otpBtn = $('#otp-submit', el);
    boxes.forEach((box, i) => {
      box.addEventListener('input', () => {
        box.value = box.value.replace(/\D/g, '').slice(0, 1);
        if (box.value && boxes[i + 1]) boxes[i + 1].focus();
        otpBtn.disabled = otpValue().length !== 6;
      });
      box.addEventListener('keydown', (ev) => {
        if (ev.key === 'Backspace' && !box.value && boxes[i - 1]) boxes[i - 1].focus();
      });
      box.addEventListener('paste', (ev) => {
        const digits = (ev.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6).split('');
        if (!digits.length) return;
        ev.preventDefault();
        digits.forEach((d, idx) => { if (boxes[idx]) boxes[idx].value = d; });
        (boxes[digits.length] || boxes[5]).focus();
        otpBtn.disabled = otpValue().length !== 6;
      });
    });
    otpBtn.addEventListener('click', async () => {
      await doCheckIn(otpValue(), 'otp');
      boxes.forEach((b) => { b.value = ''; });
      otpBtn.disabled = true;
      boxes[0].focus();
    });

    // ── Already checked in? show the status card instead of the form ──
    let checkinId = null;
    watchMyOpenCheckin(user.uid, (open) => {
      isOpen = !!open;
      checkinId = open?.id || null;
      $('#checkin-status', el).hidden = !open;
      $('#checkin-form-card', el).hidden = !!open;
      if (open) $('#checkin-since', el).textContent = open.at ? `Since ${fmtDateTime(open.at)}` : '';
      syncCamera();
    });

    $('#checkout-btn', el).addEventListener('click', async (ev) => {
      if (!checkinId) return;
      ev.target.disabled = true;
      try { await checkOut(checkinId); toast('Checked out — see you next time!'); }
      catch (e) { toast(authErrorMessage(e), 'err'); ev.target.disabled = false; }
    });
  },
};
