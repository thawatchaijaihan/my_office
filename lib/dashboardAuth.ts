import { NextRequest } from "next/server";
import { config } from "./config";
import { verifyFirebaseToken } from "./firebaseAdmin";

/**
 * ตรวจว่า request นี้มีสิทธิ์เข้า API แดชบอร์ดหรือไม่
 * ลำดับการตรวจ:
 * 1. Firebase Auth token (Authorization: Bearer <idToken>) ถ้ามี ADMIN_FIREBASE_*
 * 2. localhost / ALLOWED_DASHBOARD_HOSTS = อนุญาต
 * 3. x-admin-key หรือ ?key= ตรงกับ ADMIN_API_KEY
 */
export async function isDashboardAuthorized(req: NextRequest): Promise<boolean> {
  const host = (req.headers.get("host") ?? "").split(":")[0];
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // 1. Firebase Auth - ต้องมี allowlist (email หรือ uid) ถึงจะใช้
  const useFirebaseAuth =
    config.admin.firebaseEmails.length > 0 || config.admin.firebaseUids.length > 0;
  if (bearerToken && useFirebaseAuth) {
    const user = await verifyFirebaseToken(bearerToken);
    if (user) {
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
