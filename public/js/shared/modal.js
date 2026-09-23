// Dialog helpers. Replaces the old portal's hand-rolled show/hide modal pairs.
import { $, esc } from './dom.js';

let host;
function hostEl() {
  if (!host) {
    host = document.createElement('div');
    host.className = 'modal-host';
    document.body.append(host);
  }
  return host;
}

/**
 * Opens a modal. Returns { el, close } — `el` is the modal body for wiring.
 * Closes on backdrop click, the × button, and Escape.
 */
export function openModal({ title, body, footer = '', wide = false, onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-back open';
  wrap.innerHTML = `
    <div class="modal${wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-hdr"><div class="modal-ttl">${esc(title)}</div>
        <button class="modal-x" data-close aria-label="Close">✕</button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  hostEl().append(wrap);

  const close = () => {
    if (!wrap.isConnected) return;
    wrap.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (ev) => { if (ev.key === 'Escape') close(); };

  wrap.addEventListener('click', (ev) => {
    if (ev.target === wrap || ev.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  $('.modal-body input, .modal-body select, .modal-body textarea', wrap)?.focus();

  return { el: wrap, close };
}

/** Destructive-action confirm. Resolves true only if the user confirms. */
export function confirmAction({ title = 'Are you sure?', message, confirmLabel = 'Delete' }) {
  return new Promise((resolve) => {
    let done = false;
    const settle = (v) => { if (!done) { done = true; resolve(v); } };
    const { el, close } = openModal({
      title,
      body: `<p class="confirm-msg">${esc(message)}</p>`,
      footer: `<button class="btn btn-ghost" data-close>Cancel</button>
               <button class="btn btn-danger" data-confirm>${esc(confirmLabel)}</button>`,
      onClose: () => settle(false),
    });
    $('[data-confirm]', el).addEventListener('click', () => { settle(true); close(); });
  });
}
