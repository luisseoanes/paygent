import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

type ThemeStore = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'theme' },
  ),
);

export const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  // BRAND.md: solo modo claro (papel y tinta). Nunca fondos oscuros.
  void theme;
  return 'light';
};
