import type { WebhookEvent } from "@line/bot-sdk";
import { config } from "@/lib/config";
import { replyText } from "@/lib/line";
import { logWebhookError } from "@/lib/logger";
import { isAdminUserId, isMyIdCommand } from "./utils";
import { handleAdminText } from "./handleText";
import { handleImage } from "./handleImage";
import {
  handlePostbackReview,
  handlePostbackSlipIntent,
  handlePostbackOtherIntent,
} from "./handlePostback";

function getUserId(event: WebhookEvent): string | undefined {
  const s = event.source;
  if (!s) return undefined;
  return "userId" in s ? s.userId : undefined;
}

export async function handleEvents(events: WebhookEvent[]): Promise<void> {
  for (const event of events) {
    const replyToken = "replyToken" in event ? event.replyToken : undefined;
    if (!replyToken) continue;

    const userId = getUserId(event);
    const isAdmin = isAdminUserId(userId);
    const adminConfigured = config.admin.lineUserIds.length > 0;

    try {
      if (event.type === "message" && event.message?.type === "text") {
        const text = (event.message as { text?: string })?.text?.trim();
        if (!text) continue;

        if (isMyIdCommand(text)) {
          if (adminConfigured && !isAdmin) continue;
          if (!userId) {
            await replyText(
              replyToken,
              "ไม่พบ LINE userId ในอีเวนต์นี้ (ลองทักแชท 1:1 กับบอท หรือเช็คการตั้งค่า LINE channel)"
            );
            continue;
          }
          await replyText(
            replyToken,
            ["LINE userId ของคุณคือ", userId].join("\n")
          );
          continue;
        }

        if (!adminConfigured) {
          await replyText(
            replyToken,
            [
              "ระบบอยู่ในโหมดตั้งค่า",
              "เพื่อให้บอทคุยกับคุณคนเดียว ให้พิมพ์: myid",
              "แล้วนำ userId ที่ได้ไปใส่ใน secret ADMIN_LINE_USER_IDS (App Hosting) และ rollout อีกครั้ง",
            ].join("\n")
          );
          continue;
        }

        if (!isAdmin) continue;

        await handleAdminText({ replyToken, text });
        continue;
      }

      if (!isAdmin) continue;

      if (event.type === "message" && event.message?.type === "image") {
        await handleImage({
          replyToken,
          messageId: event.message.id,
        });
        continue;
      }

      if (event.type === "postback") {
        const data = event.postback?.data ?? "";
        const url = new URL("https://dummy.local/?" + data);
        const action = url.searchParams.get("action");
        const intent = url.searchParams.get("intent");
        const messageId = url.searchParams.get("messageId");

        if (action === "review") {
          const row = Number(url.searchParams.get("row") ?? "");
          const result = url.searchParams.get("result");
          await handlePostbackReview({ replyToken, row, result });
          continue;
        }

        if (intent === "slip" && messageId) {
          await handlePostbackSlipIntent({ replyToken, messageId });
          continue;
        }

        if (intent === "other") {
          await handlePostbackOtherIntent({ replyToken });
          continue;
        }

        await replyText(replyToken, "ฟังก์ชันนี้ยังไม่รองรับ");
        continue;
      }
    } catch (err) {
      logWebhookError({
        userId,
        eventType: event.type,
        message: "Event handler error",
        error: err,
      });
      await replyText(
        replyToken,
        "ขออภัย เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะครับ"
      );
    }
  }
}
