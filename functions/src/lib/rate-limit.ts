import { AppError } from './errors';

type Bucket = { count: number; resetAt: number };

/** Simple in-memory sliding window (per Cloud Functions instance). */
const buckets = new Map<string, Bucket>();

/**
 * Throw resource-exhausted when `key` exceeds `limit` hits in `windowMs`.
 * Best-effort only — use App Check + Cloud Armor for hard limits.
 */
export function assertRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): void {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  cur.count += 1;
  if (cur.count > limit) {
    throw new AppError(
      'resource-exhausted',
      'Too many requests. Please wait a moment and try again.',
    );
  }
}

/** Prefer auth uid, else a coarse IP/UA fingerprint from the callable request. */
export function rateLimitKey(
  request: { auth?: { uid?: string } | null; rawRequest?: { ip?: string; headers?: Record<string, unknown> } },
  action: string,
): string {
  const uid = request.auth?.uid;
  if (uid) return `${action}:uid:${uid}`;
  const ip =
    (typeof request.rawRequest?.ip === 'string' && request.rawRequest.ip) ||
    'unknown';
  return `${action}:ip:${ip}`;
}
