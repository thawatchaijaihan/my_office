"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function PendingSendPage() {
  const dashboardFetch = useDashboardFetch();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(kw) ||
        (r.plate ?? "").toLowerCase().includes(kw) ||
        (r.requestFor ?? "").toLowerCase().includes(kw) ||
        (r.vehicleOwner ?? "").toLowerCase().includes(kw) ||
        (r.paymentStatus ?? "").toLowerCase().includes(kw),
    );
  }, [rows, search]);

  useEffect(() => {
    dashboardFetch("/api/dashboard/pending-send")
      .then((res) => {
        if (!res.ok)
          throw new Error(
            res.status === 401 ? "กรุณาใส่ key ใน URL" : "โหลดไม่สำเร็จ",
          );
        return res.json();
      })
      .then((data) => setRows(data.rows ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dashboardFetch]);

  if (loading) {
    return (
      <div
        className="p-6 md:p-8"
        style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}
      >
        <p className="text-slate-600">กำลังโหลด...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="p-6 md:p-8"
        style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}
      >
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full px-6 md:px-8 pt-4"
      style={{ backgroundColor: "#f1f5f9" }}
    >
      <div className="pb-4 shrink-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-600 text-sm whitespace-nowrap">
          รอนำเรียนส่ง ฝขว.พล.ป. ทั้งหมด {rows.length} รายการ
          {search.trim() && (
            <span className="ml-2 text-xs text-slate-500">
              (แสดงผลหลังค้นหา {filteredRows.length} รายการ)
            </span>
          )}
        </p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหา"
          className="w-full md:w-80 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
          {rows.length === 0 ? "ไม่มีรายการ" : "ไม่พบรายการที่ตรงกับคำค้นหา"}
        </div>
      ) : (
        <div className="flex-1 min-h-0 rounded-xl bg-white border border-slate-200 shadow-sm overflow-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 z-10 bg-emerald-700 text-white">
              <tr>
                <th className="text-left px-4 py-3 font-medium w-16">ลำดับ</th>
                <th className="text-left px-4 py-3 font-medium">ชื่อ-สกุล</th>
                <th className="text-left px-4 py-3 font-medium">ทะเบียน</th>
                <th className="text-left px-4 py-3 font-medium">ขอบัตรให้</th>
                <th className="text-left px-4 py-3 font-medium">เจ้าของรถ</th>
                <th className="text-left px-4 py-3 font-medium">สถานะชำระ</th>
                <th className="text-left px-4 py-3 font-medium">
                  วันที่ลงทะเบียน
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, idx) => (
                <tr
                  key={r.rowNumber}
                  className="border-t border-slate-200 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-600">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {r.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.note ? (
                      <a
                        href={r.note}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        {r.plate}
                      </a>
                    ) : (
                      r.plate
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.requestFor}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.vehicleOwner || r.name}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      r.paymentStatus.includes("ค้าง")
                        ? "text-red-600"
                        : r.paymentStatus.includes("ชำระเงินแล้ว")
                          ? "text-emerald-600"
                          : "text-slate-600"
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
