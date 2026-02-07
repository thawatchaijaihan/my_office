import { NextRequest } from "next/server";
import { config } from "./config";

/**
 * ตรวจว่า request นี้มีสิทธิ์เข้า API แดชบอร์ดหรือไม่
 * - ถ้าไม่มี ADMIN_API_KEY ใน env = อนุญาตทุก host
 * - localhost / 127.0.0.1 = อนุญาตโดยไม่ต้องใส่ key
 * - host ที่อยู่ใน ALLOWED_DASHBOARD_HOSTS = อนุญาตโดยไม่ต้องใส่ key
 * - นอกนั้นต้องส่ง x-admin-key header หรือ query ?key=... ตรงกับ ADMIN_API_KEY
 */
export function isDashboardAuthorized(req: NextRequest): boolean {
  const expected = config.admin.apiKey;
  if (!expected) return true;

  const host = (req.headers.get("host") ?? "").split(":")[0];
  if (/^localhost$/.test(host) || /^127\.0\.0\.1$/.test(host)) return true;

  const allowed = config.admin.allowedDashboardHosts;
  if (allowed.length > 0 && allowed.some((h) => host === h || host.endsWith("." + h))) return true;

  const provided =
    req.headers.get("x-admin-key") ?? req.nextUrl.searchParams.get("key") ?? "";
  return provided === expected;
}
