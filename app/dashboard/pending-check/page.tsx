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

const REVIEW_ACTIONS: Array<{
  key: "waiting_approval" | "waiting_send" | "waiting_delete" | "incorrect";
  label: string;
  className: string;
}> = [
  {
    key: "waiting_approval",
    label: "รออนุมัติจาก ฝขว.พล.ป.",
    className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  },
  {
    key: "waiting_send",
    label: "รอส่ง ฝขว.พล.ป.",
    className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  },
  {
    key: "waiting_delete",
    label: "รอลบข้อมูล",
    className: "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200",
  },
  {
    key: "incorrect",
    label: "ข้อมูลไม่ถูกต้อง",
    className: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
  },
];

export default function PendingCheckPage() {
  const dashboardFetch = useDashboardFetch();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingRow, setUpdatingRow] = useState<number | null>(null);

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

  const updateReviewStatus = async (
    rowNumber: number,
    result: "waiting_approval" | "waiting_send" | "waiting_delete" | "incorrect"
  ) => {
    setActionError(null);
    setUpdatingRow(rowNumber);
    try {
      const res = await dashboardFetch("/api/dashboard/review/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowNumber, result }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "อัปเดตสถานะไม่สำเร็จ");
      }
      setRows((prev) => prev.filter((r) => r.rowNumber !== rowNumber));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setUpdatingRow(null);
    }
  };

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
      <p className="text-slate-600 text-sm mb-4">รอการตรวจสอบข้อมูลทั้งหมด {rows.length} รายการ</p>
      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
          ไม่มีรายการ
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="bg-emerald-700 text-white">
                <th className="text-left px-4 py-3 font-medium w-16">ลำดับ</th>
                <th className="text-left px-4 py-3 font-medium">ชื่อ-สกุล</th>
                <th className="text-left px-4 py-3 font-medium">ทะเบียน</th>
                <th className="text-left px-4 py-3 font-medium">ขอบัตรให้</th>
                <th className="text-left px-4 py-3 font-medium">เจ้าของรถ</th>
                <th className="text-left px-4 py-3 font-medium">สถานะชำระ</th>
                <th className="text-left px-4 py-3 font-medium">วันที่ลงทะเบียน</th>
                <th className="text-left px-4 py-3 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.rowNumber} className="border-t border-slate-200 hover:bg-slate-50 align-top">
                  <td className="px-4 py-3 text-slate-600">{idx + 1}</td>
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
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 min-w-[260px]">
                      {REVIEW_ACTIONS.map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          onClick={() => updateReviewStatus(r.rowNumber, action.key)}
                          disabled={updatingRow === r.rowNumber}
                          className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${action.className}`}
                        >
                          {updatingRow === r.rowNumber ? "กำลังบันทึก..." : action.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
