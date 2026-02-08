import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { syncPersonnelToFirestore } from "@/lib/personnelSheets";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const expected = config.admin.apiKey;
  if (!expected) return false;
  const provided = req.headers.get("x-admin-key") ?? req.headers.get("x-api-key") ?? "";
  return provided === expected;
}

/**
 * POST /api/admin/sync-personnel
 * อ่านแท็บ รายชื่อกำลังพล, index, bank จากชีต (GOOGLE_SHEETS_ID หรือ GOOGLE_SHEETS_ID_PERSONNEL)
 * แล้วรวมเป็นฐานข้อมูลกำลังพลและบันทึกลง Firestore collection "personnel"
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncPersonnelToFirestore();
    return NextResponse.json({
      ok: result.errors.length === 0,
      read: result.read,
      written: result.written,
      errors: result.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-personnel] Error:", err);
    return NextResponse.json(
      { error: "Sync failed", message },
      { status: 500 }
    );
  }
}
