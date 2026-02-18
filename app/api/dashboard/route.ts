import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { getCachedIndexRows } from "@/lib/indexRowsCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 1000;
let cache: { data: Awaited<ReturnType<typeof buildDashboardData>>; at: number } | null = null;

const LOG = (msg: string, ...args: unknown[]) => console.log("[Dashboard API]", msg, ...args);

async function buildDashboardData() {
  const indexRows = await getCachedIndexRows();
  LOG("readIndexRows() rows:", indexRows.length);

  /*
   * ----------------------------------------------------------------------
   * Business Logic Update (Requested):
   * "รายการทั้งหมด" (Total) ให้กรองลบจาก Column N (approvalStatus) ค่า "รอลบข้อมูล"
   * แทนที่จะเช็ค Column M (paymentStatus) ค่า "ลบข้อมูล"
   * ----------------------------------------------------------------------
   */
  const validRows = indexRows.filter(
    (r) => (r.approvalStatus || "").trim() !== "รอลบข้อมูล"
  );
  const total = validRows.length;

  // ยังคงคำนวณ stats อื่นๆ จาก validRows หรือ indexRows ตามความเหมาะสม?
  // User โจทย์คือ: summary card "รายการทั้งหมด" ... ใช้เงื่อนไขเดียวกับตาราง (กรองแค่ "รอลบข้อมูล" จากคอลัมน์ N)
  // ดังนั้น total ควรมาจาก validRows.length

  const paid = indexRows.filter((r) => r.paymentStatus === "ชำระเงินแล้ว").length;
  // const deleted = indexRows.filter((r) => r.paymentStatus === "ลบข้อมูล").length; // ไม่ใช้แล้วสำหรับการหักลบ total
  const outstanding = indexRows.filter(
    (r) =>
      !r.paymentStatus ||
      r.paymentStatus === "ค้างชำระเงิน" ||
      r.paymentStatus.includes("ค้าง")
  ).length;
  const dataIncorrect = indexRows.filter((r) =>
    r.approvalStatus?.includes("ข้อมูลไม่ถูกต้อง")
  ).length;
  const pendingReview = indexRows.filter((r) => !r.approvalStatus).length;
  const pendingSend = indexRows.filter((r) => {
    const n = (r.approvalStatus || "").trim();
    const m = (r.paymentStatus || "").trim();
    return n === "รอส่ง ฝขว.พล.ป." && m === "ชำระเงินแล้ว";
  }).length;

  const approvalCounts: Record<string, number> = {};
  for (const r of indexRows) {
    const n = (r.approvalStatus || "").trim();
    const label = !n ? "กรุณาแจ้ง สาย.2" : n;
    approvalCounts[label] = (approvalCounts[label] ?? 0) + 1;
  }

  const approvalBreakdown = Object.entries(approvalCounts)
    .filter(([label]) => !label.includes("รอลบข้อมูล"))
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  const byPerson: Record<string, { count: number; title: string }> = {};
  for (const r of indexRows) {
    if (r.paymentStatus === "ลบข้อมูล") continue;
    const key = `${r.firstName} ${r.lastName}`.trim() || "-";
    if (!byPerson[key]) byPerson[key] = { count: 0, title: (r.rank ?? "").trim() };
    byPerson[key].count += 1;
  }

  const topOutstanding = Object.entries(byPerson)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, { count, title }]) => ({ name, count, title }));

  const nonDeleted = indexRows.filter((r) => r.paymentStatus !== "ลบข้อมูล");
  const latestRows = nonDeleted.slice(-10).reverse();
  const latestEntries = latestRows.map((r) => ({
    rowNumber: r.rowNumber,
    registeredAt: r.registeredAt || "",
    name: `${r.rank}${r.firstName} ${r.lastName}`.trim() || "-",
    requestFor: r.requestFor || "",
    plate: r.plate || "",
  }));

  return {
    summary: {
      total,
      paid,
      outstanding,
      dataIncorrect,
      pendingReview,
      pendingSend,
      paidAmount: paid * 30,
      outstandingAmount: outstanding * 30,
    },
    approvalBreakdown,
    topOutstanding,
    latestEntries,
  };
}

export async function GET(req: NextRequest) {
  const reqStart = Date.now();
  const logMs = () => `+${Date.now() - reqStart}ms`;

  try {
    LOG("GET /api/dashboard", logMs());

    const authStart = Date.now();
    const authorized = await isDashboardAuthorized(req);
    const authMs = Date.now() - authStart;
    LOG("auth:", authorized ? "ok" : "unauthorized", `${authMs}ms`, logMs());
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();
    if (cache && now - cache.at < CACHE_TTL_MS) {
      LOG("cache hit", logMs());
      return NextResponse.json(cache.data);
    }

    const sheetsStart = Date.now();
    const data = await buildDashboardData();
    const sheetsMs = Date.now() - sheetsStart;
    cache = { data, at: now };

    LOG("sheets loaded", `${sheetsMs}ms`, logMs());
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Dashboard API] Error:", err);
    const hint =
      message.includes("403") || message.toLowerCase().includes("permission")
        ? " แชร์ Google Sheet ให้ email service account (client_email)"
        : "";

    return NextResponse.json(
      { error: "Failed to load dashboard data", message: message + hint },
      { status: 500 }
    );
  }
}
