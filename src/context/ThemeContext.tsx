'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type Theme = 'dark' | 'light';

const ThemeContext = createContext<{
  theme:    Theme;
  setTheme: (t: Theme) => void;
}>({ theme: 'dark', setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  /* Read from localStorage on first mount — fast, no flash */
  useEffect(() => {
    const saved = localStorage.getItem('siyne-theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') setThemeState(saved);
  }, []);

  /* Apply data-theme attribute to <html> + persist to localStorage */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('siyne-theme', theme);
  }, [theme]);

  /* Sync from Firestore whenever the user logs in */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const saved = snap.data()?.appearance as Theme | undefined;
        if (saved === 'light' || saved === 'dark') setThemeState(saved);
      } catch {}
    });
    return unsub;
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
