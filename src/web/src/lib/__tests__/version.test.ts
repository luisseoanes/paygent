import { esErrorDeVersion, recargarPorVersionNueva } from '../version';

beforeEach(() => sessionStorage.clear());

test('a missing chunk from an older deploy is recognised in every browser', () => {
  expect(
    esErrorDeVersion(
      new TypeError(
        'Failed to fetch dynamically imported module: https://x/assets/landing-OLD.js',
      ),
    ),
  ).toBe(true);
  expect(
    esErrorDeVersion(new TypeError('Importing a module script failed.')),
  ).toBe(true);
  expect(
    esErrorDeVersion(new Error('error loading dynamically imported module')),
  ).toBe(true);
  expect(esErrorDeVersion(new Error('Network Error'))).toBe(false);
});

test('reloads once for a new version, but never loops', () => {
  const recargar = vi.fn();
  expect(recargarPorVersionNueva(1_000_000, recargar)).toBe(true);
  // Vuelve a fallar enseguida: no era la versión, no se insiste.
  expect(recargarPorVersionNueva(1_005_000, recargar)).toBe(false);
  expect(recargar).toHaveBeenCalledTimes(1);
  // Mucho después (otro despliegue) sí vuelve a recargar.
  expect(recargarPorVersionNueva(1_100_000, recargar)).toBe(true);
  expect(recargar).toHaveBeenCalledTimes(2);
});
