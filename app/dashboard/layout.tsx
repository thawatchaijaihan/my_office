import Link from "next/link";
import type { Metadata } from "next";
import DashboardNav from "./DashboardNav";

export const metadata: Metadata = {
  title: "แดชบอร์ด | Jaihan Assistant",
  description: "สรุปข้อมูลการขอบัตรผ่าน",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex overflow-hidden bg-slate-100">
      {/* Sidebar - โครงแบบ NextAdmin: logo + nav + footer */}
      <aside
        className="flex w-64 shrink-0 flex-col bg-slate-800 text-white"
        aria-label="เมนูด้านข้าง"
      >
        <div className="shrink-0 border-b border-slate-700 p-4">
          <Link href="/" className="flex items-center gap-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-800">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-xl font-bold">
              J
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-sm">ระบบขอบัตรผ่าน</div>
              <div className="text-xs text-slate-400">Jaihan Assistant</div>
            </div>
          </Link>
        </div>
        <DashboardNav />
        <div className="shrink-0 border-t border-slate-700 p-3">
          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-800"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            กลับหน้าหลัก
          </Link>
        </div>
      </aside>
      {/* Main - พื้นที่เนื้อหา scroll ได้ */}
      <main
        className="flex min-h-0 flex-1 flex-col bg-slate-100 min-[400px]:min-w-0"
        role="main"
        aria-label="เนื้อหาแดชบอร์ด"
      >
        <div className="min-h-0 flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
