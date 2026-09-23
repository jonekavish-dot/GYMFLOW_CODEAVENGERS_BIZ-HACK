// Builds the portal chrome (sidebar, topbar, pages, mobile nav) from a list of feature
// modules, then initialises each module inside its own page section.
//
// A module is: { id, title, icon, label, section, template(), init(ctx) }
//   ctx = { el, user, profile, shell }   (el = the module's <section>)
import { $, $$, esc } from './dom.js';
import { fmtLongNow, initials } from './format.js';
import { APP } from '../config/app.config.js';
import { signOut } from '../core/auth.js';

export function mountShell({ root = $('#app'), roleLabel, subtitle, user, profile, modules }) {
  const name = profile.name || profile.email;
  const sections = [...new Set(modules.map((m) => m.section))];
  const navBtn = (m, cls) => `<button class="${cls}" data-tab="${m.id}" data-title="${esc(m.title)}">`;

  root.innerHTML = `
  <div class="app">
    <aside class="sidebar">
      <div class="sb-logo"><div class="brand">${esc(APP.name)}</div><div class="sub">${esc(subtitle)}</div></div>
      <nav class="sb-nav">
        ${sections.map((sec) => `<div class="nav-sec">${esc(sec)}</div>
          ${modules.filter((m) => m.section === sec).map((m) => `${navBtn(m, 'nav-item')}<span class="ni">${m.icon}</span>${esc(m.label)}<span class="nav-badge" data-badge="${m.id}" hidden></span></button>`).join('')}`).join('')}
      </nav>
      <div class="owner-card">
        <div class="ow-av">${esc(initials(name))}</div>
        <div class="ow-name" id="who">${esc(name)}</div>
        <div class="ow-title">${esc(roleLabel)}</div>
        <div class="ow-badges" id="ow-badges"><span class="ow-badge">${esc(roleLabel)}</span></div>
      </div>
      <div class="sb-foot">${esc(APP.event)}</div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="tb-left"><h2 id="page-title"></h2><div class="dateline" id="dateline"></div></div>
        <div class="tb-right">
          <span class="live-badge"><span class="live-dot"></span>Live</span>
          <span class="user-tag"><span class="av">${esc(initials(name))}</span><span class="who-txt"><span class="nm">${esc(name)}</span><span class="rl">${esc(roleLabel)}</span></span></span>
          <button id="logout" class="btn btn-danger btn-sm">🔓 Logout</button>
        </div>
      </header>
      ${modules.map((m) => `<section class="page" data-panel="${m.id}" hidden>${m.template()}</section>`).join('')}
      <footer class="footer-bar"><span>${esc(APP.name)} · ${esc(APP.tagline)}</span><span>Synced live via <span class="hl">Firebase</span></span></footer>
    </div>
  </div>
  <nav class="mobile-nav"><div class="mob-nav-grid">
    ${modules.map((m) => `${navBtn(m, 'mob-nav-btn')}<span class="mob-icon">${m.icon}</span><span class="mob-label">${esc(m.label)}</span></button>`).join('')}
  </div></nav>`;

  document.title = `${APP.name} — ${roleLabel}`;
  $('#logout').addEventListener('click', signOut);
  const tick = () => { $('#dateline').textContent = fmtLongNow(); };
  tick();
  setInterval(tick, 30000);

  const show = (id) => {
    const m = modules.find((x) => x.id === id);
    $$('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== id; });
    $('#page-title').textContent = m.title;
  };
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => { show(b.dataset.tab); window.scrollTo(0, 0); }));

  const shell = {
    show,
    /** Red counter next to a module's nav item; 0 hides it. */
    setBadge(id, n) { $$(`[data-badge="${id}"]`).forEach((el) => { el.hidden = !n; el.textContent = n; }); },
    /** Replaces the chips under the user's name in the sidebar card. */
    setOwnerBadges(labels) { $('#ow-badges').innerHTML = labels.map((l) => `<span class="ow-badge">${esc(l)}</span>`).join(''); },
  };

  show(modules[0].id);
  for (const m of modules) m.init({ el: $(`[data-panel="${m.id}"]`), user, profile, shell });
  document.body.hidden = false;
  return shell;
}
