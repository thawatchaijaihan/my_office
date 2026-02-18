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
  approvalStatus: string;
};

export default function PendingApprovalPage() {
  const dashboardFetch = useDashboardFetch();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardFetch("/api/dashboard/pending-approval")
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "กรุณาใส่ key ใน URL" : "โหลดไม่สำเร็จ");
        return res.json();
      })
      .then((data) => setRows(data.rows ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dashboardFetch]);

  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [approving, setApproving] = useState(false);

  const handleApproveClick = (row: Row) => {
    setSelectedRow(row);
  };

  const confirmApprove = async () => {
    if (!selectedRow) return;
    setApproving(true);
    try {
      const res = await dashboardFetch("/api/dashboard/pending-approval/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          rowNumber: selectedRow.rowNumber,
          paymentStatus: selectedRow.paymentStatus
        }),
      });

      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
      
      // Update local state
      setRows((prev) => 
        prev.map((r) => 
          r.rowNumber === selectedRow.rowNumber 
            ? { ...r, approvalStatus: "รับบัตรเรียบร้อย" } 
            : r
        )
      );
      setSelectedRow(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setApproving(false);
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
      <p className="text-slate-600 text-sm mb-6">รออนุมัติจาก ฝขว.พล.ป. ทั้งหมด {rows.length} รายการ</p>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
          ไม่มีรายการ
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-emerald-700 text-white">
                <th className="text-left px-4 py-3 font-medium w-16">ลำดับ</th>
                <th className="text-left px-4 py-3 font-medium">ชื่อ-สกุล</th>
                <th className="text-left px-4 py-3 font-medium">ทะเบียน</th>
                <th className="text-left px-4 py-3 font-medium">ขอบัตรให้</th>
                <th className="text-left px-4 py-3 font-medium">เจ้าของรถ</th>
                <th className="text-left px-4 py-3 font-medium">สถานะชำระ</th>
                <th className="text-left px-4 py-3 font-medium">ผลการตรวจสอบ</th>
                <th className="text-left px-4 py-3 font-medium">วันที่ลงทะเบียน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.rowNumber} className="border-t border-slate-200 hover:bg-slate-50">
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
                  <td className={`px-4 py-3 font-medium ${r.approvalStatus === "รับบัตรเรียบร้อย" ? "text-red-700" : "text-amber-700"}`}>
                    {r.approvalStatus === "รออนุมัติจาก ฝขว.พล.ป." ? (
                      <button
                        onClick={() => handleApproveClick(r)}
                        className="hover:underline hover:text-amber-900"
                        title="คลิกเพื่อเปลี่ยนเป็น 'รับบัตรเรียบร้อย'"
                      >
                        {r.approvalStatus}
                      </button>
                    ) : (
                      r.approvalStatus
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.registeredAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex flex-col items-center mb-4">
              <div className="rounded-full bg-emerald-100 p-3 mb-2">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">ยืนยันการรับบัตร</h3>
            </div>
            
            <p className="text-slate-600 text-sm mb-4 text-center">
              เปลี่ยนสถานะเป็น <span className="font-bold text-red-700">&quot;รับบัตรเรียบร้อย&quot;</span>
            </p>
            
            <div className="mb-6 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-slate-700"><span className="font-medium">ทะเบียน:</span> {selectedRow.plate}</p>
              <p className="text-slate-700"><span className="font-medium">ชื่อ:</span> {selectedRow.name}</p>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSelectedRow(null)}
                disabled={approving}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmApprove}
                disabled={approving}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {approving ? "กำลังบันทึก..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
