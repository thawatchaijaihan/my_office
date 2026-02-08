import { config } from "@/lib/config";
import { withRetry } from "@/lib/retry";
import { logger } from "@/lib/logger";

type TelegramPhotoSize = {
  file_id: string;
  width: number;
  height: number;
  file_size?: number;
};

type TelegramInlineKeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; web_app: { url: string } };

type TelegramInlineKeyboard = {
  inline_keyboard: TelegramInlineKeyboardButton[][];
};

function getTelegramBaseUrl(): string {
  const token = config.telegram.botToken;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return `https://api.telegram.org/bot${token}`;
}

async function telegramRequest<T>(path: string, body: unknown): Promise<T> {
  const url = `${getTelegramBaseUrl()}/${path}`;
  const res = await withRetry(() =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    throw new Error(json.description || "Telegram API error");
  }
  return json.result as T;
}

export async function sendTelegramMessage(params: {
  chatId: number;
  text: string;
  replyToMessageId?: number;
  inlineKeyboard?: TelegramInlineKeyboard;
  parseMode?: "HTML" | "MarkdownV2";
}): Promise<void> {
  try {
    await telegramRequest("sendMessage", {
    chat_id: params.chatId,
    text: params.text,
    reply_to_message_id: params.replyToMessageId,
    reply_markup: params.inlineKeyboard,
    parse_mode: params.parseMode,
    });
  } catch (err) {
    logger.error({
      message: "Telegram sendMessage failed",
      eventType: "telegram_send",
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }
}

export async function answerTelegramCallback(params: {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}): Promise<void> {
  await telegramRequest("answerCallbackQuery", {
    callback_query_id: params.callbackQueryId,
    text: params.text,
    show_alert: params.showAlert,
  });
}

export function getLargestPhoto(photos: TelegramPhotoSize[]): TelegramPhotoSize | null {
  if (!photos || photos.length === 0) return null;
  return photos.reduce((a, b) => (a.file_size ?? 0) >= (b.file_size ?? 0) ? a : b);
}

export async function getTelegramFileBuffer(params: {
  fileId: string;
}): Promise<{ buffer: Buffer; contentType: string }> {
  const file = await telegramRequest<{ file_path: string }>("getFile", {
    file_id: params.fileId,
  });
  const token = config.telegram.botToken;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const res = await withRetry(() => fetch(url));
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch Telegram file (${res.status}): ${text || res.statusText}`
    );
  }
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

export function buildTelegramInlineKeyboard(
  rows: Array<Array<{ text: string; data: string }>>
): TelegramInlineKeyboard {
  return {
    inline_keyboard: rows.map((r) =>
      r.map((b) => ({ text: b.text, callback_data: b.data }))
    ),
  };
}

/** สร้าง inline keyboard ที่มีปุ่มเปิด Web App (เปิดในแอป Telegram) */
export function buildTelegramWebAppKeyboard(
  text: string,
  url: string
): TelegramInlineKeyboard {
  return {
    inline_keyboard: [[{ text, web_app: { url } }]],
  };
}

/** สร้าง inline keyboard ปุ่มลิงก์ธรรมดา — กดค้างแล้วเลือก "เปิดในเบราว์เซอร์" ได้ (เหมาะกับล็อกอิน Google) */
export function buildTelegramUrlKeyboard(
  text: string,
  url: string
): TelegramInlineKeyboard {
  return {
    inline_keyboard: [[{ text, url }]],
  };
}

/** ลบเมนูปุ่ม custom ออก (ใช้ default ของ Telegram — ไม่มีปุ่มแดชบอร์ดข้างคลิป) */
export async function setTelegramMenuButtonToDefault(): Promise<void> {
  await telegramRequest("setChatMenuButton", {
    menu_button: { type: "default" },
  });
}

/** ตั้งค่า Menu button เป็นรายการคำสั่ง (ไม่ใช้ Web App — เปิดแดชบอร์ดผ่าน /dashboard แล้วกดปุ่มลิงก์) */
export async function setTelegramMenuButtonToCommands(): Promise<void> {
  await telegramRequest("setChatMenuButton", {
    menu_button: { type: "commands" },
  });
}

/** ตั้งค่า Menu button ให้เปิด Web App (เปิดเป็น Mini App ใน Telegram) — ถ้าไม่ต้องการ Mini App ให้ใช้ setTelegramMenuButtonToCommands แทน */
export async function setTelegramMenuButton(url: string): Promise<void> {
  await telegramRequest("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "แดชบอร์ด",
      web_app: { url },
    },
  });
}

/** ตั้งค่ารายการคำสั่งที่แสดงในเมนูบอท */
export async function setTelegramCommands(): Promise<void> {
  await telegramRequest("setMyCommands", {
    commands: [
      { command: "help", description: "แสดงรายการคำสั่ง" },
      { command: "myid", description: "ดู Telegram userId" },
      { command: "dashboard", description: "แดชบอร์ด" },
      { command: "sync", description: "ซิงก์ slip → index" },
      { command: "review", description: "รายการรอตรวจ" },
      { command: "invalid", description: "รายการข้อมูลไม่ถูกต้อง" },
      { command: "summary", description: "สรุปภาพรวม" },
    ],
  });
}
