/**
 * Тема и сессия в одном контексте: оба нужны почти каждому экрану,
 * и оба читаются из хранилища при старте.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PALETTES, Palette, ThemeName, ThemePref } from './theme';
import { api, loadToken, setToken, Me } from './api';

interface Ctx {
  p: Palette;
  themePref: ThemePref;
  setThemePref: (t: ThemePref) => void;
  me: Me | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
}
const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [themePref, setPref] = useState<ThemePref>('dark');
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = (await AsyncStorage.getItem('nm_theme')) as ThemePref | null;
      if (saved) setPref(saved);
      const t = await loadToken();
      if (t) {
        try { setMe(await api<Me>('/me')); }
        catch { await setToken(null); }   /* протухший токен — молча выходим */
      }
      setReady(true);
    })();
  }, []);

  const resolved: ThemeName =
    themePref === 'auto' ? (system === 'light' ? 'light' : 'dark') : themePref;

  const setThemePref = useCallback((t: ThemePref) => {
    setPref(t);
    AsyncStorage.setItem('nm_theme', t).catch(() => {});
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string }>('/auth/login', {
      method: 'POST', body: { email: email.trim(), password },
    });
    await setToken(r.token);
    setMe(await api<Me>('/me'));
  }, []);

  const signOut = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* всё равно выходим */ }
    await setToken(null);
    setMe(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try { setMe(await api<Me>('/me')); } catch { /* оставляем прежнее */ }
  }, []);

  return (
    <C.Provider value={{
      p: PALETTES[resolved], themePref, setThemePref,
      me, ready, signIn, signOut, refreshMe,
    }}>
      {children}
    </C.Provider>
  );
}
