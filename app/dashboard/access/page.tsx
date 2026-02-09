"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboardFetch } from "../useDashboardFetch";

type UserRow = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastLoginAt: number | null;
  hasAccess: boolean;
};

export default function AccessPage() {
  const dashboardFetch = useDashboardFetch();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    dashboardFetch("/api/dashboard/access")
      .then((res) => {
        if (!res.ok) {
          const msg = res.status === 401 ? "กรุณาเข้าสู่ระบบ" : res.status === 403 ? "เฉพาะผู้มีสิทธิ์อนุมัติเท่านั้น" : "โหลดไม่สำเร็จ";
          throw new Error(msg);
        }
        return res.json();
      })
      .then((data) => setUsers(data.users ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dashboardFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(uid: string, email: string | null) {
    setActing(uid);
    try {
      const res = email
        ? await dashboardFetch("/api/dashboard/access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          })
        : await dashboardFetch("/api/dashboard/access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid }),
          });
      if (!res.ok) throw new Error("ดำเนินการไม่สำเร็จ");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setActing(null);
    }
  }

  async function revoke(uid: string, email: string | null) {
    setActing(uid);
    try {
      const url = email
        ? `/api/dashboard/access?email=${encodeURIComponent(email)}`
        : `/api/dashboard/access?uid=${encodeURIComponent(uid)}`;
      const res = await dashboardFetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("ดำเนินการไม่สำเร็จ");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setActing(null);
    }
  }

  function formatDate(ts: number | null) {
    if (ts == null) return "-";
    const d = new Date(ts);
    return d.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading && users.length === 0) {
    return (
      <div className="p-6 md:p-8" style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
        <p className="text-slate-600">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8" style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
      <p className="text-slate-600 text-sm mb-6">
        รายชื่อผู้ที่เคยล็อกอิน — กด อนุญาต / ถอนสิทธิ์ เพื่อให้หรือยกเลิกการเข้าแดชบอร์ด
      </p>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 mb-6">{error}</div>
      )}

      {users.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
          ยังไม่มีผู้ใช้ที่เคยล็อกอิน
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="text-left px-4 py-3 font-medium w-12" />
                <th className="text-left px-4 py-3 font-medium">ชื่อ</th>
                <th className="text-left px-4 py-3 font-medium">อีเมล</th>
                <th className="text-left px-4 py-3 font-medium">ล็อกอินล่าสุด</th>
                <th className="text-left px-4 py-3 font-medium w-24">สิทธิ์</th>
                <th className="text-left px-4 py-3 font-medium">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {u.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.photoURL}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-300 text-slate-600 text-xs font-medium">
                        {(u.displayName || u.email || "?")[0]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{u.displayName || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email || "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    {u.hasAccess ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        อนุญาต
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        ยังไม่มีสิทธิ์
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    {u.hasAccess ? (
                      <button
                        type="button"
                        disabled={!!acting}
                        onClick={() => revoke(u.uid, u.email)}
                        className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                      >
                        {acting === u.uid ? "..." : "ถอนสิทธิ์"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!!acting}
                        onClick={() => approve(u.uid, u.email)}
                        className="rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                      >
                        {acting === u.uid ? "..." : "อนุญาต"}
                      </button>
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
