// Sale de la app hacia otra URL (p. ej. la pantalla de consentimiento del
// Test Wallet). Aislado para poder simularlo en los tests: jsdom no navega.
export const redirectTo = (url: string) => window.location.assign(url);
