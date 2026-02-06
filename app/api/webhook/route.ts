import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import type { WebhookRequestBody } from "@line/bot-sdk";
import { config } from "@/lib/config";
import { handleEvents } from "@/lib/webhook/handleEvents";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", config.line.channelSecret)
    .update(body)
    .digest("base64");
  return hash === signature;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    logger.warn({ message: "Webhook rate limited", eventType: "rate_limit" });
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("x-line-signature") ?? "";

    if (!verifySignature(body, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body) as WebhookRequestBody;
    const events = payload.events ?? [];

    if (events.length > 0) {
      await handleEvents(events);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({
      message: "Webhook handler error",
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
