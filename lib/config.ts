/**
 * Environment configuration
 * ค่าจะถูก validate ตอน runtime ใน webhook
 */

function getEnv(key: string): string {
  return (process.env[key] ?? "").trim();
}

export const config = {
  line: {
    channelSecret: getEnv("LINE_CHANNEL_SECRET"),
    channelAccessToken: getEnv("LINE_CHANNEL_ACCESS_TOKEN"),
  },
  telegram: {
    botToken: getEnv("TELEGRAM_BOT_TOKEN"),
    adminUserIds: (process.env.ADMIN_TELEGRAM_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== "NONE"),
  },
  admin: {
    apiKey: getEnv("ADMIN_API_KEY"),
    /** โฮสต์ที่เข้าแดชบอร์ดได้โดยไม่ต้องใส่ key (คั่นด้วย comma) เช่น โฮสต์จาก app hosting */
    allowedDashboardHosts: (process.env.ALLOWED_DASHBOARD_HOSTS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    lineUserIds: (process.env.ADMIN_LINE_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== "NONE"),
    /** อีเมลหรือ UID ที่เข้าแดชบอร์ดได้ผ่าน Firebase Auth (คั่นด้วย comma) */
    firebaseEmails: (process.env.ADMIN_FIREBASE_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    firebaseUids: (process.env.ADMIN_FIREBASE_UIDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
  google: {
    serviceAccountKeyBase64: getEnv("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64"),
    sheetsId: getEnv("GOOGLE_SHEETS_ID"),
    indexSheetGid: process.env.INDEX_SHEET_GID
      ? Number(process.env.INDEX_SHEET_GID.trim())
      : undefined,
    slipSheetGid: process.env.SLIP_SHEET_GID
      ? Number(process.env.SLIP_SHEET_GID.trim())
      : undefined,
  },
  gemini: {
    apiKey: getEnv("GEMINI_API_KEY"),
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite",
  },
} as const;
