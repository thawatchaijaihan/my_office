import { NextRequest } from "next/server";
import { config } from "./config";
import { verifyFirebaseToken } from "./firebaseAdmin";
import { isEmailAllowedInDb, isUidAllowedInDb } from "./dashboardAdminsDb";

const LOG = (msg: string, ...args: unknown[]) => console.log("[dashboardAuth]", msg, ...args);

/**
 * ตรวจว่า request นี้มีสิทธิ์เข้า API แดชบอร์ดหรือไม่
 * ลำดับการตรวจ:
 * 1. Firebase Auth token → ตรวจ allowlist จาก Realtime Database (dashboardAdmins/emails, uids) หรือจาก env (ADMIN_FIREBASE_*)
 * 2. localhost / ALLOWED_DASHBOARD_HOSTS = อนุญาต
 * 3. x-admin-key หรือ ?key= ตรงกับ ADMIN_API_KEY
 */
export async function isDashboardAuthorized(req: NextRequest): Promise<boolean> {
  const host = (req.headers.get("host") ?? "").split(":")[0];
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // 1. Firebase Auth - ถ้ามี Bearer token ให้ตรวจสิทธิ์จาก Realtime Database ก่อน แล้ว fallback เป็น env
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
        config.admin.firebaseEmails.length === 0 ||
        (user.email && config.admin.firebaseEmails.includes(user.email.toLowerCase()));
      const uidOk =
        config.admin.firebaseUids.length === 0 ||
        config.admin.firebaseUids.includes(user.uid);
      if (emailOk && uidOk) return true;
    }
  }

  // 2. ไม่มี ADMIN_API_KEY = อนุญาตทุก host (โหมด dev)
  const expected = config.admin.apiKey;
  if (!expected) return true;

  // 3. localhost / 127.0.0.1
  if (/^localhost$/.test(host) || /^127\.0\.0\.1$/.test(host)) return true;

  // 4. ALLOWED_DASHBOARD_HOSTS
  const allowed = config.admin.allowedDashboardHosts;
  if (allowed.length > 0 && allowed.some((h) => host === h || host.endsWith("." + h))) return true;

  // 5. x-admin-key หรือ ?key=
  const provided =
    req.headers.get("x-admin-key") ?? req.nextUrl.searchParams.get("key") ?? "";
  return provided === expected;
}
