import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { clearIndexRowsCache, getCachedIndexRows } from "@/lib/indexRowsCache";
import { formatDateTime } from "@/lib/formatDateTime";
import { writeIndexUpdatesMR } from "@/lib/passSheets";

export const runtime = "nodejs";

const REVIEW_RESULT_MAP: Record<string, { approvalStatus: string }> = {
  waiting_approval: { approvalStatus: "รออนุมัติจาก ฝขว.พล.ป." },
  waiting_send: { approvalStatus: "รอส่ง ฝขว.พล.ป." },
  waiting_delete: { approvalStatus: "รอลบข้อมูล" },
  incorrect: { approvalStatus: "ข้อมูลไม่ถูกต้อง" },
};

export async function POST(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rowNumber = Number(body?.rowNumber);
    const resultKey = String(body?.result ?? "").trim();

    if (!Number.isFinite(rowNumber) || rowNumber <= 1) {
      return NextResponse.json({ error: "Invalid rowNumber" }, { status: 400 });
    }

    const mapping = REVIEW_RESULT_MAP[resultKey];
    if (!mapping) {
      return NextResponse.json({ error: "Invalid result" }, { status: 400 });
    }

    const indexRows = await getCachedIndexRows();
    const target = indexRows.find((r) => r.rowNumber === rowNumber);
    if (!target) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    const checkedAt = formatDateTime(new Date());
    await writeIndexUpdatesMR([
      {
        rowNumber,
        paymentStatus: target.paymentStatus,
        approvalStatus: mapping.approvalStatus,
        checkedAt,
      },
    ]);
    clearIndexRowsCache();

    return NextResponse.json(
      {
        ok: true,
        rowNumber,
        paymentStatus: target.paymentStatus,
        approvalStatus: mapping.approvalStatus,
        checkedAt,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: "Failed to update status", message }, { status: 500 });
  }
}

