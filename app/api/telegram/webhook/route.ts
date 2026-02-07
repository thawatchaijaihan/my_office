import { NextRequest, NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegram/handleTelegram";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    logger.warn({ message: "Telegram webhook rate limited", eventType: "rate_limit" });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const payload = (await req.json()) as unknown;
    await handleTelegramUpdate(payload as any);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({
      message: "Telegram webhook handler error",
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
