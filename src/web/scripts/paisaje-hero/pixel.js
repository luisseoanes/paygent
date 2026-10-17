// Utilidades de pixel art compartidas por los generadores (deterministas).
const azar = (semilla) => () => {
  semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const umbral = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;
// Ruido 1D suave por valor (para crestas y bordes)
const ruido1 = (semilla) => {
  const r = azar(semilla); const v = Array.from({ length: 2048 }, r);
  return (x) => { const i = Math.floor(x), f = x - i, a = v[i & 2047], b = v[(i + 1) & 2047]; const s = f * f * (3 - 2 * f); return a + (b - a) * s; };
};
const fbm = (n, x, oct = 4) => { let s = 0, a = 0.5, f = 1, t = 0; for (let o = 0; o < oct; o++) { s += a * n(x * f + o * 37.1); t += a; a *= 0.5; f *= 2; } return s / t; };
// Ruido 2D por valor
const ruido2 = (semilla) => {
  const r = azar(semilla); const v = Array.from({ length: 256 * 256 }, r);
  const g = (x, y) => v[(y & 255) * 256 + (x & 255)];
  return (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = g(i, j), b = g(i + 1, j), c = g(i, j + 1), d = g(i + 1, j + 1); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
};

// Elige un tono de la rampa con tramado ordenado (t en 0..1)
const tono = (rampa, t, x, y, suave = 0.3) => { const v = Math.max(0, Math.min(0.9999, t)) * (rampa.length - 1); const i = Math.floor(v); const f = v - i; const j = Math.min(i + 1, rampa.length - 1);
  if (f < 0.5 - suave / 2) return rampa[i]; if (f > 0.5 + suave / 2) return rampa[j]; return (f - (0.5 - suave / 2)) / suave > umbral(x, y) ? rampa[j] : rampa[i]; };
