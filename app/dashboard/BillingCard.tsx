"use client";

import { useEffect, useState } from "react";

interface BillingData {
  currentMonth: {
    total: number;
    services: { name: string; cost: number }[];
  };
  previousMonth: {
    total: number;
  };
  trend: "up" | "down" | "stable";
  error?: string;
  isDemo?: boolean;
}

export default function BillingCard() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBilling = async () => {
      try {
        const response = await fetch("/api/billing");
        const data = await response.json();
        setBilling(data);
      } catch (err) {
        setError("ไม่สามารถโหลดข้อมูลค่าใช้จ่ายได้");
      } finally {
        setLoading(false);
      }
    };

    fetchBilling();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-32 mb-4"></div>
        <div className="h-10 bg-slate-200 rounded w-24 mb-2"></div>
        <div className="h-4 bg-slate-200 rounded w-40"></div>
      </div>
    );
  }

  if (error || !billing) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-red-200">
        <h3 className="text-lg font-bold text-red-600 mb-2">ค่าใช้จ่าย</h3>
        <p className="text-sm text-red-500">{error || "ไม่พบข้อมูล"}</p>
      </div>
    );
  }

  const getTrendIcon = () => {
    if (billing.trend === "up") return "↑";
    if (billing.trend === "down") return "↓";
    return "→";
  };

  const getTrendColor = () => {
    if (billing.trend === "up") return "text-red-600";
    if (billing.trend === "down") return "text-green-600";
    return "text-slate-600";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800">ค่าใช้จ่ายเดือนนี้</h3>
        {billing.isDemo && (
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-semibold">
            Demo
          </span>
        )}
      </div>

      <div className="mb-4">
        <div className="text-3xl font-bold text-slate-900 mb-1">
          {formatCurrency(billing.currentMonth.total)}
        </div>
        <div className={`text-sm font-semibold flex items-center gap-1 ${getTrendColor()}`}>
          <span className="text-lg">{getTrendIcon()}</span>
          <span>
            เทียบกับเดือนที่แล้ว {formatCurrency(billing.previousMonth.total)}
          </span>
        </div>
      </div>

      {billing.error && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">{billing.error}</p>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">แยกตามบริการ:</h4>
        {billing.currentMonth.services.slice(0, 5).map((service, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{service.name}</span>
            <span className="font-semibold text-slate-900">{formatCurrency(service.cost)}</span>
          </div>
        ))}
        {billing.currentMonth.services.length === 0 && (
          <p className="text-sm text-slate-500 italic">ยังไม่มีข้อมูลการใช้งาน</p>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100">
        <a
          href="https://console.cloud.google.com/billing"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          ดูรายละเอียดใน Google Cloud Console
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}
