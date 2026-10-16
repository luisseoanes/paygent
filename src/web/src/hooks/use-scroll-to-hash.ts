import * as React from 'react';
import { useLocation } from 'react-router';

// React Router no salta a los #anclas: al navegar a '/#agentes' (o al volver
// a pulsar el mismo enlace) baja hasta esa sección; sin ancla, vuelve arriba
// cuando cambia la página. Respeta prefers-reduced-motion.

// Espera hasta 5 s a que la sección exista y luego la vigila 1,5 s más.
const WAIT_MS = 5000;
const SETTLE_MS = 1500;
const TICK_MS = 120;

// Distancia entre la sección y donde debería quedar (su scroll-margin-top).
// scrollIntoView no sirve: no mueve la ventana cuando un ancestro recorta el
// overflow, como hacen las secciones de la portada.
const offsetOf = (target: HTMLElement) =>
  target.getBoundingClientRect().top -
  (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);

export const useScrollToHash = () => {
  const { pathname, hash, key } = useLocation();
  const prevPathname = React.useRef(pathname);

  React.useEffect(() => {
    const changedPage = prevPathname.current !== pathname;
    prevPathname.current = pathname;

    if (!hash) {
      if (changedPage) window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    const id = decodeURIComponent(hash.slice(1));
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const started = Date.now();
    let found = 0;
    let lastY = -1;
    let timer = 0;
    let first = true;

    // Las secciones de una ruta lazy tardan en montarse y las imágenes y
    // animaciones cambian su alto mientras bajamos: cuando el scroll se
    // detiene y la sección no quedó en su sitio, se corrige al instante ('auto' respetaría el scroll-behavior: smooth del CSS).
    const tick = () => {
      const target = document.getElementById(id);
      if (target) {
        found ||= Date.now();
        const offset = offsetOf(target);
        const parado = window.scrollY === lastY;
        if (first || (parado && Math.abs(offset) > 4)) {
          // Animar solo saltos cortos: uno largo animado se siente lento.
          const suave =
            first &&
            !reduce &&
            !changedPage &&
            Math.abs(offset) < window.innerHeight * 2;
          window.scrollTo({
            top: window.scrollY + offset,
            behavior: suave ? 'smooth' : 'instant',
          });
          first = false;
        }
        lastY = window.scrollY;
      }
      const vigente = found
        ? Date.now() - found < SETTLE_MS
        : Date.now() - started < WAIT_MS;
      if (vigente) timer = window.setTimeout(tick, TICK_MS);
    };
    tick();

    // Si la persona hace scroll por su cuenta, deja de corregir.
    const stop = () => window.clearTimeout(timer);
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    return () => {
      stop();
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
    };
  }, [pathname, hash, key]);
};
