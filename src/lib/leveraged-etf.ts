// Common leveraged ETF symbols list
export const LEVERAGED_ETF_SYMBOLS = new Set([
  'QLD', 'TQQQ', 'SQQQ', 'SSO', 'UPRO', 'SOXL', 'SOXS',
  'TECL', 'TECS', 'FAS', 'FAZ', 'SPXL', 'SPXS', 'TNA', 'TZA',
  'UDOW', 'SDOW', 'LABU', 'LABD', 'NUGT', 'DUST', 'JNUG',
  'ERX', 'ERY', 'DFEN', 'WEBL', 'WEBS', 'FNGU', 'FNGD',
  'BULZ', 'BERZ', 'CURE', 'DRN', 'DRV', 'MIDU', 'WANT',
]);

export function isLeveragedETF(symbol: string): boolean {
  return LEVERAGED_ETF_SYMBOLS.has(symbol.toUpperCase());
}
