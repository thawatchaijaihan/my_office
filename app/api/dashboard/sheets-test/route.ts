import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { getCachedIndexRows } from "@/lib/indexRowsCache";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/sheets-test
 * ทดสอบการเชื่อมต่อ Google Sheet (ใช้สิทธิ์เดียวกับ dashboard)
 * คืน { ok: true, rowCount: N } หรือ { ok: false, error: "ข้อความ" }
 */
export async function GET(req: NextRequest) {
  const authorized = await isDashboardAuthorized(req);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ (401)" }, { status: 401 });
  }

  try {
    const rows = await getCachedIndexRows();
    return NextResponse.json({ ok: true, rowCount: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
