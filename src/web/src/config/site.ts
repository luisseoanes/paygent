import { type LandingSection, paths } from './paths';

// section: la parte de la portada a la que lleva (sin section, al inicio).
type NavItem = { label: string; href: string; section?: LandingSection };

// Brand and global content. Change the identity of the app here.
export const siteConfig = {
  name: 'Paygent',
  tagline: 'Un solo permiso. Muchas manos. Cualquier señal.',
  description:
    'Paygent convierte un permiso de Open Payments en un árbol de mandatos con límites: personas y agentes de IA pagan con datos, sin conexión o por SMS, sin intermediarios.',
  // Menú principal: cada botón lleva a una parte de la portada, desde
  // cualquier pantalla.
  mainNav: (
    [
      { label: 'Qué es', section: 'que-es' },
      { label: 'Cómo funciona', section: 'como-funciona' },
      { label: 'Sin señal', section: 'sin-senal' },
      { label: 'Agentes', section: 'agentes' },
    ] satisfies { label: string; section: LandingSection }[]
  ).map((item): NavItem => ({
    ...item,
    href: paths.home.getHref(item.section),
  })),
} as const;
