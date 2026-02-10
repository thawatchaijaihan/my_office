import { NextRequest, NextResponse } from "next/server";
import { getRealtimeDb, verifyFirebaseToken } from "@/lib/firebaseAdmin";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";

export const runtime = "nodejs";

const LOG = (msg: string, ...args: unknown[]) =>
  console.log("[Dashboard Review Preferences API]", msg, ...args);

const PATH_FOR = (uid: string) => `dashboardPreferences/${uid}/review`;

export async function GET(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearer) {
    // โหมด dev หรือยังไม่ล็อกอิน → ไม่มี prefs ให้โหลด
    return NextResponse.json({}, { status: 200 });
  }

  const user = await verifyFirebaseToken(bearer);
  const db = getRealtimeDb();
  if (!user || !db) {
    LOG("skip load prefs (no user or db)");
    return NextResponse.json({}, { status: 200 });
  }

  try {
    const snap = await db.ref(PATH_FOR(user.uid)).get();
    const val = snap.val() ?? {};
    return NextResponse.json(val, { status: 200 });
  } catch (e) {
    LOG("load prefs error", e);
    return NextResponse.json({}, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearer) {
    // ไม่ต้อง error แข็ง ใช้ prefs เฉพาะตอนมี user เท่านั้น
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const user = await verifyFirebaseToken(bearer);
  const db = getRealtimeDb();
  if (!user || !db) {
    LOG("skip save prefs (no user or db)");
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as unknown;
    await db.ref(PATH_FOR(user.uid)).set({
      ...(typeof body === "object" && body !== null ? body : {}),
      updatedAt: Date.now(),
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    LOG("save prefs error", e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

