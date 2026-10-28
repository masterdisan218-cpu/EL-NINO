export function isPromotionActive(expiresAt?: string): boolean {
  if (!expiresAt) return true;
  const expiryTime = Date.parse(expiresAt);
  return Number.isFinite(expiryTime) && expiryTime > Date.now();
}
