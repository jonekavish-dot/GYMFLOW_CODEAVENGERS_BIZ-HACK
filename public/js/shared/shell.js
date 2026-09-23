// Builds the portal chrome (sidebar, topbar, pages, mobile nav) from a list of feature
// modules, then initialises each module inside its own page section.
//
// A module is: { id, title, icon, label, section, template(), init(ctx) }
//   ctx = { el, user, profile, shell }   (el = the module's <section>)
import { $, $$, esc } from './dom.js';
import { fmtLongNow, initials } from './format.js';
import { APP } from '../config/app.config.js';
import { signOut } from '../core/auth.js';
import { onInstallState, promptInstall } from '../core/pwa.js';

// Corner-brackets + barcode glyph for the raised mobile-nav scanner button — drawn as
// inline SVG rather than trusting an emoji glyph to render the same way across devices.
const SCAN_ICON = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2"/>
  <path d="M8 9v6M11 9v6M14 9v6M17 9v6" stroke-width="1.6"/>
</svg>`;

export function mountShell({ root = $('#app'), roleLabel, subtitle, user, profile, modules }) {
  const name = profile.name || profile.email;
  const sections = [...new Set(modules.map((m) => m.section))];
  const navBtn = (m, cls) => `<button class="${cls}" data-tab="${m.id}" data-title="${esc(m.title)}">`;
  // One module may opt into being the raised center button on the mobile bottom nav
  // (see modules/checkin/checkin.view.js) instead of sitting in the scrollable row.
  const fabModule = modules.find((m) => m.fab);
  const rowModules = modules.filter((m) => !m.fab);

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
          <button id="install-app" class="btn btn-ghost btn-sm" hidden>⬇ Install</button>
          <button id="logout" class="btn btn-danger btn-sm">🔓 Logout</button>
        </div>
      </header>
      ${modules.map((m) => `<section class="page" data-panel="${m.id}" hidden>${m.template()}</section>`).join('')}
      <footer class="footer-bar"><span>${esc(APP.name)} · ${esc(APP.tagline)}</span><span>Synced live via <span class="hl">Firebase</span></span></footer>
    </div>
  </div>
  <nav class="mobile-nav">
    <div class="mob-nav-grid">
      ${rowModules.map((m) => `${navBtn(m, 'mob-nav-btn')}<span class="mob-icon">${m.icon}</span><span class="mob-label">${esc(m.label)}</span></button>`).join('')}
    </div>
    ${fabModule ? `${navBtn(fabModule, 'mob-nav-fab')}${SCAN_ICON}</button>` : ''}
  </nav>`;

  document.title = `${APP.name} — ${roleLabel}`;
  $('#logout').addEventListener('click', signOut);

  const installBtn = $('#install-app');
  onInstallState(({ canInstall }) => { installBtn.hidden = !canInstall; });
  installBtn.addEventListener('click', promptInstall);

  const tick = () => { $('#dateline').textContent = fmtLongNow(); };
  tick();
  setInterval(tick, 30000);

  const show = (id) => {
    const m = modules.find((x) => x.id === id);
    $$('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== id; });
    $('#page-title').textContent = m.title;
    // The mobile nav scrolls sideways once there are more tabs than fit; keep the
    // active one visible so the current page is never off-screen.
    $(`.mob-nav-btn[data-tab="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
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
