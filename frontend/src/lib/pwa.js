import { useEffect, useState } from 'react';

// Chrome fires `beforeinstallprompt` once the app is installable. We keep the event and show
// our own Install button, because prompt() must be called from a user gesture.
let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export function initPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // stop Chrome's mini-infobar racing our own button
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });

  // Only in a production build: a service worker in dev would serve stale files while editing.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('Service worker registration failed:', e));
    });
  }
}

export function useInstall() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const fn = () => rerender((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  return {
    canInstall: !!deferred && !isStandalone(),
    async install() {
      if (!deferred) return false;
      const evt = deferred;
      deferred = null; // a prompt event can only be used once
      notify();
      evt.prompt();
      return (await evt.userChoice).outcome === 'accepted';
    },
  };
}
