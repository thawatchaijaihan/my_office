#!/usr/bin/env node
/**
 * ซิงก์ฐานข้อมูลกำลังพลจาก Google Sheets → Firestore
 * เรียก API POST /api/admin/sync-personnel
 *
 * ใช้: node scripts/sync-personnel.mjs
 * ต้องมี .env.local: ADMIN_API_KEY, และ GOOGLE_SHEETS_ID หรือ GOOGLE_SHEETS_ID_PERSONNEL
 * ถ้ารันกับเซิร์ฟเวอร์ local: npm run dev แล้ว node scripts/sync-personnel.mjs
 * ถ้ารันกับ production: ตั้ง SYNC_PERSONNEL_URL=https://your-app.url แล้ว node scripts/sync-personnel.mjs
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return {};
  const content = readFileSync(path, "utf8");
  const out = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

const env = loadEnv();
const baseUrl = env.SYNC_PERSONNEL_URL || process.env.SYNC_PERSONNEL_URL || "http://localhost:3000";
const apiKey = env.ADMIN_API_KEY || process.env.ADMIN_API_KEY;

if (!apiKey) {
  console.error("ต้องตั้ง ADMIN_API_KEY ใน .env.local หรือ env");
  process.exit(1);
}

async function main() {
  const url = `${baseUrl.replace(/\/$/, "")}/api/admin/sync-personnel`;
  console.log("เรียก", url, "...");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": apiKey },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("ผิดพลาด:", res.status, data);
    process.exit(1);
  }
  console.log("ผลลัพธ์:", data);
  if (data.errors?.length) {
    console.error("Errors:", data.errors);
    process.exit(1);
  }
  console.log("ซิงก์เสร็จ: อ่าน", data.read, "รายการ, บันทึก", data.written, "รายการ");
}

main();
