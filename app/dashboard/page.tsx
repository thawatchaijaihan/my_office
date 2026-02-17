"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useDashboardAuth } from "./DashboardAuthContext";
import type { BillingData } from "./BillingCard";

type DashboardData = {
  summary: {
    total: number;
    paid: number;
    outstanding: number;
    deleted: number;
    dataIncorrect: number;
    pendingReview: number;
    pendingSend: number;
    paidAmount: number;
    outstandingAmount: number;
  };
  approvalBreakdown: { label: string; count: number }[];
  topOutstanding: { name: string; count: number; title: string }[];
  latestEntries: { rowNumber: number; registeredAt: string; name: string; requestFor: string; plate: string }[];
};

type DashboardPanelKey =
  | "overview"
  | "review"
  | "pending-check"
  | "pending-send"
  | "pending-approval"
  | "outstanding"
  | "invalid";

const DashboardCharts = dynamic(() => import("./DashboardCharts"), { ssr: false });
const ReviewPage = dynamic(() => import("./review/page"), { ssr: false });
const PendingCheckPage = dynamic(() => import("./pending-check/page"), { ssr: false });
const PendingSendPage = dynamic(() => import("./pending-send/page"), { ssr: false });
const PendingApprovalPage = dynamic(() => import("./pending-approval/page"), { ssr: false });
const OutstandingPage = dynamic(() => import("./outstanding/page"), { ssr: false });
const InvalidPage = dynamic(() => import("./invalid/page"), { ssr: false });

const FETCH_TIMEOUT_DEFAULT_MS = 30_000;
const FETCH_TIMEOUT_TELEGRAM_MS = 120_000;

