// Login page entry: one sign-in for admins and members, routed by role; first-admin setup.
import { checkConnection } from '../core/firebase.js';
import {
  currentUser, getProfile, homeFor, signIn, resetPassword, bootstrapFirstAdmin, authErrorMessage,
} from '../core/auth.js';
import { $, $$ } from '../shared/dom.js';
import { busy } from '../shared/forms.js';
import { APP } from '../config/app.config.js';
import { initPWA, onInstallState, promptInstall } from '../core/pwa.js';

initPWA();

document.title = `${APP.name} — Sign In`;
$$('[data-app-name]').forEach((el) => { el.textContent = APP.name; });
$$('[data-app-tagline]').forEach((el) => { el.textContent = APP.tagline; });

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

const installBtn = $('#install-app');
onInstallState(({ canInstall }) => { installBtn.hidden = !canInstall; });
installBtn.addEventListener('click', promptInstall);

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
