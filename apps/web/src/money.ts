/** Display INR amounts in whole rupees. New financial entries are also
 * validated as whole rupees; ceiling keeps legacy fractional values visible
 * without dropping part of an amount. */
export function formatINR(amount: number): string {
  const value = Number.isFinite(amount) ? Math.ceil(amount - Number.EPSILON) : 0;
  return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
