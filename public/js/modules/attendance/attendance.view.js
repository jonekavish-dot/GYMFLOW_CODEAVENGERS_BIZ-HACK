// Admin · Attendance — daily roll call for members and trainers.
// Ports the old portal's exercise-checkbox card: each member shows their category's
// rotation plus any custom exercises, and Present stays disabled until one is ticked.
import { mark, setExercises, clearMark, watchDay, STATUS } from './attendance.service.js';
import { watchMembers, membershipStatus } from '../members/members.service.js';
import { watchTrainers } from '../trainers/trainers.service.js';
import { watchExercises, exercisesFor } from '../exercises/exercises.service.js';
import { $, $$, esc } from '../../shared/dom.js';
import { initials, todayStr } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';

export default {
  id: 'attendance',
  title: 'Attendance',
  label: 'Attendance',
  icon: '✅',
  section: 'Main',

  template: () => `
    <div class="panel">
      <div class="panel-hdr">
        <div class="panel-ttl">Roll Call</div>
        <div class="att-controls">
          <input type="date" id="att-date" class="search-input">
          <input type="search" id="att-search" class="search-input" placeholder="Search…">
        </div>
      </div>
      <div class="tab-row">
        <button class="tab-btn active" data-att-tab="members">👥 Members</button>
        <button class="tab-btn" data-att-tab="trainers">🧑‍🏫 Trainers</button>
      </div>
      <div class="att-stats" id="att-stats"></div>
      <div id="att-list" class="att-list"></div>
    </div>`,

  init({ el }) {
    const dateEl = $('#att-date', el);
    const searchEl = $('#att-search', el);
    dateEl.value = todayStr();

    let tab = 'members';
    let members = [];
    let trainers = [];
    let marks = {};
    let allExercises = [];
    let unsubDay = null;

    watchMembers((list) => { members = list; draw(); });
    watchTrainers((list) => { trainers = list; draw(); });
    watchExercises(({ all }) => { allExercises = all; draw(); });

    const subscribeDay = () => {
      unsubDay?.();
      unsubDay = watchDay(dateEl.value, (byUid) => { marks = byUid; draw(); });
    };
    subscribeDay();

    dateEl.addEventListener('change', subscribeDay);
    searchEl.addEventListener('input', draw);
    $$('[data-att-tab]', el).forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.attTab;
      $$('[data-att-tab]', el).forEach((x) => x.classList.toggle('active', x === b));
      draw();
    }));

    function people() {
      const term = searchEl.value.trim().toLowerCase();
      const rows = tab === 'members'
        ? members.map((m) => ({
          uid: m.uid, name: m.name, kind: 'member',
          sub: `${m.customId || m.email} · Cat ${m.exerciseCategory || 'A'}`,
          category: m.exerciseCategory || 'A',
          expired: membershipStatus(m.expiryDate).key === 'expired',
        }))
        : trainers.map((t) => ({
          uid: t.id, name: t.name, kind: 'trainer', sub: t.role || 'Trainer', category: null, expired: false,
        }));
      return term ? rows.filter((p) => `${p.name} ${p.sub}`.toLowerCase().includes(term)) : rows;
    }

    function draw() {
      const rows = people();
      const present = rows.filter((p) => marks[p.uid]?.status === STATUS.PRESENT).length;
      const absent = rows.filter((p) => marks[p.uid]?.status === STATUS.ABSENT).length;
      $('#att-stats', el).innerHTML = `
        <span class="att-stat"><strong>${rows.length}</strong> on roll</span>
        <span class="att-stat ok"><strong>${present}</strong> present</span>
        <span class="att-stat bad"><strong>${absent}</strong> absent</span>
        <span class="att-stat"><strong>${rows.length - present - absent}</strong> unmarked</span>`;

      if (!rows.length) {
        $('#att-list', el).innerHTML = `<p class="muted">No ${tab} to show.</p>`;
        return;
      }

      $('#att-list', el).innerHTML = rows.map((p) => {
        const rec = marks[p.uid];
        const ticked = rec?.exercises || [];
        const status = rec?.status || '';
        // Category rotation first (the member's own plan), then any extra exercises.
        const rotation = p.kind === 'member' ? exercisesFor(p.category).filter((x) => x !== 'Rest') : [];
        const extras = allExercises.filter((x) => !rotation.includes(x));
        const box = (x) => `<label class="ex-chk${ticked.includes(x) ? ' on' : ''}">
          <input type="checkbox" data-ex="${esc(x)}" data-uid="${p.uid}" ${ticked.includes(x) ? 'checked' : ''}>${esc(x)}</label>`;

        return `<div class="att-card${status ? ` marked-${status}` : ''}" data-card="${p.uid}">
          <div class="att-who">
            <span class="av-sm">${esc(initials(p.name))}</span>
            <div><strong>${esc(p.name)}</strong><div class="muted small">${esc(p.sub)}</div></div>
            ${p.expired ? '<span class="status-badge status-expired">Expired</span>' : ''}
            ${status ? `<span class="status-badge status-${status === STATUS.PRESENT ? 'active' : 'muted'}">${status}</span>` : ''}
          </div>
          ${p.kind === 'member' ? `<div class="ex-grid">
            ${rotation.map(box).join('')}
            ${extras.length ? `<details class="ex-more"><summary>+ ${extras.length} more</summary><div class="ex-grid">${extras.map(box).join('')}</div></details>` : ''}
          </div>` : ''}
          <div class="att-actions">
            <button class="btn btn-primary btn-sm" data-present="${p.uid}"
              ${p.kind === 'member' && ticked.length === 0 ? 'disabled title="Tick at least one exercise"' : ''}>Present</button>
            <button class="btn btn-ghost btn-sm" data-absent="${p.uid}">Absent</button>
            ${status ? `<button class="btn btn-ghost btn-sm" data-clear="${p.uid}">Undo</button>` : ''}
          </div>
        </div>`;
      }).join('');
    }

    const findPerson = (uid) => people().find((p) => p.uid === uid);

    $('#att-list', el).addEventListener('change', async (ev) => {
      const box = ev.target.closest('[data-ex]');
      if (!box) return;
      const p = findPerson(box.dataset.uid);
      if (!p) return;
      const current = marks[p.uid]?.exercises || [];
      const next = box.checked
        ? [...new Set([...current, box.dataset.ex])]
        : current.filter((x) => x !== box.dataset.ex);
      try {
        await setExercises({
          date: dateEl.value, uid: p.uid, name: p.name, kind: p.kind,
          exercises: next, status: marks[p.uid]?.status || '',
        });
      } catch (e) { toast(e.message, 'err'); }
    });

    $('#att-list', el).addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-present],[data-absent],[data-clear]');
      if (!btn) return;
      const uid = btn.dataset.present || btn.dataset.absent || btn.dataset.clear;
      const p = findPerson(uid);
      if (!p) return;
      try {
        if (btn.dataset.clear) {
          await clearMark(dateEl.value, uid);
          return;
        }
        await mark({
          date: dateEl.value, uid, name: p.name, kind: p.kind,
          status: btn.dataset.present ? STATUS.PRESENT : STATUS.ABSENT,
          exercises: marks[uid]?.exercises || [],
        });
        toast(`${p.name} marked ${btn.dataset.present ? 'present' : 'absent'}`);
      } catch (e) { toast(e.message, 'err'); }
    });
  },
};
