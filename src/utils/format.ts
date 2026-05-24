const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function formatMoney(value: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(value);
  const formatted = moneyFormatter.format(abs).replace('COP', '').replace(/\s/g, '').trim();
  // moneyFormatter en es-CO devuelve "$ 1.234.567"; normalizamos a "$1.234.567".
  const clean = formatted.startsWith('$') ? `$${formatted.slice(1).trim()}` : `$${formatted}`;
  if (opts.sign) {
    if (value > 0) return `+${clean}`;
    if (value < 0) return `-${clean}`;
  } else if (value < 0) {
    return `-${clean}`;
  }
  return clean;
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

export function formatDelta(value: number, digits = 0) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}
