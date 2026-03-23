import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "รายการรอตรวจ | Jaihan Assistant",
  description: "รายการที่ N ว่าง",
};

export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
