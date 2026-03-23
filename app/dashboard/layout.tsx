import type { Metadata } from "next";
import DashboardAuthGate from "./DashboardAuthGate";

export const metadata: Metadata = {
  title: "แดชบอร์ด | Jaihan Assistant",
  description: "สรุปข้อมูลการขอบัตรผ่าน",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardAuthGate>{children}</DashboardAuthGate>;
}
