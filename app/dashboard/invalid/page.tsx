"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(kw) ||
        (r.plate ?? "").toLowerCase().includes(kw) ||
        (r.paymentStatus ?? "").toLowerCase().includes(kw) ||
        (r.approvalStatus ?? "").toLowerCase().includes(kw) ||
        (r.columnP ?? "").toLowerCase().includes(kw),
    );
  }, [rows, search]);

  useEffect(() => {
    dashboardFetch("/api/dashboard/invalid")
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

  const [selectedDeleteRow, setSelectedDeleteRow] = useState<InvalidRow | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const handleDeleteClick = (row: InvalidRow) => {
    setSelectedDeleteRow(row);
  };

  const confirmDelete = async () => {
    if (!selectedDeleteRow) return;
    setDeleting(true);
    try {
      const res = await dashboardFetch("/api/dashboard/invalid/mark-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowNumber: selectedDeleteRow.rowNumber }),
      });
      if (!res.ok) throw new Error("ลบข้อมูลไม่สำเร็จ");

      // Update local state (remove row)
      setRows((prev) =>
        prev.filter((r) => r.rowNumber !== selectedDeleteRow.rowNumber),
      );
      setSelectedDeleteRow(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setDeleting(false);
    }
  };

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
        prev.map((r) =>
          r.rowNumber === rowNumber ? { ...r, columnP: editValue } : r,
        ),
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-4 shrink-0">
        <p className="text-slate-600 text-sm whitespace-nowrap">
          ข้อมูลไม่ถูกต้องทั้งหมด {rows.length} รายการ
          {search.trim() && (
            <span className="ml-2 text-xs text-slate-500">
              (แสดงผลหลังค้นหา {filteredRows.length} รายการ)
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา"
            className="w-full md:w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
          {rows.length === 0
            ? "ไม่มีรายการ (N = ข้อมูลไม่ถูกต้อง)"
            : "ไม่พบรายการที่ตรงกับคำค้นหา"}
        </div>
      ) : (
        <div className="flex-1 min-h-0 rounded-xl bg-white border border-slate-200 shadow-sm overflow-auto">
          <table className="w-full text-sm" style={{ tableLayout: "auto" }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-emerald-700 text-white">
                <th className="text-left px-4 py-3 font-medium border-b border-slate-600">
                  ลำดับ
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap border-b border-slate-600">
                  ชื่อ-สกุล
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap border-b border-slate-600">
                  ทะเบียน
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap border-b border-slate-600">
                  สถานะชำระ
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap border-b border-slate-600">
                  ผลการตรวจสอบ
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap border-b border-slate-600">
                  วันที่ลงทะเบียน
                </th>
                <th className="text-left px-4 py-3 font-medium border-b border-slate-600">
                  หมายเหตุ
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, idx) => (
                <tr
                  key={r.rowNumber}
                  className="border-t border-slate-200 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                    {r.name}
                  </td>
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
                  <td className="px-4 py-3 font-medium text-amber-700 whitespace-nowrap">
                    <button
                      onClick={() => handleDeleteClick(r)}
                      className="text-amber-700 hover:text-red-700 hover:underline font-medium"
                      title="คลิกเพื่อลบข้อมูล"
                    >
                      {r.approvalStatus}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {r.registeredAt}
                  </td>
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
                        className="cursor-pointer text-slate-600 hover:text-blue-600 hover:underline min-h-[20px]"
                      >
                        {r.columnP || (
                          <span className="text-slate-400 text-xs">แก้ไข</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedDeleteRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex flex-col items-center mb-4">
              <div className="rounded-full bg-red-100 p-3 mb-2">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  ></path>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                ยืนยันการลบข้อมูล
              </h3>
            </div>

            <p className="text-slate-600 text-sm mb-4 text-center">
              รายการนี้จะถูกเปลี่ยนสถานะเป็น <br />
              <span className="font-medium text-slate-800">
                N=&quot;รอลบข้อมูล&quot;
              </span>
            </p>

            <div className="mb-6 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-slate-700">
                <span className="font-medium">ทะเบียน:</span>{" "}
                {selectedDeleteRow.plate}
              </p>
              <p className="text-slate-700">
                <span className="font-medium">ชื่อ:</span>{" "}
                {selectedDeleteRow.name}
              </p>
              <p className="text-slate-700">
                <span className="font-medium">สาเหตุ:</span>{" "}
                {selectedDeleteRow.approvalStatus}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSelectedDeleteRow(null)}
                disabled={deleting}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "กำลังลบ..." : "ลบข้อมูล"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
