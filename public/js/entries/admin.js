// Admin portal entry: guard the page, then mount the admin feature modules.
import { requireRole } from '../core/auth.js';
import { mountShell } from '../shared/shell.js';
import dashboard from '../modules/dashboard/dashboard.view.js';
import members from '../modules/members/members.view.js';
import classes from '../modules/classes/classes.view.js';
import plans from '../modules/plans/plans.view.js';

const { user, profile } = await requireRole('admin');
mountShell({ roleLabel: 'Admin', subtitle: 'Admin Console', user, profile, modules: [dashboard, members, classes, plans] });
