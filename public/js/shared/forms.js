import { toast } from './toast.js';
import { authErrorMessage } from '../core/auth.js';

/** Disables a form's submit button while `fn` runs. */
export async function busy(form, fn) {
  const btn = form.querySelector('[type=submit]');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Working…';
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = label; }
}

/** Wires a form: runs `action(form)` on submit with a busy button and toasts the outcome. */
export function onSubmit(form, action, successMsg) {
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    busy(form, async () => {
      try {
        await action(form);
        if (successMsg) toast(successMsg);
      } catch (e) { toast(authErrorMessage(e), 'err'); }
    });
  });
}
