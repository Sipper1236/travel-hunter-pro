export const QUOTE_MAX_AGE_MS = 15 * 60 * 1000;
const CLOCK_SKEW_MS = 2 * 60 * 1000;
const timestamp = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  const day = new Date(`${value.slice(0,10)}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0,10) !== value.slice(0,10)) return NaN;
  return Date.parse(value);
};

/** Application observation age policy; it does not assert seller availability. */
export function quoteFreshness(offer, now = Date.now()) {
  const observed = timestamp(offer?.observedAt);
  if (!Number.isFinite(observed)) return {status:'unknown',reason:'Quote observation time is missing or invalid.'};
  if (observed > now + CLOCK_SKEW_MS) return {status:'future',reason:'Quote observation time is ahead of the application clock.'};
  const expires = offer.expiresAt == null ? Infinity : timestamp(offer.expiresAt);
  if (Number.isNaN(expires) || expires < observed) return {status:'unknown',reason:'Provider quote expiry is invalid.'};
  const usableUntil = Math.min(observed + QUOTE_MAX_AGE_MS, expires);
  if (now >= usableUntil) return {status:'stale',reason:expires <= observed + QUOTE_MAX_AGE_MS ? 'The provider quote has expired.' : 'This observation is older than the 15-minute application limit.',usableUntil};
  return {status:'fresh',usableUntil};
}
