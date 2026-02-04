/**
 * Environment configuration
 * ค่าจะถูก validate ตอน runtime ใน webhook
 */

function getEnv(key: string): string {
  return process.env[key] ?? "";
}

export const config = {
  line: {
    channelSecret: getEnv("LINE_CHANNEL_SECRET"),
    channelAccessToken: getEnv("LINE_CHANNEL_ACCESS_TOKEN"),
  },
  admin: {
    apiKey: getEnv("ADMIN_API_KEY"),
    lineUserIds: (process.env.ADMIN_LINE_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
  google: {
    serviceAccountKeyBase64: getEnv("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64"),
    sheetsId: getEnv("GOOGLE_SHEETS_ID"),
  },
  gemini: {
    apiKey: getEnv("GEMINI_API_KEY"),
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  },
} as const;
