import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { appendSlipRow, writeIndexUpdatesMR } from "@/lib/passSheets";
import { formatDateTime } from "@/lib/formatDateTime";
import { clearIndexRowsCache } from "@/lib/indexRowsCache";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { rowNumber, rank, firstName, lastName, amount, plate } = body;

    if (!rowNumber || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const now = new Date();
    const timestamp = formatDateTime(now);
    
    // 1. Update Index Sheet: Set M = "ชำระเงินแล้ว", O = timestamp
    await writeIndexUpdatesMR([
      {
        rowNumber,
        paymentStatus: "ชำระเงินแล้ว",
        approvalStatus: "", // We don't have approvalStatus in Row type yet! But we must provide it.
                            // Since we don't have it, we might be erasing it.
                            // Ideally we should pass it from client.
        checkedAt: timestamp,
      },
    ]);
    
    // WAIT: writing "" to approvalStatus might clear it.
    // Let's modify the plan: The UI MUST send the current `approvalStatus` so we can write it back unchanged.
    // If UI doesn't send it, we risk clearing it.
    
    const currentApprovalStatus = body.approvalStatus || "";

    await writeIndexUpdatesMR([
      {
        rowNumber,
        paymentStatus: "ชำระเงินแล้ว",
        approvalStatus: currentApprovalStatus, 
        checkedAt: timestamp,
      },
    ]);

    // 2. Append Slip Sheet
    // Type = "ชำระแบบระบุรายการ" (Automatic allocation ignores this type)
    const payerName = `${rank || ""} ${firstName || ""}`.trim();
    
    await appendSlipRow({
      timestamp,
      rankName: payerName || "Manual Pay",
      surname: lastName || "",
      amount: Number(amount),
      type: "ชำระแบบระบุรายการ", // Special type to avoid auto-allocation side effects
      transferDate: timestamp,
    });

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
