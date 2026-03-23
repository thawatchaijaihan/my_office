import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { writeIndexUpdatesMR } from "@/lib/passSheets";
import { formatDateTime } from "@/lib/formatDateTime";
import { clearIndexRowsCache } from "@/lib/indexRowsCache";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { rowNumber, paymentStatus } = body;

    if (!rowNumber) {
      return NextResponse.json({ error: "Missing rowNumber" }, { status: 400 });
    }

    const now = new Date();
    const timestamp = formatDateTime(now);
    
    // Update Index Sheet: 
    // M = paymentStatus (keep existing)
    // N = "รับบัตรเรียบร้อย"
    // O = timestamp
    await writeIndexUpdatesMR([
      {
        rowNumber,
        paymentStatus: paymentStatus || "ชำระเงินแล้ว", // Fallback if missing, though likely paid
        approvalStatus: "รับบัตรเรียบร้อย",
        checkedAt: timestamp,
      },
    ]);

    clearIndexRowsCache();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Approve API] Error:", err);
    return NextResponse.json(
      { error: "Failed to approve", message: String(err) },
      { status: 500 }
    );
  }
}
