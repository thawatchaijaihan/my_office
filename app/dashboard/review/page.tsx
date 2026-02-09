"use client";

import { useEffect, useState } from "react";
import { useDashboardFetch } from "../useDashboardFetch";

type IndexTableRow = {
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
};

type ColumnKey = keyof IndexTableRow | "name";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "rowNumber", label: "ลำดับ" },
  { key: "name", label: "ยศ. ชื่อ-สกุล" },
  { key: "requestFor", label: "ขอบัตรให้" },
  { key: "vehicleOwner", label: "เจ้าของรถ" },
  { key: "vehicleType", label: "ประเภทรถ" },
  { key: "vehicleModel", label: "รุ่น" },
  { key: "vehicleColor", label: "สี" },
  { key: "plate", label: "ทะเบียน" },
  { key: "paymentStatus", label: "สถานะชำระ (M)" },
  { key: "approvalStatus", label: "สถานะ N" },
  { key: "checkedAt", label: "อัพเดทล่าสุด" },
];

const NARROW_COLUMN_KEYS: ColumnKey[] = ["requestFor", "vehicleType", "vehicleModel", "vehicleColor"];

function getNameValue(r: IndexTableRow): string {
  const parts = [r.rank, r.firstName, r.lastName].filter(Boolean);
  if (parts.length <= 1) return parts[0] || "-";
  return `${r.rank}${r.firstName} ${r.lastName}`.trim() || "-";
}

function getCellValue(r: IndexTableRow, colKey: ColumnKey): string {
  if (colKey === "name") return getNameValue(r);
  if (colKey === "vehicleOwner") {
    const f = String(r.vehicleOwner ?? "").trim();
    if (!f) return getNameValue(r);
    return f;
  }
  if (colKey === "checkedAt") {
    const o = String(r.checkedAt ?? "").trim();
    if (!o) return String(r.registeredAt ?? "").trim() || "-";
    return o;
  }
  return String(r[colKey as keyof IndexTableRow] ?? "").trim() || "-";
}

export default function ReviewPage() {
  const dashboardFetch = useDashboardFetch();
  const [rows, setRows] = useState<IndexTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardFetch("/api/dashboard/review")
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "กรุณาใส่ key ใน URL" : "โหลดไม่สำเร็จ");
        return res.json();
      })
      .then((data) => setRows(data.rows ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dashboardFetch]);

  if (loading) {
    return (
      <div className="p-6 md:p-8" style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
        <p className="text-slate-600">กำลังโหลด...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 md:p-8" style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8" style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
      <p className="text-slate-600 text-sm mb-6">รายการขอบัตรผ่านทั้งหมด {rows.length} รายการ</p>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
          ไม่มีข้อมูล
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-auto max-h-[calc(100vh-12rem)]">
          <table className="w-full text-sm border-collapse min-w-[1200px]">
            <thead className="sticky top-0 bg-slate-700 text-white z-10">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2.5 font-medium whitespace-nowrap border-b border-slate-600 ${col.key === "rowNumber" ? "text-center" : col.key === "checkedAt" ? "text-right" : "text-left"} ${NARROW_COLUMN_KEYS.includes(col.key) ? "w-[7rem] min-w-[7rem] max-w-[7rem]" : ""}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rowNumber} className="border-b border-slate-200 hover:bg-slate-50">
                  {COLUMNS.map((col) => {
                    const value = getCellValue(r, col.key);
                    const isPlate = col.key === "plate";
                    const isPayment = col.key === "paymentStatus";
                    const isCheckedAt = col.key === "checkedAt";
                    const note = r.note || "";
                    const hasLink = isPlate && note && (note.startsWith("http") || note.startsWith("https"));
                    const isNarrow = NARROW_COLUMN_KEYS.includes(col.key);
                    return (
                      <td
                        key={`${r.rowNumber}-${col.key}`}
                        className={`px-3 py-2 text-slate-700 whitespace-nowrap ${col.key === "rowNumber" ? "text-center" : isCheckedAt ? "text-right" : ""} ${isNarrow ? "w-[7rem] min-w-[7rem] max-w-[7rem] truncate" : "max-w-[200px] truncate"}`}
                        title={value}
                      >
                        {hasLink ? (
                          <a href={note} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                            {value}
                          </a>
                        ) : (
                          <span
                            className={
                              isPayment && value.includes("ค้าง")
                                ? "text-red-600 font-medium"
                                : isPayment && value.includes("ชำระเงินแล้ว")
                                  ? "text-emerald-600 font-medium"
                                  : ""
                            }
                          >
                            {value}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
