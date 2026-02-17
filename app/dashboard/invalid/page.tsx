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
};

export default function InvalidPage() {
  const dashboardFetch = useDashboardFetch();
  const [rows, setRows] = useState<InvalidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardFetch("/api/dashboard/invalid")
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "à¸à¸£à¸¸à¸“à¸²à¹ƒà¸ªà¹ˆ key à¹ƒà¸™ URL" : "à¹‚à¸«à¸¥à¸”à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
        return res.json();
      })
      .then((data) => setRows(data.rows ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dashboardFetch]);

  if (loading) {
    return (
      <div className="p-6 md:p-8" style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
        <p className="text-slate-600">à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”...</p>
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
      <p className="text-slate-600 text-sm mb-6">à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” {rows.length} à¸£à¸²à¸¢à¸à¸²à¸£</p>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
          à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸²à¸¢à¸à¸²à¸£ (N = à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡)
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-amber-600 text-white">
                <th className="text-left px-4 py-3 font-medium w-16">ลำดับ</th>
                <th className="text-left px-4 py-3 font-medium">à¸Šà¸·à¹ˆà¸­-à¸ªà¸à¸¸à¸¥</th>
                <th className="text-left px-4 py-3 font-medium">à¸—à¸°à¹€à¸šà¸µà¸¢à¸™</th>
                <th className="text-left px-4 py-3 font-medium">à¸‚à¸­à¸šà¸±à¸•à¸£à¹ƒà¸«à¹‰</th>
                <th className="text-left px-4 py-3 font-medium">à¹€à¸ˆà¹‰à¸²à¸‚à¸­à¸‡à¸£à¸–</th>
                <th className="text-left px-4 py-3 font-medium">à¸ªà¸–à¸²à¸™à¸°à¸Šà¸³à¸£à¸°</th>
                <th className="text-left px-4 py-3 font-medium">à¸§à¸±à¸™à¸—à¸µà¹ˆà¸¥à¸‡à¸—à¸°à¹€à¸šà¸µà¸¢à¸™</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.rowNumber}
                  className="border-t border-slate-200 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-600">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
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
                  <td className="px-4 py-3 text-slate-600">{r.vehicleOwner || r.name}</td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      r.paymentStatus.includes("à¸„à¹‰à¸²à¸‡")
                        ? "text-red-600"
                        : r.paymentStatus.includes("à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¹à¸¥à¹‰à¸§")
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

