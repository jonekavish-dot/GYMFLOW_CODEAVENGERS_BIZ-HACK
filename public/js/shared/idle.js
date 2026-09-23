// Inactivity auto-logout, ported from both old portals: 3 minutes idle, with a
// 30-second countdown warning that any activity cancels.
import { signOut } from '../core/auth.js';
import { toast } from './toast.js';

const IDLE_MS = 3 * 60 * 1000;
const WARN_MS = 30 * 1000;
const ACTIVITY = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'visibilitychange'];

export function startIdleLogout({ idleMs = IDLE_MS, warnMs = WARN_MS } = {}) {
  let idleTimer;
  let countdown;
  let banner;

  const clearWarning = () => {
    clearInterval(countdown);
    banner?.remove();
    banner = null;
  };

  function warn() {
    let left = Math.round(warnMs / 1000);
    banner = document.createElement('div');
    banner.className = 'idle-warn';
    const paint = () => { banner.textContent = `⚠ Inactive — signing out in ${left}s. Move the mouse to stay.`; };
    paint();
    document.body.append(banner);
    countdown = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearWarning(); toast('Signed out after 3 minutes of inactivity.'); signOut(); return; }
      paint();
    }, 1000);
  }

  function reset() {
    clearTimeout(idleTimer);
    clearWarning();
    idleTimer = setTimeout(warn, idleMs - warnMs);
  }

  ACTIVITY.forEach((ev) => document.addEventListener(ev, reset, { passive: true }));
  reset();

  return () => {
    clearTimeout(idleTimer);
    clearWarning();
    ACTIVITY.forEach((ev) => document.removeEventListener(ev, reset));
  };
}
