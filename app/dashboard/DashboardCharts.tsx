"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DashboardData } from "./dashboardChartData";
import { buildChartData } from "./dashboardChartData";
import ChartsRootWrapper from "./ChartsRootWrapper";
import BillingCard from "./BillingCard";

type ChartsRootProps = {
  summary: {
    total: number;
    paid: number;
    outstanding: number;
    dataIncorrect: number;
    pendingReview: number;
    paidAmount: number;
    outstandingAmount: number;
  };
  topOutstanding: { name: string; count: number; title: string }[];
  latestEntries: {
    rowNumber: number;
    registeredAt: string;
    name: string;
    requestFor: string;
    plate: string;
  }[];
  paymentPieData: { name: string; value: number; color: string }[];
  approvalPieData: {
    name: string;
    fullName: string;
    value: number;
    color: string;
  }[];
};

function ChartsRoot(props: ChartsRootProps) {
  const {
    summary,
    topOutstanding,
    latestEntries,
    paymentPieData,
    approvalPieData,
  } = props;
  const className = "flex flex-col min-h-0 gap-3 sm:gap-4";
  return (
    <ChartsRootWrapper className={className}>
      {/* กราฟหลัก 3 คอลัมน์ */}
      <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <BillingCard />
        <div className="rounded-xl bg-white border border-slate-200 p-4 sm:p-6 shadow-sm min-h-0 flex flex-col overflow-hidden">
            {paymentPieData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">
                ไม่มีข้อมูล
              </p>
            ) : (
              <>
                <div className="flex-1 w-full min-w-0 flex flex-row items-center gap-3 h-[220px] sm:h-[240px]">
                <div className="shrink-0 flex flex-col gap-1 items-center">
                  <div className="text-base sm:text-lg font-semibold text-slate-800 text-center">การชำระเงิน</div>
                  <ul className="flex flex-col gap-1.5 text-xs sm:text-sm justify-center items-center" aria-label="การชำระเงิน">
                  {paymentPieData.map((entry, index) => (
                    <li key={index} className="flex items-center justify-center gap-2">
                      <span
                        className="shrink-0 w-3 h-3 rounded-sm"
                        style={{ backgroundColor: entry.color }}
                        aria-hidden
                      />
                      <span className="text-slate-700 min-w-[4.5rem]">{entry.name}</span>
                      <span className="font-bold text-slate-900 tabular-nums text-right w-8">{entry.value}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-center gap-2 pt-1 mt-0.5 border-t border-slate-200">
                    <span className="w-3 shrink-0" aria-hidden />
                    <span className="text-slate-600 font-medium min-w-[4.5rem]">รวม</span>
                    <span className="font-bold text-slate-900 tabular-nums text-right w-8">
                      {summary.paid + summary.outstanding}
                    </span>
                  </li>
                </ul>
                </div>
                <div className="shrink-0 ml-auto w-[120px] sm:w-[140px] h-[120px] sm:h-[140px] overflow-hidden relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                      <Pie
                        data={paymentPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={52}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                      >
                        {paymentPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [value ?? 0, "รายการ"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                </div>
              </>
            )}
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-4 sm:p-6 shadow-sm min-h-0 flex flex-col overflow-hidden">
            {approvalPieData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">
                ไม่มีข้อมูล
              </p>
            ) : (
              <>
                <div className="flex-1 w-full min-w-0 flex flex-row items-center gap-3 h-[220px] sm:h-[240px]">
                <div className="shrink-0 flex flex-col gap-1 items-center">
                  <div className="text-base sm:text-lg font-semibold text-slate-800 text-center">ผลการตรวจข้อมูล</div>
                  <ul className="flex flex-col gap-1.5 text-xs sm:text-sm justify-center items-center" aria-label="ผลการตรวจข้อมูล">
                  {approvalPieData.map((entry, index) => (
                    <li key={index} className="flex items-center justify-center gap-2">
                      <span
                        className="shrink-0 w-3 h-3 rounded-sm"
                        style={{ backgroundColor: entry.color }}
                        aria-hidden
                      />
                      <span className="text-slate-700 min-w-[9.5rem] sm:min-w-[10.5rem] break-words">
                        {entry.fullName ?? entry.name}
                      </span>
                      <span className="font-bold text-slate-900 tabular-nums text-right w-8">
                        {entry.value}
                      </span>
                    </li>
                  ))}
                </ul>
                </div>
                <div className="shrink-0 ml-auto w-[120px] sm:w-[140px] h-[120px] sm:h-[140px] overflow-hidden relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                      <Pie
                        data={approvalPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={52}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                      >
                        {approvalPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name, props: unknown) => {
                          const p = props as { payload?: { fullName?: string } };
                          return [value, p?.payload?.fullName ?? name];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                </div>
              </>
            )}
        </div>
      </div>

      {topOutstanding.length >= 1 &&
        (() => {
          const top10 = topOutstanding.map((row, i) => ({
            ...row,
            rank: i + 1,
          }));
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch relative z-20">
              {/* Top 10 - Custom Progress Bars */}
              <div className="min-w-0 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <h2 className="text-base sm:text-lg font-semibold text-slate-800 bg-slate-100 px-4 py-2 border-b border-slate-200 shrink-0">ผู้ขอบัตรผ่านมากที่สุด (Top 10)</h2>
                <div className="p-4 flex flex-col gap-2.5 shrink-0 overflow-y-auto" style={{ maxHeight: "400px" }}>
                  {(() => {
                    const maxCount = Math.max(...top10.map(t => t.count), 1);
                    return top10.map((row, i) => {
                      const percentage = (row.count / maxCount) * 100;
                      return (
                        <div key={i} className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-medium text-slate-700 shrink-0 w-6 text-right">
                            {i + 1}.
                          </span>
                          <span className="min-w-0 flex-1 truncate text-slate-800 text-sm" title={row.title ? `${row.title} ${row.name}` : row.name}>
                            {row.title ? `${row.title} ${row.name}` : row.name}
                          </span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[60px] max-w-[120px] shrink-0">
                            <div
                              className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="shrink-0 font-bold text-slate-900 text-sm w-16 text-right">
                            {row.count} รายการ
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              {/* รายการที่เพิ่มล่าสุด 10 รายการ */}
              <div className="min-w-0 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <h3 className="text-base sm:text-lg font-semibold text-slate-800 bg-slate-100 px-4 py-2 border-b border-slate-200">
                  รายการที่เพิ่มล่าสุด 10 รายการ
                </h3>
                <div className="p-4 overflow-x-auto min-w-0">
                  {latestEntries.length === 0 ? (
                    <p className="text-slate-500 text-sm">ไม่มีข้อมูล</p>
                  ) : (
                    <div className="flex flex-col gap-2 text-sm min-w-0">
                      {/* หัวคอลัมน์ - ซ่อนบนจอเล็ก */}
                      <div className="hidden sm:grid grid-cols-[2rem_1fr_1fr_1fr_1fr] gap-2 sm:gap-3 text-slate-500 text-xs border-b border-slate-200 pb-1">
                        <span></span>
                        <span>ชื่อ</span>
                        <span>ขอสำหรับ</span>
                        <span>ทะเบียน</span>
                        <span className="text-right">วันที่</span>
                      </div>
                      {latestEntries.map((entry, index) => (
                        <div
                          key={entry.rowNumber}
                          className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr] gap-2 sm:gap-3 items-center min-w-0"
                        >
                          <span className="text-slate-500 shrink-0">{index + 1}.</span>
                          <span className="min-w-0 truncate text-slate-900 font-semibold">{entry.name}</span>
                          <span className="min-w-0 truncate text-slate-700 hidden sm:block">{entry.requestFor || "-"}</span>
                          <span className="min-w-0 truncate text-slate-900 font-semibold" title={entry.plate || undefined}>
                            {entry.plate || "-"}
                          </span>
                          <span className="text-slate-500 text-xs text-right shrink-0 whitespace-nowrap">
                            {entry.registeredAt || "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </ChartsRootWrapper>
  );
}

export default function DashboardCharts({ data }: { data: DashboardData }) {
  const { summary, topOutstanding, latestEntries } = data;
  const { paymentPieData, approvalPieData } = buildChartData(data);
  return (
    <ChartsRoot
      summary={summary}
      topOutstanding={topOutstanding}
      latestEntries={latestEntries ?? []}
      paymentPieData={paymentPieData}
      approvalPieData={approvalPieData}
    />
  );
}