function getFetchTimeoutMs(): number {
  if (typeof window === "undefined") return FETCH_TIMEOUT_DEFAULT_MS;
  return (window as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp
    ? FETCH_TIMEOUT_TELEGRAM_MS
    : FETCH_TIMEOUT_DEFAULT_MS;
}

function getApprovalCount(
  approvalBreakdown: { label: string; count: number }[],
  match: string,
): number {
  const item = approvalBreakdown.find((x) => x.label.includes(match));
  return item?.count ?? 0;
}

export default function DashboardPage() {
  const { getAuthHeaders } = useDashboardAuth();
  const [mounted, setMounted] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<DashboardPanelKey>("overview");
  const [billingTotal, setBillingTotal] = useState(0);
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [chartsAnimate, setChartsAnimate] = useState(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 2,
    }).format(amount);

  const handleRetry = () => {
    setError(null);
    setData(null);
    setLoading(true);
    setChartsAnimate(false);
    setRetryKey((k) => k + 1);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), getFetchTimeoutMs());

    (async () => {
      try {
        setError(null);
        setChartsAnimate(false);
        const key = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("key") ?? "" : "";
        const authHeaders = await getAuthHeaders();
        const url = "/api/dashboard" + (key ? `?key=${encodeURIComponent(key)}` : "");
        const [res, billingRes] = await Promise.all([
          fetch(url, { signal: controller.signal, headers: authHeaders }),
          fetch("/api/billing", { signal: controller.signal }),
        ]);

        if (!res.ok) {
          let errMsg = res.status === 401 ? "ไม่มีสิทธิ์เข้าดูแดชบอร์ด กรุณาเข้าสู่ระบบ" : "โหลดข้อมูลไม่สำเร็จ";
          try {
            const errBody = await res.clone().json();
            if (errBody?.message && typeof errBody.message === "string") errMsg = errBody.message;
          } catch {
            // keep errMsg
          }
          throw new Error(errMsg);
        }

        const json = (await res.json()) as DashboardData;
        if (!cancelled) setData(json);

        try {
          if (billingRes.ok) {
            const billingJson = (await billingRes.json()) as BillingData;
            if (!cancelled) {
              setBillingData(billingJson);
              setBillingTotal(Number(billingJson?.currentMonth?.total ?? 0));
            }
          } else if (!cancelled) {
            setBillingData({
              currentMonth: {
                total: 0,
                services: [],
              },
            });
            setBillingTotal(0);
          }
        } catch {
          if (!cancelled) {
            setBillingData({
              currentMonth: {
                total: 0,
                services: [],
              },
            });
            setBillingTotal(0);
          }
        }
      } catch (e) {
        if (cancelled) return;
        const err = e as Error;
        if (err.name === "AbortError") {
          setError("โหลดข้อมูลช้าเกินไป กรุณากดลองใหม่");
        } else {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [mounted, getAuthHeaders, retryKey]);

  useEffect(() => {
    if (loading) return;
    if (!data || !billingData) return;
    const raf = requestAnimationFrame(() => setChartsAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, [loading, data, billingData]);

  if (!mounted || loading) {
    return (
      <div className="flex flex-col min-h-full p-4 sm:p-6 md:p-8 bg-slate-100 text-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-2 sm:gap-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="rounded-xl bg-slate-200/80 border border-slate-200 p-3 animate-pulse">
              <div className="h-3 bg-slate-300/80 rounded w-3/4 mb-2" />
              <div className="h-7 bg-slate-300/80 rounded w-16" />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-slate-200/80 border border-slate-200 animate-pulse h-[420px]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-8 min-h-full" style={{ backgroundColor: "#f1f5f9", color: "#0f172a" }}>
        <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-800">
          <p className="font-medium">{error ?? "ไม่พบข้อมูล"}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-medium text-red-800"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  const countPendingApproval = getApprovalCount(
    data.approvalBreakdown ?? [],
    "รออนุมัติจาก ฝขว.พล.ป.",
  );
  const countReceivedCard = getApprovalCount(
    data.approvalBreakdown ?? [],
    "รับบัตรเรียบร้อย",
  );
  const cards: Array<{
    key: DashboardPanelKey;
    title: string;
    count?: number;
    valueText?: string;
    tone?: "default" | "warning";
  }> = [
    { key: "overview", title: "ภาพรวม", valueText: formatCurrency(billingTotal) },
    { key: "review", title: "รายการทั้งหมด", count: data.summary.total },
    { key: "pending-check", title: "รายการรอตรวจ", count: data.summary.pendingReview },
    { key: "pending-send", title: "รายการรอนำส่ง", count: data.summary.pendingSend },
    {
      key: "pending-approval",
      title: "รายการรออนุมัติ",
      valueText: `${countPendingApproval} / ${countReceivedCard}`,
    },
    { key: "outstanding", title: "รายการค้างชำระ", count: data.summary.outstanding, tone: "warning" },
    { key: "invalid", title: "ข้อมูลไม่ถูกต้อง", count: data.summary.dataIncorrect, tone: "warning" },
  ];

  const panelTitleMap: Record<DashboardPanelKey, string> = {
    overview: "ภาพรวมแดชบอร์ด",
    review: "รายการทั้งหมด",
    "pending-check": "รายการรอตรวจ",
    "pending-send": "รายการรอนำส่ง",
    "pending-approval": "รายการรออนุมัติ",
    outstanding: "รายการค้างชำระ",
    invalid: "ข้อมูลไม่ถูกต้อง",
  };

  const renderActivePanel = () => {
    switch (activePanel) {
      case "overview":
        return <DashboardCharts data={data} billingData={billingData} animate={chartsAnimate} />;
      case "review":
        return <ReviewPage />;
      case "pending-check":
        return <PendingCheckPage />;
      case "pending-send":
        return <PendingSendPage />;
      case "pending-approval":
        return <PendingApprovalPage />;
      case "outstanding":
        return <OutstandingPage />;
      case "invalid":
        return <InvalidPage />;
      default:
        return null;
    }
  };

  return (
    <div
      className="h-full flex flex-col p-4 sm:p-5 md:p-6 lg:p-8"
      style={{ backgroundColor: "#f1f5f9", color: "#0f172a", minHeight: "100%" }}
    >
      <div className="sticky top-0 z-20 -mx-4 px-4 sm:-mx-5 sm:px-5 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 pb-3" style={{ backgroundColor: "#f1f5f9" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-2 sm:gap-3">
          {cards.map((card) => {
            const isActive = activePanel === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setActivePanel(card.key)}
                className={`text-left rounded-xl border p-3 md:p-4 shadow-sm transition ${
                  isActive
                    ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                    : "border-slate-200 bg-white hover:border-emerald-300"
                }`}
              >
                <p className={`text-xs truncate ${card.tone === "warning" ? "text-orange-600" : "text-slate-500"}`}>{card.title}</p>
                {typeof card.valueText === "string" ? (
                  <p className={`text-xl font-bold mt-1 ${card.tone === "warning" ? "text-orange-600" : "text-slate-800"}`}>{card.valueText}</p>
                ) : typeof card.count === "number" ? (
                  <p className={`text-xl font-bold mt-1 ${card.tone === "warning" ? "text-orange-600" : "text-slate-800"}`}>{card.count}</p>
                ) : (
                  <div className="h-[1.75rem] mt-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-1 pb-2">
          <h2 className="text-sm sm:text-base font-semibold text-slate-800">
            {panelTitleMap[activePanel]}
          </h2>
        </div>
        <div
          className={
            activePanel === "overview"
              ? "flex-1 min-h-0 overflow-auto"
              : "flex-1 min-h-0 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm"
          }
        >
          {renderActivePanel()}
        </div>
      </div>
    </div>
  );
}


