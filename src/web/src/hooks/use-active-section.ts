import * as React from 'react';

// Qué sección de la página se está leyendo (la que cruza la franja superior
// de la ventana). Sirve para marcar el enlace activo del menú.
export const useActiveSection = (ids: readonly string[], enabled = true) => {
  const [active, setActive] = React.useState<string>();

  React.useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') {
      setActive(undefined);
      return;
    }
    const visibles = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) =>
          e.isIntersecting
            ? visibles.add(e.target.id)
            : visibles.delete(e.target.id),
        );
        setActive(ids.find((id) => visibles.has(id)));
      },
      // Franja entre el 20% y el 45% de la altura: la sección "en lectura".
      { rootMargin: '-20% 0px -55% 0px' },
    );
    // Las secciones de una ruta lazy pueden no existir aún: reintenta un poco.
    let frame = 0;
    let tries = 0;
    const observe = () => {
      const nodes = ids
        .map((id) => document.getElementById(id))
        .filter((n): n is HTMLElement => !!n);
      if (nodes.length === 0 && tries++ < 30) {
        frame = requestAnimationFrame(observe);
        return;
      }
      nodes.forEach((n) => observer.observe(n));
    };
    observe();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ids, enabled]);

  return active;
};
