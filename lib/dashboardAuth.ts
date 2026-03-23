import { NextRequest } from "next/server";
import { config } from "./config";
import { verifyFirebaseToken } from "./firebaseAdmin";
import { isEmailAllowedInDb, isUidAllowedInDb } from "./dashboardAdminsDb";

const LOG = (msg: string, ...args: unknown[]) => console.log("[dashboardAuth]", msg, ...args);

/**
 * ตรวจว่า request นี้มีสิทธิ์เข้า API แดชบอร์ดหรือไม่
 * ให้เฉพาะผู้ที่ได้รับการอนุมัติ (อยู่ใน allowlist) เข้าถึงได้ โดยใช้ Bearer token จาก Firebase เท่านั้น
 * ADMIN_API_KEY (secret adminApiKey) ไม่ใช้สำหรับ API แดชบอร์ด — ใช้เฉพาะใน /api/admin/* (เช่น sync-personnel)
 *
 * ลำดับการตรวจ:
 * 1. Firebase Auth Bearer token → ตรวจ allowlist (Realtime Database หรือ ADMIN_FIREBASE_*)
 * 2. โหมด dev: ไม่มี ADMIN_API_KEY หรือ localhost = อนุญาต
 */
export async function isDashboardAuthorized(req: NextRequest): Promise<boolean> {
  const host = (req.headers.get("host") ?? "").split(":")[0];
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // 1. Firebase Auth - เฉพาะผู้ที่อยู่ใน allowlist (อนุมัติแล้ว) เท่านั้น
  if (bearerToken) {
    const authPhaseStart = Date.now();
    const t0 = Date.now();
    const user = await verifyFirebaseToken(bearerToken);
    const verifyMs = Date.now() - t0;
    LOG("verifyFirebaseToken ใช้เวลา", verifyMs, "ms", user ? "ได้ user" : "ไม่ผ่าน");
    if (user) {
      const t1 = Date.now();
      const emailAllowedDb = await isEmailAllowedInDb(user.email);
      const emailMs = Date.now() - t1;
      LOG("isEmailAllowedInDb ใช้เวลา", emailMs, "ms, ผล:", emailAllowedDb);
      const t2 = Date.now();
      const uidAllowedDb = await isUidAllowedInDb(user.uid);
      const uidMs = Date.now() - t2;
      LOG("isUidAllowedInDb ใช้เวลา", uidMs, "ms, ผล:", uidAllowedDb);
      LOG("ตรวจสิทธิ์รวม (token+email+uid):", Date.now() - authPhaseStart, "ms");
      if (emailAllowedDb || uidAllowedDb) return true;

      const emailOk =
        config.admin.firebaseEmails.length > 0 &&
        user.email &&
        config.admin.firebaseEmails.includes(user.email.toLowerCase());
      const uidOk =
        config.admin.firebaseUids.length > 0 &&
        config.admin.firebaseUids.includes(user.uid);
      if (emailOk || uidOk) return true;
    }
  }

  // 2. โหมด dev: ไม่มี ADMIN_API_KEY = อนุญาต (รัน npm run dev)
  const expected = config.admin.apiKey;
  if (!expected) return true;

  // 3. โหมด dev: localhost
  if (/^localhost$/.test(host) || /^127\.0\.0\.1$/.test(host)) return true;

  // ไม่รับ x-admin-key / ?key= สำหรับ API แดชบอร์ด — ให้เฉพาะผู้ที่อนุมัติ (Bearer) เท่านั้น
  return false;
}
