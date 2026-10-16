// Anclas de las secciones de la portada (los id viven en app/routes/landing.tsx).
export const landingSections = [
  'que-es',
  'como-funciona',
  'agentes',
  'sin-senal',
  'que-es-real',
] as const;
export type LandingSection = (typeof landingSections)[number];

// Every route of the application is declared here.
// `path` is used by the router, `getHref` by links and navigation.
// Never hardcode a URL string in a component: use paths.x.getHref().
export const paths = {
  home: {
    path: '/',
    // Con sección, salta a esa parte de la portada: '/#como-funciona'.
    getHref: (section?: LandingSection) => (section ? `/#${section}` : '/'),
  },
  auth: {
    login: {
      path: '/iniciar-sesion',
      getHref: (redirectTo?: string | null) =>
        `/iniciar-sesion${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`,
    },
  },
  juan: {
    path: '/juan',
    getHref: () => '/juan',
  },
  // PWA de María. Con ?vincular=<id> se vincula a esa rama al abrir.
  maria: {
    path: '/maria',
    getHref: (vincular?: string) =>
      vincular ? `/maria?vincular=${encodeURIComponent(vincular)}` : '/maria',
  },
  tendero: {
    path: '/tendero',
    getHref: () => '/tendero',
  },
  // SMS-02: celular de teclas simulado (Doña Carmen) que conversa con el Asistente.
  celular: {
    path: '/celular',
    getHref: () => '/celular',
  },
} as const;
