"use client";

import Link from "next/link";
import { DashboardAuthProvider, useDashboardAuth } from "./DashboardAuthContext";
import { DashboardLogin } from "./DashboardLogin";
import DashboardNav from "./DashboardNav";
import { isFirebaseAuthEnabled } from "@/lib/firebaseClient";

import { useState } from "react";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useDashboardAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">กำลังโหลด...</p>
      </div>
    );
  }

  if (isFirebaseAuthEnabled() && !user) {
    return <DashboardLogin />;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-slate-100">
      {/* Sidebar Aside */}
      <aside
        className={`flex h-full shrink-0 flex-col bg-slate-800 text-white transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "w-64 md:w-56 lg:w-64" : "w-0 overflow-hidden"
        }`}
        aria-label="เมนูด้านข้าง"
      >
        <div className="shrink-0 border-b border-slate-700 p-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-800 overflow-hidden"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-xl font-bold">
              J
            </div>
            <div className={`min-w-0 transition-opacity duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0"}`}>
              <div className="truncate font-semibold text-sm">ระบบขอบัตรผ่าน</div>
              <div className="text-xs text-slate-400">Jaihan Assistant</div>
            </div>
          </Link>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden lg:hidden p-1 hover:bg-slate-700 rounded text-slate-400"
            title="ซ่อนเมนู"
          >
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <DashboardNav />
        <div className="shrink-0 border-t border-slate-700 p-3 space-y-2">
          {user && (
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-3 py-2.5 text-sm text-white hover:bg-slate-600 truncate"
            >
              ออกจากระบบ
            </button>
          )}
          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 truncate"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className={isSidebarOpen ? "opacity-100" : "opacity-0"}>กลับหน้าหลัก</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex min-h-0 flex-1 flex-col bg-slate-100 min-[400px]:min-w-0" role="main">
        {/* Toggle Header for when sidebar is closed or for easy access */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-white px-4 md:px-6">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-slate-500 hover:bg-slate-50 focus:outline-none"
            aria-label={isSidebarOpen ? "ซ่อนเมนู" : "แสดงเมนู"}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isSidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <div className="flex-1 font-medium text-slate-700">แดชบอร์ด</div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}

export default function DashboardAuthGate({ children }: { children: React.ReactNode }) {
  return (
    <DashboardAuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </DashboardAuthProvider>
  );
}
