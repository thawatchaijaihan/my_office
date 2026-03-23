/**
 * In-memory rate limit for webhook (per IP).
 * Resets on cold start; suitable for single-instance or low-traffic.
 */

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // Telegram can send many events per delivery

const store = new Map<string, number[]>();

function prune(now: number, timestamps: number[]): number[] {
  const cutoff = now - WINDOW_MS;
  return timestamps.filter((t) => t > cutoff);
}

/**
 * Returns true if the request is allowed, false if rate limited.
 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  let timestamps = store.get(ip) ?? [];
  timestamps = prune(now, timestamps);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  timestamps.push(now);
  store.set(ip, timestamps);
  return true;
}

/**
 * Get client IP from request (NextRequest or headers).
 */
export function getClientIp(req: { headers: { get: (name: string) => string | null } }): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
