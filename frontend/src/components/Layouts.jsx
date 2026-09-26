import { useQuery } from '@tanstack/react-query';
import { LIVE, queries } from '../api/hooks';
import { membershipStatus } from '../lib/format';
import { Shell } from './Shell';

export function AdminLayout() {
  // The sidebar badge counts memberships that need attention (expiring soon or already expired).
  const { data: members = [] } = useQuery({ ...queries.members(), refetchInterval: LIVE * 6 });
  const alerts = members.filter((m) => membershipStatus(m.expiry_date).key !== 'active').length;

  const nav = [
    { to: '/admin', label: 'Dashboard', title: 'Overview Dashboard', icon: '📊', section: 'Main', badge: alerts },
    { to: '/admin/members', label: 'Members', title: 'Members', icon: '👥', section: 'Main' },
    { to: '/admin/attendance', label: 'Attendance', title: 'Attendance', icon: '✅', section: 'Main' },
    { to: '/admin/slots', label: 'Slots', title: 'Gym Workout Slots', icon: '⏱️', section: 'Operations' },
    { to: '/admin/checkin', label: 'Check-In', title: 'Check-In Desk', icon: '🚪', section: 'Operations' },
    { to: '/admin/classes', label: 'Classes', title: 'Class Schedule', icon: '📅', section: 'Operations' },
    { to: '/admin/plans', label: 'Plans', title: 'Membership Plans', icon: '💳', section: 'Operations' },
    { to: '/admin/trainers', label: 'Trainers', title: 'Trainers', icon: '🧑‍🏫', section: 'Operations' },
    { to: '/admin/payments', label: 'Payments', title: 'Payments & Revenue', icon: '💰', section: 'Operations' },
    { to: '/admin/analytics', label: 'Analytics', title: 'Analytics', icon: '📈', section: 'Operations' },
    { to: '/admin/settings', label: 'Settings', title: 'Settings', icon: '⚙️', section: 'System' },
  ];
  return <Shell roleLabel="Admin" subtitle="Admin Console" nav={nav} />;
}

export function MemberLayout() {
  const { data: slots = [] } = useQuery({ ...queries.slots(), refetchInterval: LIVE * 3 });
  const { data: classes = [] } = useQuery({ ...queries.classes(), refetchInterval: LIVE * 3 });

  const nav = [
    { to: '/member', label: 'Membership', title: 'My Membership', icon: '🪪', section: 'Main' },
    { to: '/member/slots', label: 'Gym Slots', title: 'Gym Workout Slots', icon: '⏱️', section: 'Main', badge: slots.filter((s) => s.booked).length },
    { to: '/member/classes', label: 'Classes', title: 'Book Classes', icon: '📅', section: 'Main', badge: classes.filter((c) => c.booked).length },
    { to: '/member/checkin', label: 'Check In', title: 'Check In', icon: '📷', section: 'Main', fab: true },
    { to: '/member/activity', label: 'Activity', title: 'My Activity', icon: '🔥', section: 'Main' },
  ];
  return <Shell roleLabel="Member" subtitle="Member Portal" nav={nav} />;
}
