/**
 * The listing fee as a share of a plate's price, worded for display:
 * "3%", or "less than 1%". Null when the fee is over 10% of the price,
 * where the comparison stops helping.
 */
export function feeShare(fee: number, price: number): string | null {
  if (!(price > 0) || fee / price > 0.1) return null;
  const pct = Math.round((fee / price) * 100);
  return pct < 1 ? 'less than 1%' : `${pct}%`;
}
