/**
 * Structured logging for webhook and handlers.
 * Outputs JSON for easy parsing in Cloud Logging / monitoring.
 */

export type LogLevel = "info" | "warn" | "error";

export type LogPayload = {
  level: LogLevel;
  message: string;
  userId?: string;
  eventType?: string;
  eventId?: string;
  error?: string;
  stack?: string;
};

function formatPayload(payload: LogPayload): string {
  return JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

function log(level: LogLevel, payload: Omit<LogPayload, "level">): void {
  const line = formatPayload({ ...payload, level });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (payload: Omit<LogPayload, "level">) => log("info", payload),
  warn: (payload: Omit<LogPayload, "level">) => log("warn", payload),
  error: (payload: Omit<LogPayload, "level">) => log("error", payload),
};

export function logWebhookError(params: {
  userId?: string;
  eventType?: string;
  message: string;
  error: unknown;
}): void {
  const err = params.error instanceof Error ? params.error : new Error(String(params.error));
  logger.error({
    message: params.message,
    userId: params.userId,
    eventType: params.eventType,
    error: err.message,
    stack: err.stack,
  });
}
