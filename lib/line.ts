import { Client, type Message } from "@line/bot-sdk";
import { config } from "./config";

let _client: Client | null = null;

/**
 * LINE Messaging API client (lazy init for build-time)
 */
function getClient(): Client {
  if (!_client) {
    const token = config.line.channelAccessToken;
    if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
    _client = new Client({ channelAccessToken: token });
  }
  return _client;
}

/**
 * Reply text message to user
 */
export async function replyText(
  replyToken: string,
  text: string
): Promise<void> {
  await getClient().replyMessage(replyToken, { type: "text", text });
}

export type LineMessage = Message;

export async function replyMessages(
  replyToken: string,
  messages: LineMessage[]
): Promise<void> {
  await getClient().replyMessage(replyToken, messages);
}

export async function pushMessages(
  to: string,
  messages: LineMessage[]
): Promise<void> {
  await getClient().pushMessage(to, messages);
}

/**
 * Fetch binary content of a LINE message (image, etc.)
 */
export async function getMessageContentBuffer(
  messageId: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const token = config.line.channelAccessToken;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");

  const res = await fetch(
    `https://api-data.line.me/v2/bot/message/${encodeURIComponent(
      messageId
    )}/content`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch message content (${res.status}): ${text || res.statusText}`
    );
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}
