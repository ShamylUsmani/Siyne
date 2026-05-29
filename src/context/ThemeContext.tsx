'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type Theme   = 'dark' | 'light';
type BgTheme = 'city' | 'rainforest';

const ThemeContext = createContext<{
  theme:      Theme;
  setTheme:   (t: Theme) => void;
  bgTheme:    BgTheme;
  setBgTheme: (t: BgTheme) => void;
}>({ theme: 'dark', setTheme: () => {}, bgTheme: 'city', setBgTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,   setThemeState]   = useState<Theme>('dark');
  const [bgTheme, setBgThemeState] = useState<BgTheme>('city');

  useEffect(() => {
    const saved = localStorage.getItem('siyne-theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') setThemeState(saved);
    const savedBg = localStorage.getItem('siyne-bg-theme') as BgTheme | null;
    if (savedBg === 'city' || savedBg === 'rainforest') setBgThemeState(savedBg);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('siyne-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('siyne-bg-theme', bgTheme);
  }, [bgTheme]);

  /* sync dark/light from Firestore on login */
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

  function setTheme(t: Theme) {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('siyne-theme', t);
  }

  function setBgTheme(t: BgTheme) {
    setBgThemeState(t);
    localStorage.setItem('siyne-bg-theme', t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, bgTheme, setBgTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
