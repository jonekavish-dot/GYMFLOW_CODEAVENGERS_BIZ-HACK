import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/Toast';
import { get } from './client';

/** How often live pages (occupancy, seat counts, attendance) re-poll while the tab is visible. */
export const LIVE = 5000;

// Query definitions shared by several pages, so a cache entry is fetched once and reused.
export const queries = {
  members: () => ({ queryKey: ['members'], queryFn: () => get('/members') }),
  plans: () => ({ queryKey: ['plans'], queryFn: () => get('/plans') }),
  payments: () => ({ queryKey: ['payments'], queryFn: () => get('/payments') }),
  trainers: () => ({ queryKey: ['trainers'], queryFn: () => get('/trainers') }),
  classes: () => ({ queryKey: ['classes'], queryFn: () => get('/classes') }),
  slots: () => ({ queryKey: ['slots'], queryFn: () => get('/slots') }),
  inside: () => ({ queryKey: ['inside'], queryFn: () => get('/checkin/inside') }),
  session: () => ({ queryKey: ['session'], queryFn: () => get('/checkin/session') }),
  dayAttendance: (date) => ({ queryKey: ['attendance', date], queryFn: () => get(`/attendance?date=${date}`) }),
  recentAttendance: (days) => ({ queryKey: ['attendance', 'recent', days], queryFn: () => get(`/attendance/recent?days=${days}`) }),
  gym: () => ({ queryKey: ['gym'], queryFn: () => get('/settings/gym') }),
  exercises: () => ({ queryKey: ['exercises'], queryFn: () => get('/settings/exercises') }),
  me: () => ({ queryKey: ['me'], queryFn: () => get('/members/me') }),
  myAttendance: () => ({ queryKey: ['my-attendance'], queryFn: () => get('/attendance/me') }),
  myToday: () => ({ queryKey: ['my-today'], queryFn: () => get('/attendance/me/today') }),
  myPayments: () => ({ queryKey: ['my-payments'], queryFn: () => get('/payments/me') }),
  myOpenCheckin: () => ({ queryKey: ['my-checkin'], queryFn: () => get('/checkin/me/open') }),
};

/**
 * A mutation with the boilerplate every write needs: toast the error (the API's `detail` is
 * already a readable sentence), toast the success, and refetch the queries it affects.
 * `invalidate` entries are query-key prefixes, e.g. 'members' refreshes ['members'] too.
 */
export function useAction(fn, { invalidate = [], success } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      invalidate.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
      if (success) toast(typeof success === 'function' ? success(data, vars) : success);
    },
    onError: (e) => toast(e.message, 'err'),
  });
}
