export const DEFAULT_EXPIRY_WARNING_DAYS = 30;
export const MAX_EXPIRY_WARNING_DAYS = 3650;

export function expiryWarningDays(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) &&
    value >= 0 && value <= MAX_EXPIRY_WARNING_DAYS ? value : DEFAULT_EXPIRY_WARNING_DAYS;
}

export function medicineExpiryStatus(expiryDate: unknown, today: string, warningDays: number) {
  if (typeof expiryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) return 'unknown';
  const expiry = new Date(expiryDate + 'T00:00:00Z');
  if (!Number.isFinite(expiry.getTime()) || expiry.toISOString().slice(0, 10) !== expiryDate) return 'unknown';
  const daysLeft = (expiry.getTime() - Date.parse(today + 'T00:00:00Z')) / 86_400_000;
  if (daysLeft < 0) return 'expired';
  return daysLeft <= warningDays ? 'expiring' : 'normal';
}
