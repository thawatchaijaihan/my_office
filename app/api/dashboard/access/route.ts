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

const ALLOWED_ADMINS = [
  "thawatchaijaihan@gmail.com",
  ...(process.env.NEXT_PUBLIC_ALLOWED_ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
];

function isApprover(email: string | undefined | null): boolean {
  if (ALLOWED_ADMINS.length === 0) return false;
  return ALLOWED_ADMINS.includes((email ?? "").trim().toLowerCase());
}

/** ตรวจว่า request นี้มาจาก approver (อีเมลตรงกับที่กำหนด) เท่านั้น */
async function requireApprover(req: NextRequest): Promise<{ ok: true } | { ok: false; status: number; body: { error: string, [key: string]: any } }> {
  // Host check for dev mode - allow bypass early
  const host = (req.headers.get("host") ?? "").split(":")[0];
  const isDev = /^localhost$/.test(host) || /^127\.0\.0\.1$/.test(host) || process.env.NODE_ENV === "development";
  if (isDev) {
    return { ok: true };
  }

  if (!(await isDashboardAuthorized(req))) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return { ok: false, status: 403, body: { error: "เฉพาะผู้มีสิทธิ์อนุมัติเท่านั้น" } };
  }
  let user;
  let tokenError = "";
  try {
    user = await verifyFirebaseToken(bearerToken);
  } catch (e: any) {
    tokenError = e.message || String(e);
  }

  if (user?.email && isApprover(user.email)) {
    return { ok: true };
  }
  
  console.log("[Dashboard Access 403] Authorization failed:", {
    tokenError,
    hasToken: !!bearerToken,
    userEmail: user?.email || "null",
    allowedAdminsCount: ALLOWED_ADMINS.length,
    allowedAdmins: ALLOWED_ADMINS
  });

  return { ok: false, status: 403, body: { 
    error: tokenError ? `Token Verification Failed: ${tokenError} (Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID} / GCLOUD: ${process.env.GCLOUD_PROJECT})` : "เฉพาะผู้มีสิทธิ์อนุมัติเท่านั้น",
    debug: {
      userEmail: user?.email || "No email in token",
      allowedAdmins: ALLOWED_ADMINS,
      allowedCount: ALLOWED_ADMINS.length,
      projectIdInEnv: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    }
  } };
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
