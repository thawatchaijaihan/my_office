#!/usr/bin/env node
/**
 * เรียก POST /api/telegram/setup-menu เพื่ออัปเดตเมนูปุ่ม Telegram
 * อ่าน ADMIN_API_KEY จาก .env.local
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env.local");

function parseEnv(content) {
  const vars = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*ADMIN_API_KEY\s*=\s*(.*)$/);
    if (m) {
      let val = m[1].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      vars.ADMIN_API_KEY = val;
      break;
    }
  }
  return vars;
}

const baseUrl = "https://jaihan-assistant--jaihan-assistant.asia-southeast1.hosted.app";

if (!existsSync(envPath)) {
  console.error(".env.local not found");
  process.exit(1);
}
const env = parseEnv(readFileSync(envPath, "utf-8"));
const key = env.ADMIN_API_KEY;
if (!key) {
  console.error("ADMIN_API_KEY not found in .env.local");
  process.exit(1);
}

const url = `${baseUrl}/api/telegram/setup-menu?key=${encodeURIComponent(key)}`;

try {
  const res = await fetch(url, { method: "POST" });
  const text = await res.text();
  console.log("Status:", res.status, res.statusText);
  console.log("Body:", text);
  if (!res.ok) process.exit(1);
} catch (e) {
  console.error(e);
  process.exit(1);
}
