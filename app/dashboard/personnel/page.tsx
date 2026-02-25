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
  citizenId: string;
  militaryId: string;
  duty: string;
  position: string;
  unit: string;
  birthplace: string;
  birthDate: string;
  registeredDate: string;
  enlistmentDate: string;
  rankDate: string;
  salary: string;
  age: string;
  retireYear: string;
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
    row.citizenId,
    row.militaryId,
    row.duty,
    row.position,
    row.unit,
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

function DetailModal({
  row,
  onClose,
  onCopy,
}: {
  row: PersonnelRow;
  onClose: () => void;
  onCopy: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-semibold text-slate-800">
            {row.rank} {row.firstName} {row.lastName}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <CopyableCard value={row.phone} label="เบอร์โทร" onCopy={onCopy} />
            <CopyableCard value={row.bank} label="ธนาคาร" onCopy={onCopy} />
            <CopyableCard value={row.accountNumber} label="เลขบัญชี" onCopy={onCopy} />
            <CopyableCard value={row.citizenId} label="เลขประชาชน" onCopy={onCopy} />
            <CopyableCard value={row.militaryId} label="เลขทหาร" onCopy={onCopy} />
            <CopyableCard value={row.duty} label="ปฏิบัติหน้าที่" onCopy={onCopy} />
            <CopyableCard value={row.position} label="ตำแหน่ง" onCopy={onCopy} />
            <CopyableCard value={row.unit} label="เหล่า" onCopy={onCopy} />
          </div>
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-medium text-slate-600 mb-3">ข้อมูลเพิ่มเติม</h3>
            <div className="grid grid-cols-2 gap-4">
              <CopyableCard value={row.birthplace} label="กำเนิด" onCopy={onCopy} />
              <CopyableCard value={row.birthDate} label="วันเกิด" onCopy={onCopy} />
              <CopyableCard value={row.registeredDate} label="วันขึ้นทะเบียน" onCopy={onCopy} />
              <CopyableCard value={row.enlistmentDate} label="วันบรรจุ" onCopy={onCopy} />
              <CopyableCard value={row.rankDate} label="วันครองยศ" onCopy={onCopy} />
              <CopyableCard value={row.salary} label="เงินเดือน" onCopy={onCopy} />
              <CopyableCard value={row.age} label="อายุ" onCopy={onCopy} />
              <CopyableCard value={row.retireYear} label="ปีเกษียณ" onCopy={onCopy} />
            </div>
          </div>
        </div>
      </div>
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
  const [selectedRow, setSelectedRow] = useState<PersonnelRow | null>(null);

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
      {selectedRow && (
        <DetailModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onCopy={handleCopy}
        />
      )}
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
              <button
                onClick={() => setSelectedRow(row)}
                className="mt-3 w-full py-2 px-3 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                แสดงข้อมูลเพิ่มเติม
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

