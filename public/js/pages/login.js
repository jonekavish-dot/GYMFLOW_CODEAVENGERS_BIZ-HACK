import { checkConnection } from '../firebase.js';
import {
  currentUser, getProfile, homeFor, signIn, resetPassword, bootstrapFirstAdmin, authErrorMessage,
} from '../auth.js';
import { $, busy } from '../ui.js';

const errEl = $('#login-err');
const showErr = (e) => { errEl.textContent = typeof e === 'string' ? e : authErrorMessage(e); };

if (new URLSearchParams(location.search).get('e') === 'no-role') {
  showErr('This account has no role assigned. Ask an admin to register you.');
}

$('#login-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = ev.target;
  showErr('');
  busy(f, async () => {
    try {
      const profile = await signIn(f.email.value.trim(), f.password.value);
      location.replace(homeFor(profile.role));
    } catch (e) { showErr(e); }
  });
});

$('#forgot').addEventListener('click', async () => {
  const email = $('#login-form').email.value.trim();
  if (!email) return showErr('Enter your email above first.');
  try {
    await resetPassword(email);
    showErr('');
    errEl.textContent = 'If that account exists, a reset link is on its way.';
  } catch (e) { showErr(e); }
});

$('#setup-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = ev.target;
  showErr('');
  busy(f, async () => {
    try {
      await bootstrapFirstAdmin({ name: f.fullName.value.trim(), email: f.email.value.trim(), password: f.password.value });
      location.replace('admin.html');
    } catch (e) { showErr(e); }
  });
});

// Listeners are attached above first so an early submit never falls through to a native form GET.
// Already signed in → straight to the right portal.
const user = await currentUser();
if (user) {
  const profile = await getProfile(user.uid).catch(() => null);
  if (profile) location.replace(homeFor(profile.role));
}

const conn = await checkConnection();
const connEl = $('#conn');
connEl.className = `conn conn-${conn.ok ? 'ok' : 'err'}`;
connEl.textContent = conn.message;
if (conn.ok && !conn.bootstrapped) $('#setup-form').hidden = false;
