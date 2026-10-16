import * as React from 'react';

import { resolveTheme, useThemeStore } from '@/stores/theme-store';

// Applies the selected theme to <html> and follows the OS preference
// when the theme is "system".
export const ThemeSync = () => {
  const theme = useThemeStore((state) => state.theme);

  React.useEffect(() => {
    const apply = () => {
      document.documentElement.classList.toggle(
        'dark',
        resolveTheme(theme) === 'dark',
      );
    };
    apply();

    if (theme !== 'system' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return null;
};
