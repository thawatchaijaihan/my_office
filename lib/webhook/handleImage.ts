import { replyMessages, replyText, type LineMessage } from "@/lib/line";
import { flexIntentMessage } from "@/lib/lineFlexMessages";

export async function handleImage(params: {
  replyToken: string;
  messageId: string | undefined;
}): Promise<void> {
  if (!params.messageId) {
    await replyText(params.replyToken, "ไม่พบ messageId ของรูปภาพ");
    return;
  }
  await replyMessages(params.replyToken, [
    flexIntentMessage({ messageId: params.messageId }) as LineMessage,
  ]);
}
