// Admin portal entry: guard the page, then mount the admin feature modules.
import { requireRole } from '../core/auth.js';
import { mountShell } from '../shared/shell.js';
import { startIdleLogout } from '../shared/idle.js';
import { applyTheme, getTheme } from '../modules/settings/settings.service.js';
import dashboard from '../modules/dashboard/dashboard.view.js';
import members from '../modules/members/members.view.js';
import attendance from '../modules/attendance/attendance.view.js';
import classes from '../modules/classes/classes.view.js';
import plans from '../modules/plans/plans.view.js';
import trainers from '../modules/trainers/trainers.view.js';
import payments from '../modules/payments/payments.view.js';
import analytics from '../modules/analytics/analytics.view.js';
import settings from '../modules/settings/settings.view.js';

applyTheme(getTheme());
const { user, profile } = await requireRole('admin');
mountShell({
  roleLabel: 'Admin',
  subtitle: 'Admin Console',
  user,
  profile,
  modules: [dashboard, members, attendance, classes, plans, trainers, payments, analytics, settings],
});
startIdleLogout();
