#!/usr/bin/env node
/**
 * ใส่ allowlist แดชบอร์ดจาก ADMIN_FIREBASE_EMAILS / ADMIN_FIREBASE_UIDS ลง Realtime Database
 * ใช้ FIREBASE_DATABASE_URL + GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 จาก .env.local
 * รัน: node scripts/seed-dashboard-admins.mjs
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

function encodeEmail(email) {
  return email
    .toLowerCase()
    .trim()
    .replace(/\./g, "_dot_")
    .replace(/@/g, "_at_");
}

async function main() {
  if (!existsSync(envPath)) {
    console.error(".env.local ไม่พบ");
    process.exit(1);
  }
  const env = parseEnv(readFileSync(envPath, "utf-8"));
  const dbUrl = (env.FIREBASE_DATABASE_URL || "").trim();
  const b64 = (env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 || "").trim();
  const emailsStr = env.ADMIN_FIREBASE_EMAILS || "";
  const uidsStr = env.ADMIN_FIREBASE_UIDS || "";

  const emails = emailsStr.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const uids = uidsStr.split(",").map((s) => s.trim()).filter(Boolean);

  if (!dbUrl || !b64) {
    console.error("ต้องมี FIREBASE_DATABASE_URL และ GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 ใน .env.local");
    process.exit(1);
  }

  const expectedUrl = "https://my-office-713-default-rtdb.asia-southeast1.firebasedatabase.app";
  if (dbUrl !== expectedUrl) {
    console.error("FIREBASE_DATABASE_URL ต้องชี้ไปที่ my-office-713 (asia-southeast1):", expectedUrl);
    process.exit(1);
  }

  if (emails.length === 0 && uids.length === 0) {
    console.log("ไม่มี ADMIN_FIREBASE_EMAILS หรือ ADMIN_FIREBASE_UIDS ใน .env.local — ไม่มีอะไรให้ seed");
    process.exit(0);
  }

  let json;
  try {
    json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  } catch {
    console.error("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 decode ไม่ได้");
    process.exit(1);
  }

  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getDatabase } = await import("firebase-admin/database");

  const app = initializeApp({ credential: cert(json), databaseURL: dbUrl }, "seed-dashboard-admins");
  const db = getDatabase(app);

  const updates = {};
  for (const email of emails) {
    const key = encodeEmail(email);
    updates[`dashboardAdmins/emails/${key}`] = { allow: true, addedAt: Date.now() };
  }
  for (const uid of uids) {
    updates[`dashboardAdmins/uids/${uid}`] = { allow: true, addedAt: Date.now() };
  }

  try {
    await db.ref().update(updates);
    console.log("Seed dashboardAdmins เสร็จ:");
    if (emails.length) console.log("  emails:", emails.length, "→", emails.join(", "));
    if (uids.length) console.log("  uids:", uids.length);
  } catch (e) {
    console.error("Seed ผิดพลาด:", e.message || e);
    process.exit(1);
  }

  console.log("--- เสร็จ ---");
}

main();
