"use client";

import Link from "next/link";

const DEFAULT_CCTV_MAP_URL = "https://map-cctv--gate-pass-713.asia-southeast1.hosted.app/";
const CCTV_MAP_URL = process.env.NEXT_PUBLIC_CCTV_MAP_URL?.trim() || DEFAULT_CCTV_MAP_URL;

export default function CctvMapPage() {
  if (CCTV_MAP_URL) {
    return (
      <div className="h-full w-full min-h-0">
        <iframe
          src={CCTV_MAP_URL}
          title="แผนที่ติดตั้งกล้องวงจรปิด"
          className="h-full w-full border-0 bg-white"
          allow="geolocation"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6" style={{ backgroundColor: "#f1f5f9" }}>
      <h1 className="text-lg font-medium text-slate-800">แผนที่ติดตั้งกล้องวงจรปิด</h1>
      <p className="text-slate-600">ยังไม่ได้ตั้งค่า URL แผนที่ CCTV (NEXT_PUBLIC_CCTV_MAP_URL)</p>
      <Link href="/dashboard" className="text-emerald-600 underline hover:no-underline">
        กลับแดชบอร์ด
      </Link>
    </div>
  );
}
