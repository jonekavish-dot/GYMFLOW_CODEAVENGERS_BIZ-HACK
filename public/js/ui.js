export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  document.body.append(el);
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

/** Tab switching for [data-tab] buttons → [data-panel] sections. */
export function initTabs(onChange) {
  $$('[data-tab]').forEach((btn) => btn.addEventListener('click', () => {
    $$('[data-tab]').forEach((b) => b.classList.toggle('active', b === btn));
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== btn.dataset.tab; });
    onChange?.(btn.dataset.tab);
  }));
}

/** Disables a form's submit button while `fn` runs. */
export async function busy(form, fn) {
  const btn = form.querySelector('[type=submit]');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Working…';
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = label; }
}
