"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useDashboardAuth } from "./DashboardAuthContext";

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
  latestEntries: { rowNumber: number; registeredAt: string; name: string; requestFor: string; plate: string }[];
};

const FETCH_TIMEOUT_DEFAULT_MS = 30_000;
const FETCH_TIMEOUT_TELEGRAM_MS = 120_000; // เปิดจาก Telegram/WebView ครั้งแรกอาจ cold start นาน (2 นาที)
const LOG = (msg: string, ...args: unknown[]) => console.log("[Dashboard]", msg, ...args);

function getFetchTimeoutMs(): number {
  if (typeof window === "undefined") return FETCH_TIMEOUT_DEFAULT_MS;
  return (window as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp
    ? FETCH_TIMEOUT_TELEGRAM_MS
    : FETCH_TIMEOUT_DEFAULT_MS;
}

export default function DashboardPage() {
  const { getAuthHeaders } = useDashboardAuth();
  const [mounted, setMounted] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingLong, setLoadingLong] = useState(false);
  const [sheetsTestResult, setSheetsTestResult] = useState<string | null>(null);
  const [pingTestResult, setPingTestResult] = useState<string | null>(null);

  const handleRetry = () => {
    setError(null);
    setData(null);
    setSheetsTestResult(null);
    setPingTestResult(null);
    setLoading(true);
    setRetryKey((k) => k + 1);
  };

  const parseJsonOrNull = async (res: Response): Promise<Record<string, unknown> | null> => {
    const text = await res.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const handlePingTest = async () => {
    setPingTestResult("กำลังตรวจสอบ...");
    try {
      const key = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("key") ?? "" : "";
      const authHeaders = await getAuthHeaders();
      const url = "/api/dashboard/ping" + (key ? `?key=${encodeURIComponent(key)}` : "");
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15_000);
      const res = await fetch(url, { headers: authHeaders, signal: ctrl.signal });
      clearTimeout(t);
      const json = await parseJsonOrNull(res);
      if (res.ok && json && json.ok === true) {
        setPingTestResult("เชื่อมต่อ backend ได้ (ping ผ่าน)");
      } else if (json && typeof json.error === "string") {
        setPingTestResult("ผิดพลาด: " + json.error);
      } else if (!res.ok) {
        setPingTestResult("เซิร์ฟเวอร์ส่งกลับ " + res.status + " (อาจเป็น HTML แทน JSON)");
      } else {
        setPingTestResult("ผิดพลาด: รูปแบบ response ไม่ถูกต้อง");
      }
    } catch (e) {
      setPingTestResult("ผิดพลาด: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleSheetsTest = async () => {
    setSheetsTestResult("กำลังตรวจสอบ...");
    try {
      const key = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("key") ?? "" : "";
      const authHeaders = await getAuthHeaders();
      const url = "/api/dashboard/sheets-test" + (key ? `?key=${encodeURIComponent(key)}` : "");
      const res = await fetch(url, { headers: authHeaders });
      const json = await parseJsonOrNull(res);
      if (json && json.ok === true && typeof json.rowCount === "number") {
        setSheetsTestResult(`เชื่อมต่อ Sheet ได้ — อ่านได้ ${json.rowCount} แถว`);
      } else if (json && typeof json.error === "string") {
        setSheetsTestResult("ผิดพลาด: " + json.error);
      } else if (!res.ok) {
        setSheetsTestResult("เซิร์ฟเวอร์ส่งกลับ " + res.status + " (อาจเป็น HTML แทน JSON)");
      } else {
        setSheetsTestResult("ผิดพลาด: รูปแบบ response ไม่ถูกต้อง");
      }
    } catch (e) {
      setSheetsTestResult("ผิดพลาด: " + (e instanceof Error ? e.message : String(e)));
    }
  };

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
    const fetchTimeoutMs = getFetchTimeoutMs();
    setError(null);
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      LOG("3c. ⏱️ Timeout! เรียก abort()");
      controller.abort();
    }, fetchTimeoutMs);

    (async () => {
      const loadStart = Date.now();
      LOG("3. mounted = true → เริ่มโหลด API");
      setLoadingLong(false);
      const key = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("key") ?? "" : "";
      const authStart = Date.now();
      const authHeaders = await getAuthHeaders();
      const authMs = Date.now() - authStart;
      LOG("3a. getAuthHeaders ใช้เวลา", authMs, "ms", authHeaders.Authorization ? "(มี Bearer)" : "(ไม่มี auth)");
      const url = "/api/dashboard" + (key ? `?key=${encodeURIComponent(key)}` : "");
      LOG("3b. URL:", url, "| Timeout หลัง", fetchTimeoutMs / 1000, "วินาที");
      const fetchStart = Date.now();
      try {
        LOG("3d. ส่ง fetch ไป", url);
        const res = await fetch(url, { signal: controller.signal, headers: authHeaders });
        const fetchMs = Date.now() - fetchStart;
        LOG("4. ได้ response:", res.status, res.statusText, "| รอ API", fetchMs, "ms | รวมตั้งแต่โหลด", Date.now() - loadStart, "ms");
        if (!res.ok) {
          LOG("4a. ❌ สถานะไม่ OK → throw Error");
          let errMsg = res.status === 401 ? "ไม่มีสิทธิ์เข้าดูแดชบอร์ด กรุณาเข้าสู่ระบบ" : "โหลดข้อมูลไม่สำเร็จ";
          try {
            const errBody = await res.clone().json();
            if (errBody?.message && typeof errBody.message === "string") errMsg = errBody.message;
          } catch {
            // ใช้ errMsg เดิม
          }
          throw new Error(errMsg);
        }
        const json = await res.json();
        if (!cancelled) {
          LOG("5. Parse JSON สำเร็จ → มี summary.total =", json?.summary?.total);
          setData(json);
        }
      } catch (e) {
        if (cancelled) return;
        const err = e as Error;
        LOG("5a. ❌ Error:", err.name, err.message);
        if (err.name === "AbortError")
          setError(
            (window as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp
              ? "โหลดช้า (เปิดจาก Telegram ครั้งแรกอาจใช้เวลานาน) กดลองใหม่"
              : "โหลดข้อมูลช้าเกินไป กรุณากดลองใหม่"
          );
        else setError(err.message);
      } finally {
        if (!cancelled) {
          clearTimeout(timeoutId);
          LOG("6. finally → setLoading(false), รวมใช้เวลา", Date.now() - loadStart, "ms");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      LOG("3d. cleanup: ยกเลิก timeout และ abort");
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [mounted, getAuthHeaders, retryKey]);

  if (!mounted || loading) {
    LOG("render: สถานะโหลด (mounted:", mounted, ", loading:", loading, ")");
    return (
      <div className="flex flex-col min-h-full p-4 sm:p-6 md:p-8 bg-slate-100 text-slate-800">
        <p className="text-sm text-slate-500 mb-3">กำลังโหลดข้อมูลจาก Google Sheets...</p>
        {loadingLong && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2 rounded-lg font-medium text-slate-700 border border-slate-300 hover:bg-slate-200 transition"
            >
              ลองใหม่
            </button>
            <button
              type="button"
              onClick={handleSheetsTest}
              className="px-4 py-2 rounded-lg font-medium text-slate-600 border border-slate-400 hover:bg-slate-200 transition"
            >
              ตรวจสอบการเชื่อมต่อ Sheet
            </button>
          </div>
        )}
        {sheetsTestResult && (
          <p className="mb-3 text-sm text-slate-600">{sheetsTestResult}</p>
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
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-medium text-red-800"
            >
              ลองใหม่
            </button>
            <button
              type="button"
              onClick={handlePingTest}
              className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 rounded-lg text-sm font-medium text-emerald-800"
            >
              ทดสอบ ping (เร็ว)
            </button>
            <button
              type="button"
              onClick={handleSheetsTest}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-800"
            >
              ตรวจสอบ Sheet
            </button>
          </div>
          {(pingTestResult || sheetsTestResult) && (
            <p className="mt-3 text-sm text-slate-700">
              {pingTestResult}
              {pingTestResult && sheetsTestResult ? " · " : ""}
              {sheetsTestResult}
            </p>
          )}
        </div>
      </div>
    );
  }

  LOG("render: แสดงแดชบอร์ด (ข้อมูลโหลดสำเร็จ, total:", data.summary.total, ")");
  return (
    <div
      className="h-full flex flex-col p-4 sm:p-5 md:p-6 lg:p-8"
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
