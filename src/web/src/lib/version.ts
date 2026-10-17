// Tras un despliegue, una pestaña abierta con la versión anterior pide trozos
// (lazy) que ya no existen: el servidor responde index.html y el import falla.
// La salida es recargar una vez para traer la versión nueva.

const CLAVE = 'paygent-recarga';
// Si ya recargamos hace nada y vuelve a fallar, no es la versión: no se insiste.
const VENTANA_MS = 10_000;

const MENSAJES_DE_TROZO =
  /dynamically imported module|importing a module script failed|error loading dynamically imported module|unable to preload/i;

export const esErrorDeVersion = (error: unknown) =>
  MENSAJES_DE_TROZO.test(
    error instanceof Error ? error.message : String(error ?? ''),
  );

/** Recarga una vez por versión nueva. Devuelve si recargó. */
export const recargarPorVersionNueva = (
  ahora = Date.now(),
  recargar = () => window.location.reload(),
) => {
  let ultima = 0;
  try {
    ultima = Number(sessionStorage.getItem(CLAVE) ?? 0);
  } catch {
    // sin almacenamiento: se recarga igual, una vez por carga de página
  }
  if (ahora - ultima < VENTANA_MS) return false;
  try {
    sessionStorage.setItem(CLAVE, String(ahora));
  } catch {
    // ídem
  }
  recargar();
  return true;
};
