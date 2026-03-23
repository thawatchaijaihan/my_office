"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashboardFetch } from "../useDashboardFetch";

type Row = {
  rowNumber: number;
  rank: string;
  firstName: string;
  lastName: string;
  plate: string;
  note: string;
  requestFor: string;
  vehicleOwner: string;
  registeredAt: string;
  paymentStatus: string;
  approvalStatus: string;
};

export default function OutstandingPage() {
  const dashboardFetch = useDashboardFetch();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) => {
      const name = `${r.rank ?? ""}${r.firstName ?? ""} ${r.lastName ?? ""}`
        .trim()
        .toLowerCase();
      return (
        name.includes(kw) ||
        (r.plate ?? "").toLowerCase().includes(kw) ||
        (r.requestFor ?? "").toLowerCase().includes(kw) ||
        (r.vehicleOwner ?? "").toLowerCase().includes(kw) ||
        (r.paymentStatus ?? "").toLowerCase().includes(kw)
      );
    });
  }, [rows, search]);

  useEffect(() => {
    dashboardFetch("/api/dashboard/review")
      .then((res) => {
        if (!res.ok)
          throw new Error(
            res.status === 401 ? "กรุณาใส่ key ใน URL" : "โหลดไม่สำเร็จ",
          );
        return res.json();
      })
      .then((data) => {
        const all = (data.rows ?? []) as any[];
        const outstanding = all
          .filter((r) => r.paymentStatus === "ค้างชำระเงิน")
          .map(
            (r) =>
              ({
                ...r,
                approvalStatus: r.approvalStatus,
              }) as Row,
          );
        setRows(outstanding);
      })
      .finally(() => setLoading(false));
  }, [dashboardFetch]);

  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [paying, setPaying] = useState(false);

  const handlePayClick = (row: Row) => {
    setSelectedRow(row);
  };

  const confirmPay = async () => {
    if (!selectedRow) return;
    setPaying(true);
    try {
      const res = await dashboardFetch("/api/dashboard/outstanding/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowNumber: selectedRow.rowNumber,
          approvalStatus: selectedRow.approvalStatus,
        }),
      });
      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");

      // Remove from list locally
      setRows((prev) =>
        prev.filter((r) => r.rowNumber !== selectedRow.rowNumber),
      );
      setSelectedRow(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setPaying(false);
    }
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
      <div className="pb-4 shrink-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-600 text-sm whitespace-nowrap">
          รายการค้างชำระทั้งหมด {rows.length} รายการ
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
          {rows.length === 0
            ? "ไม่มีรายการค้างชำระ"
            : "ไม่พบรายการที่ตรงกับคำค้นหา"}
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
              {filteredRows.map((r, idx) => {
                const name =
                  `${r.rank ?? ""}${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() ||
                  "-";
                return (
                  <tr
                    key={r.rowNumber}
                    className="border-t border-slate-200 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-slate-600">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {name}
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
                      {r.vehicleOwner || name}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <button
                        onClick={() => handlePayClick(r)}
                        className="text-red-600 hover:text-red-800 hover:underline font-medium"
                        title="คลิกเพื่อยืนยันการชำระเงิน"
                      >
                        {r.paymentStatus}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.registeredAt}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              ยืนยันการชำระเงิน
            </h3>
            <p className="text-slate-600 text-sm mb-4">
              คุณต้องการบันทึกว่ารายการนี้ชำระเงินแล้วใช่หรือไม่?
            </p>
            <div className="mb-6 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-slate-700">
                <span className="font-medium">ทะเบียน:</span>{" "}
                {selectedRow.plate}
              </p>
              <p className="text-slate-700">
                <span className="font-medium">ชื่อ:</span> {selectedRow.rank}
                {selectedRow.firstName} {selectedRow.lastName}
              </p>
              <p className="text-slate-700">
                <span className="font-medium">จำนวน:</span> 30 บาท
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSelectedRow(null)}
                disabled={paying}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmPay}
                disabled={paying}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {paying ? "บันทึก..." : "ยืนยัน (30 บาท)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
