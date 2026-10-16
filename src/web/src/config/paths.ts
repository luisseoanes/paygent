// Anclas de las secciones de la portada (los id viven en app/routes/landing.tsx).
export const landingSections = [
  'que-es',
  'como-funciona',
  'sin-senal',
  'agentes',
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
    // Registro del titular (con wallet)
    registro: {
      path: '/registrarse',
      getHref: () => '/registrarse',
    },
  },
  // Cuenta del titular (con wallet): su mandato, delegados y libreta.
  cuenta: {
    path: '/cuenta',
    getHref: () => '/cuenta',
  },
  // App del beneficiario: pagar con vales, con o sin señal.
  billetera: {
    path: '/billetera',
    getHref: () => '/billetera',
  },
  // Pública: enlazar este celular con el código (o QR) de un titular.
  enlazar: {
    path: '/enlazar',
    getHref: (codigo?: string) =>
      codigo ? `/enlazar?codigo=${encodeURIComponent(codigo)}` : '/enlazar',
    registro: {
      path: '/enlazar/registro',
      getHref: () => '/enlazar/registro',
    },
  },
  // Rutas viejas: src/api redirige a /juan tras firmar y hay QR con /maria.
  legado: {
    juan: { path: '/juan' },
    maria: { path: '/maria' },
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

// Pantallas de entrada (sin sesión): mismo marco de paisaje y nube.
export const pantallasDeEntrada: string[] = [
  paths.auth.login.path,
  paths.auth.registro.path,
  paths.enlazar.path,
  paths.enlazar.registro.path,
];
