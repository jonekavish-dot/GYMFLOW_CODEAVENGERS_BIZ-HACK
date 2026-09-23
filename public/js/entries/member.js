// Member portal entry: guard the page, then mount the member feature modules.
import { requireRole } from '../core/auth.js';
import { mountShell } from '../shared/shell.js';
import membership from '../modules/membership/membership.view.js';
import bookings from '../modules/bookings/bookings.view.js';

const { user, profile } = await requireRole('member');
mountShell({ roleLabel: 'Member', subtitle: 'Member Portal', user, profile, modules: [membership, bookings] });
