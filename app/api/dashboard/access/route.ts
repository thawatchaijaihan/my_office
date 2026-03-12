import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { verifyFirebaseToken } from "@/lib/firebaseAdmin";
import {
  listUsersFromDb,
  getAllowlistFromDb,
  addToAllowlistByUid,
  addToAllowlistByEmail,
  removeFromAllowlistByUid,
  removeFromAllowlistByEmail,
} from "@/lib/dashboardAdminsDb";

export const runtime = "nodejs";

const APPROVER_EMAIL = (process.env.NEXT_PUBLIC_DASHBOARD_APPROVER_EMAIL ?? "").trim().toLowerCase();

function isApprover(email: string | undefined | null): boolean {
  if (!APPROVER_EMAIL) return false;
  return (email ?? "").trim().toLowerCase() === APPROVER_EMAIL;
}

/** ตรวจว่า request นี้มาจาก approver (อีเมลตรงกับที่กำหนด) เท่านั้น */
async function requireApprover(req: NextRequest): Promise<{ ok: true } | { ok: false; status: number; body: { error: string } }> {
  if (!(await isDashboardAuthorized(req))) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return { ok: false, status: 403, body: { error: "เฉพาะผู้มีสิทธิ์อนุมัติเท่านั้น" } };
  }
  const user = await verifyFirebaseToken(bearerToken);
  if (user?.email && isApprover(user.email)) {
    return { ok: true };
  }
  // Host check for dev mode
  const host = (req.headers.get("host") ?? "").split(":")[0];
  const isDev = /^localhost$/.test(host) || /^127\.0\.0\.1$/.test(host) || process.env.NODE_ENV === "development";
  if (isDev) {
    return { ok: true };
  }
  return { ok: false, status: 403, body: { error: "เฉพาะผู้มีสิทธิ์อนุมัติเท่านั้น" } };
}

/** GET: รายการผู้ใช้ที่เคยล็อกอิน + สถานะสิทธิ์เข้าแดชบอร์ด (เฉพาะ approver) */
export async function GET(req: NextRequest) {
  const check = await requireApprover(req);
  if (!check.ok) {
    return NextResponse.json(check.body, { status: check.status });
  }
  try {
    const [users, allowlist] = await Promise.all([listUsersFromDb(), getAllowlistFromDb()]);
    const allowedUids = new Set(allowlist.filter((a) => a.type === "uid").map((a) => a.uid));
    const allowedEmails = new Set(allowlist.filter((a) => a.type === "email").map((a) => a.email.toLowerCase()));

    const withAccess = users.map((u) => ({
      ...u,
      hasAccess: allowedUids.has(u.uid) || (!!u.email && allowedEmails.has(u.email.toLowerCase())),
    }));

    return NextResponse.json({
      users: withAccess,
      allowlist: allowlist,
    });
  } catch (e) {
    console.error("[dashboard/access] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST: อนุมัติการเข้าถึง (body: { uid?: string, email?: string }) — เฉพาะ approver */
export async function POST(req: NextRequest) {
  const check = await requireApprover(req);
  if (!check.ok) {
    return NextResponse.json(check.body, { status: check.status });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const uid = typeof body.uid === "string" ? body.uid.trim() : undefined;
    const email = typeof body.email === "string" ? body.email.trim() : undefined;
    if (uid) {
      const ok = await addToAllowlistByUid(uid);
      return NextResponse.json({ ok, by: "uid", uid });
    }
    if (email) {
      const ok = await addToAllowlistByEmail(email);
      return NextResponse.json({ ok, by: "email", email });
    }
    return NextResponse.json({ error: "Provide uid or email" }, { status: 400 });
  } catch (e) {
    console.error("[dashboard/access] POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE: ถอนสิทธิ์ (query: uid=... หรือ email=...) — เฉพาะ approver */
export async function DELETE(req: NextRequest) {
  const check = await requireApprover(req);
  if (!check.ok) {
    return NextResponse.json(check.body, { status: check.status });
  }
  try {
    const uid = req.nextUrl.searchParams.get("uid")?.trim();
    const email = req.nextUrl.searchParams.get("email")?.trim();
    if (uid) {
      const ok = await removeFromAllowlistByUid(uid);
      return NextResponse.json({ ok, by: "uid", uid });
    }
    if (email) {
      const ok = await removeFromAllowlistByEmail(email);
      return NextResponse.json({ ok, by: "email", email });
    }
    return NextResponse.json({ error: "Provide uid or email" }, { status: 400 });
  } catch (e) {
    console.error("[dashboard/access] DELETE error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
