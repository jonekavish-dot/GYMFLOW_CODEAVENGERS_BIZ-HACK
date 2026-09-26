import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { post, refreshSession, setAccessToken, setAuthLostHandler } from '../api/client';

const Ctx = createContext(null);

// A non-secret hint (the real credential is the httpOnly cookie) that this browser had a session.
// Without it, a first-time visitor would fire a doomed refresh request and log a 401 in the console.
const HINT = 'gymflow_had_session';
const hint = {
  get: () => { try { return localStorage.getItem(HINT) === '1'; } catch { return false; } },
  set: () => { try { localStorage.setItem(HINT, '1'); } catch { /* private mode */ } },
  clear: () => { try { localStorage.removeItem(HINT); } catch { /* private mode */ } },
};
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [state, setState] = useState({ status: 'loading', user: null });

  const adopt = useCallback((data) => {
    setAccessToken(data.access_token);
    hint.set();
    setState({ status: 'authed', user: data.user });
    return data.user;
  }, []);

  const clear = useCallback(() => {
    setAccessToken(null);
    hint.clear();
    qc.clear(); // never let the next person to sign in on this device see cached data
    setState({ status: 'anon', user: null });
  }, [qc]);

  // On first load, the refresh cookie (if any) restores the session without a login screen.
  useEffect(() => {
    setAuthLostHandler(clear);
    if (!hint.get()) { setState({ status: 'anon', user: null }); return undefined; }
    let live = true;
    refreshSession()
      .then((data) => { if (live) adopt(data); })
      .catch(() => { if (live) { hint.clear(); setState({ status: 'anon', user: null }); } });
    return () => { live = false; };
  }, [adopt, clear]);

  const value = useMemo(() => ({
    ...state,
    login: async (email, password) => adopt(await post('/auth/login', { email, password })),
    bootstrap: async (name, email, password) => adopt(await post('/auth/bootstrap', { name, email, password })),
    logout: async () => { await post('/auth/logout').catch(() => {}); clear(); },
  }), [state, adopt, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const homeFor = (role) => (role === 'admin' ? '/admin' : '/member');
