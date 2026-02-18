"use client";

import { useEffect, useState } from "react";
import { useDashboardFetch } from "../useDashboardFetch";

type InvalidRow = {
  rowNumber: number;
  name: string;
  plate: string;
  note: string;
  requestFor: string;
  vehicleOwner: string;
  registeredAt: string;
  paymentStatus: string;
  approvalStatus: string;
  columnP: string;
};

export default function InvalidPage() {
  const dashboardFetch = useDashboardFetch();
  const [rows, setRows] = useState<InvalidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dashboardFetch("/api/dashboard/invalid")
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "กรุณาใส่ key ใน URL" : "โหลดไม่สำเร็จ");
        return res.json();
      })
      .then((data) => setRows(data.rows ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dashboardFetch]);

  const handleEditClick = (rowNumber: number, currentValue: string) => {
    setEditingRow(rowNumber);
    setEditValue(currentValue);
  };

  const handleSave = async (rowNumber: number) => {
    setSaving(true);
    try {
      const res = await dashboardFetch("/api/dashboard/invalid/update-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowNumber, columnP: editValue }),
      });
      if (!res.ok) throw new Error("อัปเดตไม่สำเร็จ");
      
      // Update local state
      setRows((prev) =>
        prev.map((r) => (r.rowNumber === rowNumber ? { ...r, columnP: editValue } : r))
      );
      setEditingRow(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditValue("");
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
      <p className="text-slate-600 text-sm mb-6">ข้อมูลไม่ถูกต้องทั้งหมด {rows.length} รายการ</p>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
          ไม่มีรายการ (N = ข้อมูลไม่ถูกต้อง)
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: "auto" }}>
            <thead>
              <tr className="bg-emerald-700 text-white">
                <th className="text-left px-4 py-3 font-medium">ลำดับ</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">ชื่อ-สกุล</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">ทะเบียน</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">สถานะชำระ</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">ผลการตรวจสอบ</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">วันที่ลงทะเบียน</th>
                <th className="text-left px-4 py-3 font-medium">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.rowNumber}
                  className="border-t border-slate-200 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
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
                  <td
                    className={`px-4 py-3 font-medium whitespace-nowrap ${
                      r.paymentStatus.includes("ค้าง")
                        ? "text-red-600"
                        : r.paymentStatus.includes("ชำระเงินแล้ว")
                          ? "text-emerald-600"
                          : "text-slate-600"
                    }`}
                  >
                    {r.paymentStatus}
                  </td>
                  <td className="px-4 py-3 font-medium text-amber-700 whitespace-nowrap">{r.approvalStatus}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{r.registeredAt}</td>
                  <td className="px-4 py-3">
                    {editingRow === r.rowNumber ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={saving}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSave(r.rowNumber)}
                          disabled={saving}
                          className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? "..." : "บันทึก"}
                        </button>
                        <button
                          onClick={handleCancel}
                          disabled={saving}
                          className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-200 rounded hover:bg-slate-300 disabled:opacity-50"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleEditClick(r.rowNumber, r.columnP)}
                        className="cursor-pointer text-slate-600 hover:text-blue-600 hover:underline"
                      >
                        {r.columnP || <span className="text-slate-400 text-xs">แก้ไข</span>}
                      </div>
                    )}
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