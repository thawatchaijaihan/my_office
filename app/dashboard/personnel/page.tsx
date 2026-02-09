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

function CopyableCell({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = (value ?? "").trim() || "";
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  const display = (value ?? "").trim() || "-";
  return (
    <td
      role="gridcell"
      className={`px-3 py-2 border-b border-slate-200 text-slate-800 whitespace-nowrap ${className} ${display !== "-" ? "cursor-pointer hover:bg-slate-100 select-all" : ""}`}
      onClick={display !== "-" ? handleCopy : undefined}
      title={display !== "-" ? "คลิกเพื่อคัดลอก" : undefined}
    >
      {display}
      {copied && (
        <span className="ml-1 text-xs text-emerald-600 font-medium">คัดลอกแล้ว</span>
      )}
    </td>
  );
}

export default function PersonnelPage() {
  const dashboardFetch = useDashboardFetch();
  const [rows, setRows] = useState<PersonnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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
        คลิกที่ช่องข้อมูลเพื่อคัดลอกลงคลิปบอร์ด
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
          {rows.length === 0 ? "ยังไม่มีข้อมูลกำลังพล (ซิงก์จาก Sheets → Firestore ก่อน)" : "ไม่พบรายการที่ตรงกับคำค้น"}
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm border-collapse">
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap w-16">ลำดับ</th>
                <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">ยศ ชื่อ สกุล</th>
                <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">เบอร์โทร</th>
                <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">ธนาคาร</th>
                <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">เลขบัญชี</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <CopyableCell value={String(i + 1)} className="text-slate-600 text-center w-16" />
                  <CopyableCell
                    value={[row.rank, row.firstName, row.lastName].filter(Boolean).join(" ").trim()}
                    className="font-medium"
                  />
                  <CopyableCell value={row.phone} />
                  <CopyableCell value={row.bank} />
                  <CopyableCell value={row.accountNumber} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
