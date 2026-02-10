import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { getCachedIndexRows } from "@/lib/indexRowsCache";

export const runtime = "nodejs";

export type IndexTableRow = {
  rowNumber: number;
  registeredAt: string;
  rank: string;
  firstName: string;
  lastName: string;
  requestFor: string;
  vehicleOwner: string;
  vehicleType: string;
  vehicleModel: string;
  vehicleColor: string;
  plate: string;
  phone: string;
  note: string;
  paymentStatus: string;
  approvalStatus: string;
  checkedAt: string;
  columnP: string;
};

export async function GET(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const indexRows = await getCachedIndexRows();
    const rows: IndexTableRow[] = indexRows.slice(0, 1000).map((r) => ({
      rowNumber: r.rowNumber,
      registeredAt: r.registeredAt || "",
      rank: r.rank || "",
      firstName: r.firstName || "",
      lastName: r.lastName || "",
      requestFor: r.requestFor || "",
      vehicleOwner: r.vehicleOwner || "",
      vehicleType: r.vehicleType || "",
      vehicleModel: r.vehicleModel || "",
      vehicleColor: r.vehicleColor || "",
      plate: r.plate || "",
      phone: r.phone || "",
      note: r.note || "",
      paymentStatus: r.paymentStatus || "",
      approvalStatus: r.approvalStatus || "",
      checkedAt: r.checkedAt || "",
      columnP: r.columnP || "",
    }));

    return NextResponse.json({ rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Dashboard Review API] Error:", err);
    return NextResponse.json(
      { error: "Failed to load index list", message },
      { status: 500 }
    );
  }
}
