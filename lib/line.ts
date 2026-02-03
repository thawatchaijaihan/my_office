import { Client } from "@line/bot-sdk";
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
