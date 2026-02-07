import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { readIndexRows } from "@/lib/passSheets";

export const runtime = "nodejs";

const N_LABEL = "รออนุมัติจาก ฝขว.พล.ป.";

export type PendingRow = {
  rowNumber: number;
  name: string;
  plate: string;
  note: string;
  requestFor: string;
  vehicleOwner: string;
  registeredAt: string;
  paymentStatus: string;
};

export async function GET(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const indexRows = await readIndexRows();
    const filtered = indexRows
      .filter((r) => (r.approvalStatus || "").trim() === N_LABEL)
      .slice(0, 500)
      .map((r) => ({
        rowNumber: r.rowNumber,
        name: `${r.rank}${r.firstName} ${r.lastName}`.trim() || "-",
        plate: r.plate || "-",
        note: r.note || "",
        requestFor: r.requestFor || "-",
        vehicleOwner: r.vehicleOwner || "",
        registeredAt: r.registeredAt || "-",
        paymentStatus: r.paymentStatus || "(ว่าง)",
      }));

    return NextResponse.json({ rows: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Dashboard Pending Approval API] Error:", err);
    return NextResponse.json(
      { error: "Failed to load list", message },
      { status: 500 }
    );
  }
}
