// Member portal entry: guard the page, then mount the member feature modules.
import { requireRole } from '../core/auth.js';
import { initPWA } from '../core/pwa.js';
import { mountShell } from '../shared/shell.js';
import { startIdleLogout } from '../shared/idle.js';
import { applyTheme, getTheme } from '../modules/settings/settings.service.js';
import membership from '../modules/membership/membership.view.js';
import bookings from '../modules/bookings/bookings.view.js';
import activity from '../modules/activity/activity.view.js';

applyTheme(getTheme());
initPWA();
const { user, profile } = await requireRole('member');
mountShell({
  roleLabel: 'Member',
  subtitle: 'Member Portal',
  user,
  profile,
  modules: [membership, bookings, activity],
});
startIdleLogout();
