import { useEffect, useState } from 'react';

const IDLE_MS = 3 * 60 * 1000;
const WARN_S = 30;
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

/**
 * Signs out after 3 minutes without activity, warning for the last 30 seconds.
 * Returns the seconds left while the warning is showing, else null.
 */
export function useIdleLogout(onTimeout) {
  const [left, setLeft] = useState(null);

  useEffect(() => {
    let idle;
    let tick;

    const reset = () => {
      clearTimeout(idle);
      clearInterval(tick);
      setLeft(null);
      idle = setTimeout(() => {
        let remaining = WARN_S;
        setLeft(remaining);
        tick = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) { clearInterval(tick); onTimeout(); } else setLeft(remaining);
        }, 1000);
      }, IDLE_MS - WARN_S * 1000);
    };

    EVENTS.forEach((ev) => document.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(idle);
      clearInterval(tick);
      EVENTS.forEach((ev) => document.removeEventListener(ev, reset));
    };
  }, [onTimeout]);

  return left;
}
