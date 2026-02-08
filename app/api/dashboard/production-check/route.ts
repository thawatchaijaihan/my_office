import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getRealtimeDb } from "@/lib/firebaseAdmin";
import { readIndexRows } from "@/lib/passSheets";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/production-check?key=ADMIN_API_KEY
 * เช็กสถานะ production: FIREBASE_DATABASE_URL, การเชื่อมต่อ RTDB, Google Sheets
 * ต้องส่ง admin key (?key= หรือ x-admin-key) ถึงจะเข้าได้
 */
export async function GET(req: NextRequest) {
  const provided =
    req.headers.get("x-admin-key") ?? req.nextUrl.searchParams.get("key") ?? "";
  const expected = config.admin.apiKey;
  if (!expected || provided !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const firebaseDatabaseUrlSet = Boolean(
    process.env.FIREBASE_DATABASE_URL?.trim()
  );

  const result: {
    ok: boolean;
    firebaseDatabaseUrlSet: boolean;
    dbReachable: boolean;
    dbError?: string;
    dbEmailsCount?: number;
    dbUidsCount?: number;
    sheetsOk: boolean;
    sheetsError?: string;
    sheetsRowCount?: number;
  } = {
    ok: true,
    firebaseDatabaseUrlSet,
    dbReachable: false,
    sheetsOk: false,
  };

  // เช็ก Realtime Database
  const db = getRealtimeDb();
  if (!db) {
    if (!firebaseDatabaseUrlSet) {
      result.dbError = "FIREBASE_DATABASE_URL ไม่ได้ตั้งค่า";
    } else {
      result.dbError = "getRealtimeDb() คืน null (ตรวจ credential / IAM)";
    }
  } else {
    try {
      const ref = db.ref("dashboardAdmins");
      const snapshot = await ref.once("value");
      const val = snapshot.val();
      result.dbReachable = true;
      if (val && typeof val === "object") {
        result.dbEmailsCount = typeof val.emails === "object" ? Object.keys(val.emails).length : 0;
        result.dbUidsCount = typeof val.uids === "object" ? Object.keys(val.uids).length : 0;
      }
    } catch (e) {
      result.dbReachable = false;
      result.dbError = e instanceof Error ? e.message : String(e);
      result.ok = false;
    }
  }

  // เช็ก Google Sheets
  try {
    const rows = await readIndexRows();
    result.sheetsOk = true;
    result.sheetsRowCount = rows.length;
  } catch (e) {
    result.sheetsOk = false;
    result.sheetsError = e instanceof Error ? e.message : String(e);
    result.ok = false;
  }

  return NextResponse.json(result);
}
