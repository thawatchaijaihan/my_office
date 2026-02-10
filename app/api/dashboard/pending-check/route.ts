import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { getCachedIndexRows } from "@/lib/indexRowsCache";
import type { IndexRow } from "@/lib/passSheets";

export const runtime = "nodejs";

const N_EMPTY_OR = ["กรุณาแจ้ง สาย.2"];

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

function toRow(r: IndexRow) {
  return {
    rowNumber: r.rowNumber,
    name: `${r.rank}${r.firstName} ${r.lastName}`.trim() || "-",
    plate: r.plate || "-",
    note: r.note || "",
    requestFor: r.requestFor || "-",
    vehicleOwner: r.vehicleOwner || "",
    registeredAt: r.registeredAt || "-",
    paymentStatus: r.paymentStatus || "(ว่าง)",
  };
}

export async function GET(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const indexRows = await getCachedIndexRows();
    const filtered = indexRows
      .filter((r) => {
        const n = (r.approvalStatus || "").trim();
        return !n || N_EMPTY_OR.includes(n);
      })
      .slice(0, 500)
      .map(toRow);

    return NextResponse.json({ rows: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Dashboard Pending Check API] Error:", err);
    return NextResponse.json(
      { error: "Failed to load list", message },
      { status: 500 }
    );
  }
}
