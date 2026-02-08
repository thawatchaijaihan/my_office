import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/ping
 * ทดสอบว่า backend รับ request ได้และตรวจสิทธิ์ผ่าน (ไม่อ่าน Sheet) — ใช้เวลาน้อย
 */
export async function GET(req: NextRequest) {
  const authorized = await isDashboardAuthorized(req);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ (401)" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
