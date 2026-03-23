import { NextRequest, NextResponse } from "next/server";
import { getRealtimeDb, verifyFirebaseToken } from "@/lib/firebaseAdmin";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";

export const runtime = "nodejs";

const LOG = (msg: string, ...args: unknown[]) =>
  console.log("[Dashboard Review Preferences API]", msg, ...args);

const PATH_FOR = (uid: string) => `dashboardPreferences/${uid}/review`;
const ANONYMOUS_PATH = "dashboardPreferences/anonymous/review";

export async function GET(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const db = getRealtimeDb();

  if (bearer && db) {
    const user = await verifyFirebaseToken(bearer);
    if (user) {
      try {
        const snap = await db.ref(PATH_FOR(user.uid)).get();
        const val = snap.val() ?? {};
        LOG("GET: uid=", user.uid, "columnOrder keys=", Array.isArray((val as { columnOrder?: unknown }).columnOrder) ? (val as { columnOrder: unknown[] }).columnOrder.length : 0);
        return NextResponse.json(val, { status: 200 });
      } catch (e) {
        LOG("load prefs error", e);
        return NextResponse.json({}, { status: 200 });
      }
    }
  }

  if (!db) {
    LOG("GET: no db → return empty");
    return NextResponse.json({}, { status: 200 });
  }

  try {
    const snap = await db.ref(ANONYMOUS_PATH).get();
    const val = snap.val() ?? {};
    LOG("GET: anonymous path, columnOrder keys=", Array.isArray((val as { columnOrder?: unknown }).columnOrder) ? (val as { columnOrder: unknown[] }).columnOrder.length : 0);
    return NextResponse.json(val, { status: 200 });
  } catch (e) {
    LOG("load prefs (anonymous) error", e);
    return NextResponse.json({}, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let data: object = {};
  try {
    const body = (await req.json().catch(() => ({}))) as unknown;
    data = typeof body === "object" && body !== null ? (body as object) : {};
  } catch (e) {
    LOG("POST: parse body error", e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const db = getRealtimeDb();
  const columnOrder = Array.isArray((data as { columnOrder?: unknown }).columnOrder) ? (data as { columnOrder: unknown[] }).columnOrder : [];
  const payload = { ...data, updatedAt: Date.now() };

  if (bearer && db) {
    const user = await verifyFirebaseToken(bearer);
    if (user) {
      try {
        await db.ref(PATH_FOR(user.uid)).set(payload);
        LOG("POST: saved uid=", user.uid, "columnOrder length=", columnOrder.length);
        return NextResponse.json({ ok: true }, { status: 200 });
      } catch (e) {
        LOG("save prefs error", e);
        return NextResponse.json({ ok: false }, { status: 200 });
      }
    }
  }

  if (!db) {
    LOG("POST: no db → ok: false");
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  try {
    await db.ref(ANONYMOUS_PATH).set(payload);
    LOG("POST: saved anonymous, columnOrder length=", columnOrder.length);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    LOG("save prefs (anonymous) error", e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

