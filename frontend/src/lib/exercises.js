// Exercise categories A-F: each member is assigned one, and attendance ticks exercises
// off that category's rotation. Owners can add custom exercises on top (Settings).
export const CATEGORIES = {
  A: ['Chest & Abs', 'Biceps & Fore Arms', 'Triceps & Abs', 'Shoulder & Fore Arms', 'Lats & Abs', 'Thighs & Calf', 'Rest'],
  B: ['Biceps & Fore Arms', 'Thighs & Calf', 'Shoulder & Fore Arms', 'Lats & Abs', 'Triceps & Abs', 'Chest & Abs', 'Rest'],
  C: ['Triceps & Abs', 'Lats & Calf', 'Biceps & Fore Arms', 'Chest & Abs', 'Thighs', 'Shoulder & Fore Arms', 'Rest'],
  D: ['Thighs & Calf', 'Chest & Abs', 'Lats', 'Biceps & Fore Arms', 'Triceps & Abs', 'Shoulder & Fore Arms', 'Rest'],
  E: ['Lats & Abs', 'Shoulder & Fore Arms', 'Chest & Abs', 'Thighs & Calf', 'Biceps & Fore Arms', 'Triceps & Abs', 'Rest'],
  F: ['Chest & Triceps & Abs', 'Thighs & Lats & Abs', 'Shoulder & Biceps & Abs', 'Calf & Abs & Fore Arms', 'Rest'],
};
export const CATEGORY_KEYS = Object.keys(CATEGORIES);
export const DEFAULT_EXERCISES = [...new Set(Object.values(CATEGORIES).flat())].filter((e) => e !== 'Rest').sort((a, b) => a.localeCompare(b));
export const exercisesFor = (category) => CATEGORIES[category] || CATEGORIES.A;

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
export const DURATIONS = [
  { months: 1, label: 'Monthly' }, { months: 3, label: 'Quarterly' },
  { months: 6, label: 'Half-Yearly' }, { months: 12, label: 'Yearly' },
];
/** Per-month rate, so renewals can be priced by months like the plan list shows. */
export const monthlyRate = (plan) => Math.round((plan.price || 0) / Math.max(1, (plan.duration_days || 30) / 30));
