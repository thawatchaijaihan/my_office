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
    const { rowNumber, approvalStatus } = body;

    if (!rowNumber) {
      return NextResponse.json({ error: "Missing rowNumber" }, { status: 400 });
    }

    const now = new Date();
    const timestamp = formatDateTime(now);

    // Update Index Sheet: Set M = "ชำระเงินแล้ว", O = timestamp
    await writeIndexUpdatesMR([
      {
        rowNumber,
        paymentStatus: "ชำระเงินแล้ว",
        approvalStatus: approvalStatus || "",
        checkedAt: timestamp,
      },
    ]);

    clearIndexRowsCache();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Manual Pay API] Error:", err);
    return NextResponse.json(
      { error: "Failed to process payment", message: String(err) },
      { status: 500 }
    );
  }
}
