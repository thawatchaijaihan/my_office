#!/usr/bin/env node
/**
 * เช็กการตั้งค่า production: FIREBASE_DATABASE_URL + Realtime DB (asia-southeast1)
 * ใช้ค่าจาก .env.local (เหมือนตอนรันบน production ถ้า secret ตั้งถูก)
 * รัน: node scripts/check-production.mjs
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env.local");

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

async function main() {
  if (!existsSync(envPath)) {
    console.error(".env.local ไม่พบ");
    process.exit(1);
  }
  const env = parseEnv(readFileSync(envPath, "utf-8"));
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").trim();
  const b64 = (env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 || "").trim();

  console.log("--- เช็ก production (ใช้ .env.local) ---\n");

  const expectedUrl = "https://jaihan-assistant.asia-southeast1.firebasedatabase.app";
  if (!dbUrl) {
    console.log("FIREBASE_DATABASE_URL: ไม่ได้ตั้ง → บน production ต้อง set secret firebaseDatabaseUrl");
  } else if (dbUrl !== expectedUrl) {
    console.log("FIREBASE_DATABASE_URL: ไม่ตรงกับ DB asia-southeast1 (jaihan-assistant)");
    console.log("  ควรเป็น:", expectedUrl);
    console.log("  ค่าปัจจุบัน:", dbUrl);
  } else {
    console.log("FIREBASE_DATABASE_URL: ตรงกับ jaihan-assistant (asia-southeast1)");
  }

  if (!b64) {
    console.log("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64: ไม่มี → ไม่สามารถทดสอบ RTDB ได้");
    process.exit(0);
  }

  let json;
  try {
    json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  } catch {
    console.log("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64: decode ไม่ได้ (ไม่ใช่ base64 หรือ JSON ไม่ถูกต้อง)");
    process.exit(1);
  }

  const clientEmail = json.client_email || "";
  console.log("Service account:", clientEmail ? `${clientEmail.slice(0, 30)}...` : "(ไม่มี client_email)");

  if (!dbUrl) {
    console.log("\nข้ามการทดสอบ Realtime DB (ไม่มี FIREBASE_DATABASE_URL)");
    process.exit(0);
  }
  if (dbUrl !== expectedUrl) {
    console.log("\nข้ามการทดสอบ Realtime DB (แก้ FIREBASE_DATABASE_URL ใน .env.local ก่อน)");
    process.exit(1);
  }

  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getDatabase } = await import("firebase-admin/database");

  try {
    const app = initializeApp({ credential: cert(json), databaseURL: dbUrl }, "check-production");
    const db = getDatabase(app);
    const snapshot = await db.ref("dashboardAdmins").once("value");
    const val = snapshot.val();
    const emailsCount = val?.emails && typeof val.emails === "object" ? Object.keys(val.emails).length : 0;
    const uidsCount = val?.uids && typeof val.uids === "object" ? Object.keys(val.uids).length : 0;
    console.log("\nRealtime Database: เชื่อมต่อได้");
    console.log("  dashboardAdmins/emails:", emailsCount, "รายการ");
    console.log("  dashboardAdmins/uids:", uidsCount, "รายการ");
    if (emailsCount === 0 && uidsCount === 0) {
      console.log("  → ยังไม่มี allowlist ใน DB นี้ (ใช้ ADMIN_FIREBASE_EMAILS/UIDS ใน env เป็น fallback หรือเพิ่มใน Firebase Console)");
    }
  } catch (e) {
    console.error("\nRealtime Database: ผิดพลาด");
    console.error("  ", e.message || e);
    if (String(e.message || e).includes("credential") || String(e.message || e).includes("invalid")) {
      console.error("  → ให้ service account มี role Firebase Realtime Database Admin (ดู docs/FIREBASE-RTDB-IAM.md)");
    }
    process.exit(1);
  }

  console.log("\n--- เสร็จ ---");
}

main();
