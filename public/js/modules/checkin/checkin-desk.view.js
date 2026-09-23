// Admin · Check-In Desk — generate the one active QR/OTP code (validity editable in
// minutes or hours), watch it count down, check members in by hand, and see who's
// currently inside with a per-person check-out.
import {
  generateCheckinSession, revokeCheckinSession, watchCheckinSession,
  adminCheckIn, checkOut, watchOccupancy,
} from '../checkins/checkins.service.js';
import { watchMembers, membershipStatus } from '../members/members.service.js';
import { $, esc } from '../../shared/dom.js';
import { fmtDateTime, initials } from '../../shared/format.js';
import { renderQR } from '../../shared/qrcode.js';
import { onSubmit } from '../../shared/forms.js';
import { toast } from '../../shared/toast.js';
import { authErrorMessage } from '../../core/auth.js';

export default {
  id: 'checkin-desk',
  title: 'Check-In Desk',
  label: 'Check-In',
  icon: '🚪',
  section: 'Operations',

  template: () => `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-hdr"><div class="panel-ttl">🔐 Active Code</div><span class="panel-tag" id="code-status">–</span></div>
        <form id="gen-form" class="inline-form" onsubmit="return false">
          <label style="flex:1">Valid for
            <div class="form-row">
              <input type="number" name="amount" min="1" value="30" required>
              <select name="unit"><option value="minutes" selected>Minutes</option><option value="hours">Hours</option></select>
            </div>
          </label>
          <button type="submit" class="btn btn-primary">⚡ Generate New Code</button>
        </form>
        <div id="code-display" class="checkin-code-display" hidden>
          <div id="code-qr" class="checkin-qr"></div>
          <div class="checkin-digits" id="code-digits"></div>
          <div class="checkin-countdown" id="code-countdown"></div>
          <button type="button" class="btn btn-danger btn-sm" id="revoke-btn">Revoke now</button>
        </div>
        <p class="muted small" id="code-empty">No active code — generate one so members can self-check-in.</p>
      </div>

      <form id="manual-form" class="panel" onsubmit="return false">
        <div class="panel-hdr"><div class="panel-ttl">✋ Manual Check-In</div></div>
        <p class="muted small">Front-desk override — no code needed.</p>
        <label>Search member <input name="q" placeholder="Name, ID or email" autocomplete="off"></label>
        <div id="manual-results" class="checkin-results"></div>
      </form>
    </div>

    <div class="panel">
      <div class="panel-hdr"><div class="panel-ttl">🏋️ Inside Now</div><span class="panel-tag" id="inside-count">0</span></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Member</th><th>Method</th><th>Since</th><th></th></tr></thead>
        <tbody id="inside-rows"></tbody>
      </table></div>
    </div>`,

  init({ el, user }) {
    let membersByUid = new Map();
    watchMembers((list) => {
      membersByUid = new Map(list.map((m) => [m.uid, m]));
      renderInside();
    });

    // ── Code generation + live countdown ──
    const genForm = $('#gen-form', el);
    let tickTimer;

    watchCheckinSession((session) => {
      clearInterval(tickTimer);
      const display = $('#code-display', el);
      const empty = $('#code-empty', el);
      const statusEl = $('#code-status', el);
      const msLeft = session ? session.expiresAt.toMillis() - Date.now() : -1;

      if (!session || msLeft <= 0) {
        display.hidden = true;
        empty.hidden = false;
        statusEl.textContent = 'Inactive';
        statusEl.className = 'panel-tag';
        return;
      }

      display.hidden = false;
      empty.hidden = true;
      statusEl.textContent = 'Active';
      statusEl.className = 'panel-tag panel-tag-live';
      $('#code-digits', el).textContent = session.code.split('').join(' ');
      renderQR($('#code-qr', el), session.code).catch((e) => toast(e.message, 'err'));

      const paint = () => {
        const left = Math.max(0, session.expiresAt.toMillis() - Date.now());
        const m = Math.floor(left / 60000);
        const s = Math.floor((left % 60000) / 1000);
        $('#code-countdown', el).textContent = left > 0
          ? `Expires in ${m}:${String(s).padStart(2, '0')}`
          : 'Expired';
        if (left <= 0) clearInterval(tickTimer);
      };
      paint();
      tickTimer = setInterval(paint, 1000);
    });

    onSubmit(genForm, async (f) => {
      const amount = Number(f.amount.value);
      const minutes = f.unit.value === 'hours' ? amount * 60 : amount;
      await generateCheckinSession({ validityMinutes: minutes, uid: user.uid });
    }, 'New check-in code is live');

    $('#revoke-btn', el).addEventListener('click', async () => {
      try { await revokeCheckinSession(); toast('Code revoked'); } catch (e) { toast(authErrorMessage(e), 'err'); }
    });

    // ── Manual check-in search ──
    const manualForm = $('#manual-form', el);
    manualForm.q.addEventListener('input', () => {
      const term = manualForm.q.value.trim().toLowerCase();
      const results = $('#manual-results', el);
      if (!term) { results.innerHTML = ''; return; }
      const matches = [...membersByUid.values()]
        .filter((m) => `${m.name} ${m.customId} ${m.email}`.toLowerCase().includes(term))
        .slice(0, 6);
      results.innerHTML = matches.length
        ? matches.map((m) => {
          const s = membershipStatus(m.expiryDate);
          return `<div class="checkin-result">
            <span class="av-sm">${esc(initials(m.name))}</span>
            <div><strong>${esc(m.name)}</strong><span class="sub">${esc(m.customId || m.email)} · <span class="status-badge status-${s.key}">${s.label}</span></span></div>
            <button class="btn btn-primary btn-sm" data-checkin="${m.uid}" ${s.key === 'expired' ? 'disabled title="Membership expired"' : ''}>Check In</button>
          </div>`;
        }).join('')
        : '<p class="muted small">No matches.</p>';
    });

    $('#manual-results', el).addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-checkin]');
      if (!btn) return;
      btn.disabled = true;
      try {
        await adminCheckIn(btn.dataset.checkin, 'manual');
        toast('Checked in');
        manualForm.q.value = '';
        $('#manual-results', el).innerHTML = '';
      } catch (e) { toast(authErrorMessage(e), 'err'); btn.disabled = false; }
    });

    // ── Inside now ──
    let insideDocs = [];
    function renderInside() {
      $('#inside-count', el).textContent = insideDocs.length;
      $('#inside-rows', el).innerHTML = insideDocs.length
        ? insideDocs.map((d) => {
          const data = d.data();
          const m = membersByUid.get(data.uid);
          return `<tr>
            <td data-label="Member">${m ? `<strong>${esc(m.name)}</strong><span class="sub">${esc(m.customId || m.email)}</span>` : `<span class="muted">${esc(data.uid)}</span>`}</td>
            <td data-label="Method"><span class="chip">${esc(data.method || 'qr')}</span></td>
            <td data-label="Since">${data.at ? fmtDateTime(data.at) : '–'}</td>
            <td class="row-actions"><button class="btn btn-ghost btn-sm" data-checkout="${d.id}">Check Out</button></td>
          </tr>`;
        }).join('')
        : '<tr class="empty"><td colspan="4">Nobody checked in right now.</td></tr>';
    }

    watchOccupancy((count, docs) => { insideDocs = docs; renderInside(); });

    $('#inside-rows', el).addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-checkout]');
      if (!btn) return;
      btn.disabled = true;
      try { await checkOut(btn.dataset.checkout); toast('Checked out'); } catch (e) { toast(authErrorMessage(e), 'err'); btn.disabled = false; }
    });
  },
};
