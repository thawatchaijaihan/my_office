"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboardFetch } from "../useDashboardFetch";

type PersonnelRow = {
  rank: string;
  firstName: string;
  lastName: string;
  phone: string;
  bank: string;
  accountNumber: string;
};

function matchSearch(row: PersonnelRow, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase().trim();
  const text = [
    row.rank,
    row.firstName,
    row.lastName,
    row.phone,
    row.bank,
    row.accountNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes(lower);
}

function Toast({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      <div className="bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-pulse">
        คัดลอกแล้ว
      </div>
    </div>
  );
}

function CopyableCard({
  value,
  label,
  onCopy,
}: {
  value: string;
  label?: string;
  onCopy?: () => void;
}) {
  const display = (value ?? "").trim() || "-";
  const isEmpty = display === "-";

  const handleCopy = useCallback(() => {
    const text = (value ?? "").trim() || "";
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      onCopy?.();
    });
  }, [value, onCopy]);

  return (
    <div
      className={`flex flex-col ${!isEmpty ? "cursor-pointer hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors" : ""}`}
      onClick={!isEmpty ? handleCopy : undefined}
      title={!isEmpty ? "คลิกเพื่อคัดลอก" : undefined}
    >
      {label && <span className="text-xs text-slate-500 mb-0.5">{label}</span>}
      <span className="text-sm text-slate-800 font-medium select-all">{display}</span>
    </div>
  );
}

export default function PersonnelPage() {
  const dashboardFetch = useDashboardFetch();
  const [rows, setRows] = useState<PersonnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    dashboardFetch("/api/dashboard/personnel")
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "ไม่มีสิทธิ์" : "โหลดไม่สำเร็จ");
        return res.json();
      })
      .then((data) => setRows(data.rows ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dashboardFetch]);

  const handleCopy = useCallback(() => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  }, []);

  const filtered = search.trim()
    ? rows.filter((r) => matchSearch(r, search))
    : rows;

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
      <Toast show={showToast} />
      <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <label htmlFor="personnel-search" className="text-slate-600 text-sm font-medium shrink-0">
          ค้นหาข้อมูล
        </label>
        <input
          id="personnel-search"
          type="search"
          placeholder="ยศ, ชื่อ, สกุล, เบอร์โทร, ธนาคาร, เลขบัญชี..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <span className="text-slate-500 text-sm">
          แสดง {filtered.length} / {rows.length} รายการ
        </span>
      </div>

      <p className="text-slate-600 text-sm mb-4">
        คลิกที่ข้อมูลเพื่อคัดลอกลงคลิปบอร์ด
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
          {rows.length === 0 ? "ยังไม่มีข้อมูลกำลังพล (ซิงก์จาก Sheets → Firestore ก่อน)" : "ไม่พบรายการที่ตรงกับคำค้น"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((row, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              <CopyableCard
                value={[row.rank, row.firstName, row.lastName].filter(Boolean).join(" ")}
                onCopy={handleCopy}
              />
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                <CopyableCard value={row.phone} label="เบอร์โทร" onCopy={handleCopy} />
                <CopyableCard value={row.bank} label="ธนาคาร" onCopy={handleCopy} />
                <CopyableCard value={row.accountNumber} label="เลขบัญชี" onCopy={handleCopy} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

