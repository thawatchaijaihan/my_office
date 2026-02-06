/**
 * Retry helper for transient external API failures (exponential backoff).
 */

export type RetryOptions = {
  maxAttempts?: number;
  baseMs?: number;
  maxMs?: number;
  isRetryable?: (error: unknown) => boolean;
};

const defaultIsRetryable = (error: unknown): boolean => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("network")) return true;
    if (msg.includes("429") || msg.includes("503") || msg.includes("502") || msg.includes("500")) return true;
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const s = (error as { status?: number }).status;
    if (s === 429 || s === 502 || s === 503 || (s && s >= 500)) return true;
  }
  return false;
};

/**
 * Run an async function with retries (exponential backoff).
 * Only retries on retryable errors (network, 5xx, 429).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseMs = 500,
    maxMs = 5000,
    isRetryable = defaultIsRetryable,
  } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isRetryable(error)) throw error;
      const delay = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
