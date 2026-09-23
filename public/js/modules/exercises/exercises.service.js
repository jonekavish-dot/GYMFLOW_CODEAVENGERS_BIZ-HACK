// Exercise categories A–F, ported verbatim from the old portal. Each member is
// assigned a category on joining; attendance ticks exercises off that category's
// rotation. Owners can add their own exercises on top, stored in config/exercises.
import { arrayRemove, arrayUnion, doc, onSnapshot, setDoc } from '../../core/sdk/firestore.js';
import { db } from '../../core/firebase.js';

export const CATEGORIES = {
  A: ['Chest & Abs', 'Biceps & Fore Arms', 'Triceps & Abs', 'Shoulder & Fore Arms', 'Lats & Abs', 'Thighs & Calf', 'Rest'],
  B: ['Biceps & Fore Arms', 'Thighs & Calf', 'Shoulder & Fore Arms', 'Lats & Abs', 'Triceps & Abs', 'Chest & Abs', 'Rest'],
  C: ['Triceps & Abs', 'Lats & Calf', 'Biceps & Fore Arms', 'Chest & Abs', 'Thighs', 'Shoulder & Fore Arms', 'Rest'],
  D: ['Thighs & Calf', 'Chest & Abs', 'Lats', 'Biceps & Fore Arms', 'Triceps & Abs', 'Shoulder & Fore Arms', 'Rest'],
  E: ['Lats & Abs', 'Shoulder & Fore Arms', 'Chest & Abs', 'Thighs & Calf', 'Biceps & Fore Arms', 'Triceps & Abs', 'Rest'],
  F: ['Chest & Triceps & Abs', 'Thighs & Lats & Abs', 'Shoulder & Biceps & Abs', 'Calf & Abs & Fore Arms', 'Rest'],
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);

/** Every built-in exercise, deduplicated and sorted, minus the "Rest" marker. */
export const DEFAULT_EXERCISES = [...new Set(Object.values(CATEGORIES).flat())]
  .filter((e) => e !== 'Rest')
  .sort((a, b) => a.localeCompare(b));

export const exercisesFor = (category) => CATEGORIES[category] || CATEGORIES.A;

const ref = doc(db, 'config', 'exercises');

/** Emits { custom, all } — `all` is defaults + custom, ready for the attendance grid. */
export function watchExercises(cb) {
  return onSnapshot(ref, (snap) => {
    const custom = (snap.exists() ? snap.data().custom : null) || [];
    cb({ custom, all: [...DEFAULT_EXERCISES, ...custom.filter((c) => !DEFAULT_EXERCISES.includes(c))] });
  });
}

export function addCustomExercise(name) {
  return setDoc(ref, { custom: arrayUnion(name) }, { merge: true });
}

export function removeCustomExercise(name) {
  return setDoc(ref, { custom: arrayRemove(name) }, { merge: true });
}
