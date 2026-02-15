import { NextRequest, NextResponse } from "next/server";
import { getCachedIndexRows } from "@/lib/indexRowsCache";

function normalizePhone(s: string) {
  return (s || "").replace(/[^0-9]/g, "");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const name = (url.searchParams.get("name") ?? "").trim().toLowerCase();

  const rows = await getCachedIndexRows();

  const qDigits = normalizePhone(q);

  const matched = rows.filter((r) => {
    if (!q && !name) return false;
    const phone = normalizePhone(r.phone ?? "");
    const fullName = `${r.rank ?? ""} ${r.firstName ?? ""} ${r.lastName ?? ""}`.toLowerCase();
    const plate = (r.plate ?? "").toLowerCase();
    if (qDigits && phone.includes(qDigits)) return true;
    if (name && fullName.includes(name)) return true;
    if (q && q.trim() && plate.includes(q.trim().toLowerCase())) return true;
    return false;
  });

  const results = matched.map((r) => ({
    timestamp: r.registeredAt,
    rank: r.rank,
    firstName: r.firstName,
    lastName: r.lastName,
    relation: r.vehicleOwner || r.requestFor,
    vehicleType: r.vehicleType,
    vehicleModel: r.vehicleModel,
    vehicleColor: r.vehicleColor,
    plate: r.plate,
    image: r.note || "-",
    statusM: r.paymentStatus || "-",
    statusN: r.approvalStatus || "-",
    paidAmount: 0,
    approvedPassNumber: r.columnP || "-",
  }));

  return NextResponse.json({ results });
}
