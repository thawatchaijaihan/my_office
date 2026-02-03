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
  gemini: {
    apiKey: getEnv("GEMINI_API_KEY"),
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  },
} as const;
