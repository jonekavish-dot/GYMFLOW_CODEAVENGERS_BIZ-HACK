// Service worker registration + Chrome's install flow.
//
// Chrome fires `beforeinstallprompt` when the app is installable; we stash the event
// and show our own button, because the browser only surfaces its own UI on some
// platforms. Calling prompt() must happen inside a user gesture.
let deferredPrompt = null;
const listeners = new Set();

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

function notify() {
  listeners.forEach((fn) => fn({ canInstall: !!deferredPrompt, installed: isStandalone() }));
}

export function onInstallState(fn) {
  listeners.add(fn);
  fn({ canInstall: !!deferredPrompt, installed: isStandalone() });
  return () => listeners.delete(fn);
}

/** Shows Chrome's install dialog. Returns true if the user accepted. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const evt = deferredPrompt;
  deferredPrompt = null; // a prompt event can only be used once
  notify();
  evt.prompt();
  const { outcome } = await evt.userChoice;
  return outcome === 'accepted';
}

export function initPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep Chrome's mini-infobar from racing our own button
    deferredPrompt = e;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });

  if ('serviceWorker' in navigator) {
    // Registered after load so it never competes with the first paint or the auth check.
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed:', e));
    });
  }
}
