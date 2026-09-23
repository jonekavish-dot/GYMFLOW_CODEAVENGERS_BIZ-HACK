export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(msg, kind = 'ok') {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.append(box); }
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.remove(), 3500);
}

export function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Tab switching: sidebar and mobile-nav [data-tab] buttons → [data-panel] pages; updates the topbar title. */
export function initTabs(onChange) {
  $$('[data-tab]').forEach((btn) => btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    $$('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    if (btn.dataset.title) $('#page-title').textContent = btn.dataset.title;
    window.scrollTo(0, 0);
    onChange?.(tab);
  }));
}

export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

/** Fills the portal chrome (sidebar card, topbar tag, dateline) and wires tabs. */
export function initShell(profile) {
  const name = profile.name || profile.email;
  $('#who').textContent = name;
  $('#tb-name').textContent = name;
  $('#ow-av').textContent = initials(name);
  $('#tb-av').textContent = initials(name);
  const tick = () => {
    $('#dateline').textContent = new Date().toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  tick();
  setInterval(tick, 30000);
  initTabs();
  document.body.hidden = false;
}

/** Disables a form's submit button while `fn` runs. */
export async function busy(form, fn) {
  const btn = form.querySelector('[type=submit]');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Working…';
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = label; }
}
