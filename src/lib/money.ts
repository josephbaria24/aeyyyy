/** System currency: Philippine Peso */
export const SYSTEM_CURRENCY = 'PHP' as const;
export const SYSTEM_CURRENCY_SYMBOL = '₱';
export const SYSTEM_CURRENCY_LABEL = 'Peso (PHP)';

export function formatMoney(amount: number, _currency?: string) {
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: SYSTEM_CURRENCY,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${SYSTEM_CURRENCY_SYMBOL}${Number(amount || 0).toFixed(2)}`;
  }
}

export function sumBy<T>(items: T[], getAmount: (item: T) => number) {
  return items.reduce((total, item) => total + (Number(getAmount(item)) || 0), 0);
}

/** Whole nights between check-in and check-out (minimum 1 when dates are valid). */
export function nightsBetween(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/** Room rate × nights × room count. */
export function calculateStayAmount(
  pricePerNight: number,
  checkIn: string,
  checkOut: string,
  rooms = 1,
) {
  const nights = nightsBetween(checkIn, checkOut);
  const rate = Number(pricePerNight) || 0;
  const roomCount = Math.max(1, Number(rooms) || 1);
  return Math.round(rate * nights * roomCount * 100) / 100;
}
