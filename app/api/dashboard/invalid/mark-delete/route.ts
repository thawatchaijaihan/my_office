import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { writeIndexUpdatesMR } from "@/lib/passSheets";
import { formatDateTime } from "@/lib/formatDateTime";
import { getCachedIndexRows, clearIndexRowsCache } from "@/lib/indexRowsCache";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { rowNumber } = body;

    if (!rowNumber) {
      return NextResponse.json({ error: "Missing rowNumber" }, { status: 400 });
    }

    const indexRows = await getCachedIndexRows();
    const target = indexRows.find((r) => r.rowNumber === rowNumber);
    if (!target) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    const now = new Date();
    const timestamp = formatDateTime(now);
    
    // Update Index Sheet: 
    // Preserve M (paymentStatus)
    // N = "รอลบข้อมูล"
    // O = timestamp
    await writeIndexUpdatesMR([
      {
        rowNumber,
        paymentStatus: target.paymentStatus,
        approvalStatus: "รอลบข้อมูล",
        checkedAt: timestamp,
      },
    ]);

    clearIndexRowsCache();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Mark Delete API] Error:", err);
    return NextResponse.json(
      { error: "Failed to mark delete", message: String(err) },
      { status: 500 }
    );
  }
}
