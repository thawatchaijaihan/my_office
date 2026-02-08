import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { readIndexRows } from "@/lib/passSheets";

export const runtime = "nodejs";

const CACHE_TTL_MS = 60 * 1000; // 60 วินาที
let cache: { data: Awaited<ReturnType<typeof buildDashboardData>>; at: number } | null = null;

const LOG = (msg: string, ...args: unknown[]) => console.log("[Dashboard API]", msg, ...args);

async function buildDashboardData() {
  const indexRows = await readIndexRows();
  LOG("readIndexRows() คืนมา", indexRows.length, "แถว");
  const total = indexRows.length;
  const paid = indexRows.filter((r) => r.paymentStatus === "ชำระเงินแล้ว").length;
  const deleted = indexRows.filter((r) => r.paymentStatus === "ลบข้อมูล").length;
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

  // ผู้ขอบัตรผ่านมากที่สุด = นับรายการที่ชื่อ-สกุลเดียวกัน ไม่รวม M = ลบข้อมูล (เก็บยศจากแถวแรกที่เจอ)
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

  // รายการที่เพิ่มล่าสุด 10 รายการ (แถวล่างสุดของชีต = ล่าสุด)
  const latestRows = indexRows.slice(-10).reverse();
  const latestEntries = latestRows.map((r) => ({
    rowNumber: r.rowNumber,
    registeredAt: r.registeredAt || "",
    name: `${r.rank}${r.firstName} ${r.lastName}`.trim() || "-",
    requestFor: r.requestFor || "",
    plate: r.plate || "",
  }));

  return {
    summary: {
      total: total - deleted, // รายการทั้งหมด (ไม่รวม M เท่ากับ ลบข้อมูล)
      paid,
      outstanding,
      dataIncorrect,
      pendingReview,
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
    LOG("GET /api/dashboard ถูกเรียก", logMs());

    const authStart = Date.now();
    const authorized = await isDashboardAuthorized(req);
    const authMs = Date.now() - authStart;
    LOG("ตรวจสอบสิทธิ์:", authorized ? "ผ่าน" : "ไม่ผ่าน (ส่ง 401)", "ใช้เวลา", authMs, "ms", logMs());
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();
    if (cache && now - cache.at < CACHE_TTL_MS) {
      const totalMs = Date.now() - reqStart;
      LOG("ใช้ cache (อายุ", Math.round((now - cache.at) / 1000), "วินาที) → ส่งข้อมูลทันที | รวม", totalMs, "ms (auth:", authMs, "ms, cache: hit)", logMs());
      return NextResponse.json(cache.data);
    }

    LOG("ไม่มี cache / cache หมดอายุ → เริ่มอ่าน Google Sheets", logMs());
    const sheetsStart = Date.now();
    const data = await buildDashboardData();
    const sheetsMs = Date.now() - sheetsStart;
    cache = { data, at: now };
    const totalMs = Date.now() - reqStart;
    LOG(
      "อ่าน Sheets เสร็จ | แยกรอบ: auth", authMs, "ms, sheets", sheetsMs, "ms | รวม", totalMs, "ms, แถว:", data.summary.total,
      logMs()
    );
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Dashboard API] Error:", err);
    LOG("ส่ง response 500:", message, "| ใช้เวลา", Date.now() - reqStart, "ms");
    const hint =
      message.includes("403") || message.toLowerCase().includes("permission")
        ? " แชร์ Google Sheet ให้อีเมล Service Account (client_email ใน JSON) — ดู docs/SHEETS-TROUBLESHOOTING.md"
        : "";
    return NextResponse.json(
      { error: "Failed to load dashboard data", message: message + hint },
      { status: 500 }
    );
  }
}
