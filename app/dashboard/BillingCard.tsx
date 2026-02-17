"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface BillingData {
  currentMonth: {
    total: number;
    services: { name: string; cost: number }[];
  };
}

type BillingChartItem = {
  name: string;
  value: number;
  color: string;
};

const CHART_COLORS = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#334155",
];

export default function BillingCard({
  billingData,
  animate,
}: {
  billingData: BillingData | null;
  animate: boolean;
}) {
  const billing = useMemo<BillingData>(
    () =>
      billingData ?? {
        currentMonth: {
          total: 0,
          services: [],
        },
      },
    [billingData]
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 2,
    }).format(amount);

  const serviceChartData = useMemo<BillingChartItem[]>(() => {
    const paidServices = billing.currentMonth.services
      .filter((service) => service.cost > 0)
      .map((service, index) => ({
        name: service.name,
        value: service.cost,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));

    if (paidServices.length > 0) return paidServices;

    return [
      {
        name: "ไม่มีค่าใช้จ่าย",
        value: 1,
        color: "#cbd5e1",
      },
    ];
  }, [billing]);

  const hasRealCost = billing.currentMonth.services.some((service) => service.cost > 0);

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4 sm:p-6 shadow-sm min-h-0 flex flex-col overflow-hidden">
      <div className="flex-1 w-full min-w-0 flex flex-row items-center gap-3 h-[220px] sm:h-[240px]">
        <div className="shrink-0 flex flex-col gap-1 items-center">
          <div className="text-base sm:text-lg font-semibold text-slate-800 text-center">ค่าใช้จ่ายบริการ</div>
          <ul className="flex flex-col gap-1.5 text-xs sm:text-sm justify-center items-center" aria-label="ค่าใช้จ่ายบริการ">
            {serviceChartData.map((entry) => (
              <li key={entry.name} className="flex items-center justify-center gap-2">
                <span className="shrink-0 w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} aria-hidden />
                <span className="text-slate-700 min-w-[8rem]">{entry.name}</span>
                <span className="font-bold text-slate-900 tabular-nums text-right w-24">
                  {hasRealCost ? formatCurrency(entry.value) : "฿0.00"}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-center gap-2 pt-1 mt-0.5 border-t border-slate-200">
              <span className="w-3 shrink-0" aria-hidden />
              <span className="text-slate-600 font-medium min-w-[8rem]">รวม</span>
              <span className="font-bold text-slate-900 tabular-nums text-right w-24">
                {formatCurrency(billing.currentMonth.total ?? 0)}
              </span>
            </li>
          </ul>
        </div>

        <div className="shrink-0 ml-auto w-[120px] sm:w-[140px] h-[120px] sm:h-[140px] overflow-hidden relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <Pie
                data={serviceChartData}
                cx="50%"
                cy="50%"
                innerRadius={28}
                outerRadius={52}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                isAnimationActive={animate}
                animationDuration={1000}
              >
                {serviceChartData.map((entry, index) => (
                  <Cell key={`billing-cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => {
                  const numericValue = typeof value === "number" ? value : Number(value ?? 0);
                  return [hasRealCost ? formatCurrency(numericValue) : "฿0.00", String(name ?? "")];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
