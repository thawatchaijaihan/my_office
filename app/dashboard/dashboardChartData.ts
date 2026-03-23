export type DashboardData = {
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
  latestEntries: { rowNumber: number; registeredAt: string; name: string; requestFor: string; plate: string }[];
};

const PAYMENT_COLORS = {
  paid: "#16a34a",
  outstanding: "#ef4444",
  deleted: "#64748b",
  dataIncorrect: "#b45309",
  pendingReview: "#0ea5e9",
};

export function buildChartData(data: DashboardData) {
  const { summary, approvalBreakdown } = data;
  const paymentPieData = [
    { name: "ชำระแล้ว", value: summary.paid, color: PAYMENT_COLORS.paid },
    { name: "ค้างชำระ", value: summary.outstanding, color: PAYMENT_COLORS.outstanding },
  ].filter((d) => d.value > 0);

  const approvalPieData = approvalBreakdown.map((item, i) => ({
    name: item.label.length > 20 ? item.label.slice(0, 18) + "..." : item.label,
    fullName: item.label,
    value: item.count,
    color: ["#0ea5e9", "#16a34a", "#ea580c", "#b45309", "#6366f1"][i % 5],
  }));

  return { paymentPieData, approvalPieData };
}
