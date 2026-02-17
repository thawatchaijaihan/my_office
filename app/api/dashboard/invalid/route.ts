import { NextRequest, NextResponse } from "next/server";
import { isDashboardAuthorized } from "@/lib/dashboardAuth";
import { getCachedIndexRows } from "@/lib/indexRowsCache";

export const runtime = "nodejs";

const INVALID_LABEL = "ข้อมูลไม่ถูกต้อง";

export type InvalidRow = {
  rowNumber: number;
  name: string;
  plate: string;
  note: string;
  requestFor: string;
  vehicleOwner: string;
  registeredAt: string;
  paymentStatus: string;
  approvalStatus: string;
};

export async function GET(req: NextRequest) {
  if (!(await isDashboardAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const indexRows = await getCachedIndexRows();
    const invalid = indexRows
      .filter((r) => (r.approvalStatus || "").trim() === INVALID_LABEL)
      .slice(0, 500)
      .map((r) => ({
        rowNumber: r.rowNumber,
        name: `${r.rank}${r.firstName} ${r.lastName}`.trim() || "-",
        plate: r.plate || "-",
        note: r.note || "",
        requestFor: r.requestFor || "-",
        vehicleOwner: r.vehicleOwner || "",
        registeredAt: r.registeredAt || "-",
        paymentStatus: r.paymentStatus === "ลบข้อมูล" ? "ค้างชำระเงิน" : (r.paymentStatus || "(ว่าง)"),
        approvalStatus: r.approvalStatus || "-",
      }));

    return NextResponse.json({ rows: invalid });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Dashboard Invalid API] Error:", err);
    return NextResponse.json(
      { error: "Failed to load invalid list", message },
      { status: 500 }
    );
  }
}
