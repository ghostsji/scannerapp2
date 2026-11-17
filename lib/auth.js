import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearSession, loadSession, saveSession, setSignedOutHandler } from './api';

// Who is signed in. Signing in uses the person's Tracklab email and password
// (POST /api/mobile/login). It is a phone session: it never signs them out
// of the website, and it lasts until the phone has gone 30 days unused.

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSignedOutHandler(() => setUser(null));
    (async () => {
      const saved = await loadSession();
      if (saved) {
        setUser(saved.user);
        // Check the stored token still works. A 401 signs out (see api.js);
        // no signal keeps the person in, so the offline queue still works.
        api('/api/mobile/me').then((r) => { if (r?.user) setUser(r.user); }).catch(() => {});
      }
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (email, password) => {
    const res = await api('/api/mobile/login', { method: 'POST', body: { email: email.trim(), password } });
    await saveSession(res.token, res.user);
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    await api('/api/session/logout', { method: 'POST', body: {} }).catch(() => {});
    await clearSession();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
