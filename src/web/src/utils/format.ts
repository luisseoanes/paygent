// Formatting helpers. Always format dates, numbers and money through these
// functions so the whole app is consistent.

const LOCALE = 'es-CO';

export const formatDate = (
  date: number | string | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
) => new Intl.DateTimeFormat(LOCALE, options).format(new Date(date));

export const formatNumber = (
  value: number,
  options: Intl.NumberFormatOptions = {},
) => new Intl.NumberFormat(LOCALE, options).format(value);

export const formatCurrency = (
  amount: number,
  currency = 'USD',
  options: Intl.NumberFormatOptions = {},
) =>
  new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    // "$ 250" en vez de "US$ 250": la moneda se aclara en el texto cuando hace falta.
    currencyDisplay: 'narrowSymbol',
    ...options,
  }).format(amount);

// Hora en 24 h con segundos ("23:07:37"), para libretas y relojes.
export const formatTime = (date: number | string | Date) =>
  new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(date));

// Pesos colombianos sin decimales: "$ 48.000". Los montos viajan en USD y se
// muestran en COP con una tasa de referencia (OP-10).
export const formatCop = (cop: number) =>
  formatCurrency(Math.round(cop), 'COP', { maximumFractionDigits: 0 });
