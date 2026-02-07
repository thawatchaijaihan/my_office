"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const DashboardCharts = dynamic(() => import("./DashboardCharts"), { ssr: false });

type DashboardData = {
  summary: {
    total: number;
    paid: number;
    outstanding: number;
    deleted: number;
    dataIncorrect: number;
    pendingReview: number;
    paidAmount: number;
    outstandingAmount: number;
  };
  approvalBreakdown: { label: string; count: number }[];
  topOutstanding: { name: string; count: number; title: string }[];
  latestEntries: { rowNumber: number; registeredAt: string; name: string; plate: string }[];
};

const FETCH_TIMEOUT_MS = 15_000; // 15 วินาที
const LOG = (msg: string, ...args: unknown[]) => console.log("[Dashboard]", msg, ...args);

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingLong, setLoadingLong] = useState(false);

  useEffect(() => {
    LOG("1. Component mounted on client");
    setMounted(true);
  }, []);

  // แสดงปุ่ม "ลองใหม่" หลังโหลดเกิน 6 วินาที
  useEffect(() => {
    if (!loading) return;
    LOG("2. เริ่มจับเวลา 6 วินาที สำหรับแสดงปุ่ม 'ลองใหม่'");
    const t = setTimeout(() => {
      LOG("2b. โหลดเกิน 6 วินาที → แสดงปุ่มลองใหม่");
      setLoadingLong(true);
    }, 6_000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (!mounted) return;
    LOG("3. mounted = true → เริ่มโหลด API");
    setLoadingLong(false);
    const key = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("key") ?? "" : "";
    const url = "/api/dashboard" + (key ? `?key=${encodeURIComponent(key)}` : "");
    LOG("3a. URL ที่เรียก:", url, key ? "(มี key)" : "(ไม่มี key)");
    LOG("3b. Timeout หลัง", FETCH_TIMEOUT_MS / 1000, "วินาที");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      LOG("3c. ⏱️ Timeout! เรียก abort()");
      controller.abort();
    }, FETCH_TIMEOUT_MS);
    const start = Date.now();
    fetch(url, { signal: controller.signal })
      .then((res) => {
        LOG("4. ได้ response จาก API:", res.status, res.statusText, "ใช้เวลา", Date.now() - start, "ms");
        if (!res.ok) {
          LOG("4a. ❌ สถานะไม่ OK → throw Error");
          throw new Error(res.status === 401 ? "กรุณาใส่ key ใน URL (?key=...)" : "โหลดข้อมูลไม่สำเร็จ");
        }
        return res.json();
      })
      .then((json) => {
        LOG("5. Parse JSON สำเร็จ → มี summary.total =", json?.summary?.total);
        setData(json);
      })
      .catch((e) => {
        LOG("5a. ❌ Error:", e.name, e.message);
        if (e.name === "AbortError") setError("โหลดข้อมูลช้าเกินไป (เกิน 15 วินาที) กรุณากดลองใหม่");
        else setError(e.message);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        LOG("6. finally → setLoading(false), รวมใช้เวลา", Date.now() - start, "ms");
        setLoading(false);
      });
    return () => {
      LOG("3d. cleanup: ยกเลิก timeout และ abort");
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [mounted]);

  if (!mounted || loading) {
    LOG("render: สถานะโหลด (mounted:", mounted, ", loading:", loading, ")");
    return (
      <div className="flex flex-col min-h-full p-4 sm:p-6 md:p-8 bg-slate-100 text-slate-800">
        <p className="text-sm text-slate-500 mb-3">กำลังโหลดข้อมูลจาก Google Sheets...</p>
        {loadingLong && (
          <>
            <p className="text-xs text-slate-400 mb-1">
              โหลดนาน? ถ้ามี ADMIN_API_KEY ให้ใส่ใน URL: /dashboard?key=ค่าของคุณ
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mb-4 px-4 py-2 rounded-lg font-medium text-slate-700 border border-slate-300 hover:bg-slate-200 transition"
            >
              ลองใหม่
            </button>
          </>
        )}
        {/* Skeleton ตรงกับ layout จริง: 6 KPI → 2 กราฟ → 2 กล่อง */}
        <div className="flex flex-col gap-3 sm:gap-4 flex-1 min-h-0">
          <div className="h-8 bg-slate-200/80 rounded w-40 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 shrink-0">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl bg-slate-200/80 border border-slate-200 p-3 animate-pulse">
                <div className="h-3 bg-slate-300/80 rounded w-3/4 mb-2" />
                <div className="h-7 bg-slate-300/80 rounded w-12" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 flex-1 min-h-0">
            <div className="rounded-xl bg-slate-200/80 border border-slate-200 p-4 animate-pulse min-h-[240px]" />
            <div className="rounded-xl bg-slate-200/80 border border-slate-200 p-4 animate-pulse min-h-[240px]" />
          </div>
          <div className="flex gap-4 flex-wrap shrink-0">
            <div className="flex-1 min-w-[280px] rounded-xl bg-slate-200/80 border border-slate-200 p-4 animate-pulse h-[320px]" />
            <div className="flex-1 min-w-[280px] rounded-xl bg-slate-200/80 border border-slate-200 p-4 animate-pulse h-[280px]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    LOG("render: สถานะ error (error:", error, ", data:", !!data, ")");
    return (
      <div
        className="p-4 sm:p-8 min-h-full"
        style={{ backgroundColor: "#f1f5f9", color: "#0f172a" }}
      >
        <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-800">
          <p className="font-medium">{error ?? "ไม่พบข้อมูล"}</p>
          <p className="text-sm mt-1">ตั้งค่า ADMIN_API_KEY แล้วส่งใน URL: /dashboard?key=YOUR_KEY</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-medium text-red-800"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  LOG("render: แสดงแดชบอร์ด (ข้อมูลโหลดสำเร็จ, total:", data.summary.total, ")");
  return (
    <div
      className="h-full flex flex-col p-4 sm:p-6 md:p-8"
      style={{ backgroundColor: "#f1f5f9", color: "#0f172a", minHeight: "100%" }}
    >
      <h1 className="text-xl sm:text-2xl font-bold shrink-0 mb-3 sm:mb-4" style={{ color: "#1e293b" }}>
        แดชบอร์ด
      </h1>
      <div className="flex-1 min-h-0 flex flex-col">
        <DashboardCharts data={data} />
      </div>
    </div>
  );
}
