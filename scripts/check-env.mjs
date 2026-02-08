#!/usr/bin/env node
/**
 * ตรวจสอบว่า .env.local มีตัวแปรที่จำเป็นหรือไม่ (ไม่แสดงค่า)
 * รัน: node scripts/check-env.mjs
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env.local");

const required = [
  "TELEGRAM_BOT_TOKEN",
  "ADMIN_TELEGRAM_USER_IDS",
  "GEMINI_API_KEY",
  "GOOGLE_SERVICE_ACCOUNT_KEY_BASE64",
  "GOOGLE_SHEETS_ID",
];

const requiredForDashboardLogin = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

function parseEnv(content) {
  const vars = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      vars[key] = val;
    }
  }
  return vars;
}

function hasValue(v) {
  return typeof v === "string" && v.trim().length > 0;
}

if (!existsSync(envPath)) {
  console.error(".env.local ไม่พบ — สร้างจาก .env.example แล้วกรอกค่า");
  process.exit(1);
}

const content = readFileSync(envPath, "utf8");
const env = parseEnv(content);

const missingRequired = required.filter((k) => !hasValue(env[k]));
const missingFirebase = requiredForDashboardLogin.filter((k) => !hasValue(env[k]));

if (missingRequired.length > 0) {
  console.error("ตัวแปรที่จำเป็น (webhook + Sheets) ยังไม่มีค่า:", missingRequired.join(", "));
  process.exit(1);
}

if (missingFirebase.length > 0) {
  console.warn("ตัวแปรสำหรับล็อกอินแดชบอร์ด (Firebase Auth) ยังไม่มีค่า:", missingFirebase.join(", "));
  console.warn("→ ล็อกอินด้วย Google ที่หน้าหลัก/แดชบอร์ดจะใช้ไม่ได้ ต้องใช้ ?key=ADMIN_API_KEY แทน");
} else {
  console.log("Firebase Auth (แดชบอร์ด): ครบ");
}

if (hasValue(env.FIREBASE_DATABASE_URL)) {
  console.log("FIREBASE_DATABASE_URL: ตั้งแล้ว (ใช้ allowlist จาก Realtime DB)");
} else {
  console.warn("FIREBASE_DATABASE_URL: ไม่มี → ใช้ ADMIN_FIREBASE_EMAILS/UIDS จาก env แทน");
}

console.log("ตรวจ .env.local ครบ — ตัวแปรหลักมีค่าแล้ว");
