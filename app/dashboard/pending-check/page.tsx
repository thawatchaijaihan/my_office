"use client";

import { useEffect, useState } from "react";
import { useDashboardFetch } from "../useDashboardFetch";

type Row = {
  rowNumber: number;
  name: string;
  plate: string;
  note: string;
  requestFor: string;
  vehicleOwner: string;
  registeredAt: string;
  paymentStatus: string;
};

export default function PendingCheckPage() {
  const dashboardFetch = useDashboardFetch();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardFetch("/api/dashboard/pending-check")
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
      <p className="text-slate-600 text-sm mb-6">รอการตรวจสอบข้อมูลทั้งหมด {rows.length} รายการ</p>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
          ไม่มีรายการ
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="text-left px-4 py-3 font-medium">ชื่อ-สกุล</th>
                <th className="text-left px-4 py-3 font-medium">ทะเบียน</th>
                <th className="text-left px-4 py-3 font-medium">ขอบัตรให้</th>
                <th className="text-left px-4 py-3 font-medium">เจ้าของรถ</th>
                <th className="text-left px-4 py-3 font-medium">สถานะชำระ</th>
                <th className="text-left px-4 py-3 font-medium">วันที่ลงทะเบียน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rowNumber} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.note ? (
                      <a href={r.note} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                        {r.plate}
                      </a>
                    ) : (
                      r.plate
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.requestFor}</td>
                  <td className="px-4 py-3 text-slate-600">{r.vehicleOwner || r.name}</td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      r.paymentStatus.includes("ค้าง") ? "text-red-600" : r.paymentStatus.includes("ชำระเงินแล้ว") ? "text-emerald-600" : "text-slate-600"
                    }`}
                  >
                    {r.paymentStatus}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.registeredAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
