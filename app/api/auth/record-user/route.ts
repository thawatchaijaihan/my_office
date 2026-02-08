import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/firebaseAdmin";
import { recordUserToDb } from "@/lib/recordLoginUser";

export const runtime = "nodejs";

/**
 * POST /api/auth/record-user
 * รับ Bearer token จากผู้ใช้ที่ล็อกอินแล้ว → บันทึก uid, email, displayName, photoURL ลง Realtime Database (users/{uid})
 * เรียกจากฝั่ง client หลังล็อกอิน เพื่อให้แอดมินเห็นรายชื่อและไปกำหนดสิทธิ์ใน dashboardAdmins ได้
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const user = await verifyFirebaseToken(bearerToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const ok = await recordUserToDb(user.uid, {
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
  });

  if (!ok) {
    console.warn("[record-user] Realtime Database not configured or write failed (ตรวจ FIREBASE_DATABASE_URL)");
    return NextResponse.json(
      { error: "Realtime Database not configured or write failed" },
      { status: 503 }
    );
  }

  console.log("[record-user] บันทึก users/" + user.uid + " แล้ว");
  return NextResponse.json({ ok: true });
}
