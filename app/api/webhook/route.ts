import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { chat } from "@/lib/gemini";
import { replyText } from "@/lib/line";
import { config } from "@/lib/config";

/**
 * Verify LINE webhook signature
 */
function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", config.line.channelSecret)
    .update(body)
    .digest("base64");
  return hash === signature;
}

/**
 * Handle incoming webhook events
 */
type LineEvent = {
  type: string;
  replyToken?: string;
  message?: { type: string; text?: string };
};

async function handleEvents(events: LineEvent[]) {
  for (const event of events) {
    if (event.type !== "message" || event.message?.type !== "text") {
      continue;
    }

    const replyToken = event.replyToken;
    const text = (event.message as { text?: string })?.text?.trim();

    if (!replyToken || !text) continue;

    try {
      const aiResponse = await chat(text);
      await replyText(replyToken, aiResponse);
    } catch (err) {
      console.error("[Webhook] Error:", err);
      await replyText(
        replyToken,
        "ขออภัย เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะครับ"
      );
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-line-signature") ?? "";

    if (!verifySignature(body, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body) as { events?: unknown[] };
    const events = payload.events ?? [];

    if (events.length > 0) {
      await handleEvents(events as LineEvent[]);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Webhook] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
