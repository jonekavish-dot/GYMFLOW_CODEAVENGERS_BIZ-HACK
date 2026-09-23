import { $ } from './dom.js';

/** Stacked, auto-dismissing notification. kind: 'ok' | 'err'. */
export function toast(msg, kind = 'ok') {
  let box = $('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.remove(), 3500);
}
