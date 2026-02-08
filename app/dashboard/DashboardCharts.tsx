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
  approvalBreakdown: { label: string; count: number }[];
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

function getApprovalCount(
  approvalBreakdown: { label: string; count: number }[],
  match: string | RegExp,
): number {
  const item = approvalBreakdown.find((x) =>
    typeof match === "string" ? x.label.includes(match) : match.test(x.label),
  );
  return item?.count ?? 0;
}

function ChartsRoot(props: ChartsRootProps) {
  const {
    summary,
    approvalBreakdown,
    topOutstanding,
    latestEntries,
    paymentPieData,
    approvalPieData,
  } = props;
  const countPendingApproval = getApprovalCount(
    approvalBreakdown,
    "รออนุมัติจาก ฝขว.พล.ป.",
  );
  const countPendingSend = getApprovalCount(
    approvalBreakdown,
    /รอส่ง|รอนำเรียนส่ง/,
  );
  const className = "flex flex-col min-h-0 gap-3 sm:gap-4";
  return (
    <ChartsRootWrapper className={className}>
      {/* จำนวน - 6 รายการ (จอกลาง: 3 คอลัมน์, จอใหญ่: 6 คอลัมน์) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-3 shrink-0">
        <div className="rounded-xl bg-white border border-slate-200 p-3 md:p-4 shadow-sm">
          <p className="text-xs text-slate-500 truncate">รายการทั้งหมด</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5">
            {summary.total}
          </p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3 md:p-4 shadow-sm">
          <p className="text-xs text-slate-500 truncate">รอการตรวจสอบ</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5">
            {summary.pendingReview}
          </p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3 md:p-4 shadow-sm">
          <p className="text-xs text-orange-600 truncate">ข้อมูลไม่ถูกต้อง</p>
          <p className="text-xl font-bold mt-0.5 text-orange-600">
            {summary.dataIncorrect}
          </p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3 md:p-4 shadow-sm">
          <p className="text-xs text-slate-500 truncate">ฝขว.พล.ป. อนุมัติ</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5">
            {countPendingApproval}
          </p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3 md:p-4 shadow-sm">
          <p className="text-xs text-slate-500 truncate">รายการรอนำเรียน</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5">
            {countPendingSend}
          </p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3 md:p-4 shadow-sm">
          <p className="text-xs text-red-600 truncate">รายการค้างชำระ</p>
          <p className="text-xl font-bold mt-0.5 text-red-600">
            {summary.outstanding}
          </p>
        </div>
      </div>

      {/* กราฟ M และกราฟ N (จอกลางขึ้นไป: 2 คอลัมน์) */}
      <div className="flex-1 min-h-0 flex flex-col gap-3 sm:gap-4">
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          <div className="rounded-xl bg-white border border-slate-200 p-4 sm:p-6 shadow-sm min-h-0 flex flex-col">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-2 sm:mb-4 shrink-0">
              การชำระเงิน
            </h2>
            {paymentPieData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">
                ไม่มีข้อมูล
              </p>
            ) : (
              <div className="flex-1 min-h-[180px] sm:min-h-[200px] w-full min-w-0 flex flex-row items-center gap-3 max-h-[280px]">
                <ul className="shrink-0 flex flex-col gap-1.5 text-xs sm:text-sm" aria-label="การชำระเงิน">
                  {paymentPieData.map((entry, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <span
                        className="shrink-0 w-3 h-3 rounded-sm"
                        style={{ backgroundColor: entry.color }}
                        aria-hidden
                      />
                      <span className="text-slate-700 min-w-[4.5rem]">{entry.name}</span>
                      <span className="font-bold text-slate-900 tabular-nums text-right w-8">{entry.value}</span>
                    </li>
                  ))}
                  <li className="flex items-center gap-2 pt-1 mt-0.5 border-t border-slate-200">
                    <span className="w-3 shrink-0" aria-hidden />
                    <span className="text-slate-600 font-medium min-w-[4.5rem]">รวม</span>
                    <span className="font-bold text-slate-900 tabular-nums text-right w-8">
                      {summary.paid + summary.outstanding}
                    </span>
                  </li>
                </ul>
                <div className="flex-1 min-w-0 min-h-[160px]">
                  <ResponsiveContainer width="100%" height="100%" minHeight={160}>
                    <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      <Pie
                        data={paymentPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={68}
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
            )}
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-4 sm:p-6 shadow-sm min-h-0 flex flex-col">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-2 sm:mb-4 shrink-0">
              ผลการตรวจข้อมูล
            </h2>
            {approvalPieData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">
                ไม่มีข้อมูล
              </p>
            ) : (
              <div className="flex-1 min-h-[180px] sm:min-h-[200px] w-full min-w-0 flex flex-row items-center gap-3 max-h-[280px]">
                <ul className="shrink-0 flex flex-col gap-1.5 text-xs sm:text-sm min-w-[140px] sm:min-w-[160px]" aria-label="ผลการตรวจข้อมูล">
                  {approvalPieData.map((entry, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <span
                        className="shrink-0 w-3 h-3 rounded-sm"
                        style={{ backgroundColor: entry.color }}
                        aria-hidden
                      />
                      <span className="text-slate-700 break-words">{entry.fullName ?? entry.name}</span>
                      <span className="font-bold text-slate-900 shrink-0">{entry.value}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex-1 min-w-0 min-h-[160px]">
                  <ResponsiveContainer width="100%" height="100%" minHeight={160}>
                    <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      <Pie
                        data={approvalPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={68}
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
            )}
          </div>
        </div>
      </div>

      {topOutstanding.length >= 1 &&
        (() => {
          const top10 = topOutstanding.map((row, i) => ({
            ...row,
            rank: i + 1,
          }));
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
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
              {/* รายการที่เพิ่มล่าสุด 10 รายการ - แค่รายชื่อ */}
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
                      <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr] gap-2 sm:gap-3 text-slate-500 text-xs border-b border-slate-200 pb-1 hidden sm:grid">
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
                          <span className="min-w-0 truncate text-slate-800">{entry.name}</span>
                          <span className="min-w-0 truncate text-slate-700 hidden sm:block">{entry.requestFor || "-"}</span>
                          <span className="min-w-0 truncate text-slate-700" title={entry.plate || undefined}>
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
  const { summary, approvalBreakdown, topOutstanding, latestEntries } = data;
  const { paymentPieData, approvalPieData } = buildChartData(data);
  return (
    <ChartsRoot
      summary={summary}
      approvalBreakdown={approvalBreakdown ?? []}
      topOutstanding={topOutstanding}
      latestEntries={latestEntries ?? []}
      paymentPieData={paymentPieData}
      approvalPieData={approvalPieData}
    />
  );
}
