"use client";

import { useEffect, useState } from "react";
import { ref, onValue, type Database } from "firebase/database";
import { getClientDatabase } from "../cctv-map/lib/firebase";
import { CameraWithCheck } from "../cctv-map/data/types";
import { isCameraCheckedInCurrentHalf } from "../cctv-map/utils/checkUtils";
import "./report.css";

export default function CctvReportPage() {
  const [cameras, setCameras] = useState<CameraWithCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState<"all" | "functional">("all");

  useEffect(() => {
    let database: Database;
    try {
      database = getClientDatabase();
    } catch (error) {
      console.warn("[CCTV Report] initialize firebase database failed:", error);
      setLoading(false);
      return;
    }

    const camerasRef = ref(database, "cameras");
    const unsubscribe = onValue(camerasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const cameraList: CameraWithCheck[] = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val,
        }));
        // Sort by name or type if needed
        setCameras(cameraList.sort((a, b) => a.name.localeCompare(b.name, 'th')));
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-10 text-center">กำลังโหลดข้อมูล...</div>;
  }

  // Filter cameras based on display mode
  const filteredCameras = displayMode === "functional" 
    ? cameras.filter(isCameraCheckedInCurrentHalf)
    : cameras;

  // Chunk cameras into groups of 12 for paging
  const pageSize = 12;
  const pages = [];
  for (let i = 0; i < filteredCameras.length; i += pageSize) {
    pages.push(filteredCameras.slice(i, i + pageSize));
  }

  return (
    <div className="min-h-screen bg-slate-100 py-10 print:p-0 print:bg-white">
      <div className="no-print fixed top-5 right-5 z-50 flex flex-col items-end gap-3">
        <div className="flex bg-white rounded-md shadow-lg p-1 border border-slate-200">
          <button
            onClick={() => setDisplayMode("all")}
            className={`px-4 py-1.5 rounded text-xs font-bold transition ${
              displayMode === "all" ? "bg-[#12674A] text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            แสดงทุกกล้อง
          </button>
          <button
            onClick={() => setDisplayMode("functional")}
            className={`px-4 py-1.5 rounded text-xs font-bold transition ${
              displayMode === "functional" ? "bg-[#12674A] text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            ตรวจสอบแล้ว
          </button>
        </div>
        <button
          onClick={handlePrint}
          className="bg-white text-white h-14 w-14 flex items-center justify-center rounded-full shadow-[0_0_15px_rgba(18,103,74,0.4)] hover:shadow-[0_0_20px_rgba(18,103,74,0.6)] transition-all border-2 border-[#12674A]"
          title="พิมพ์รายงาน (A4)"
        >
          <span className="text-2xl">🖨️</span>
        </button>
      </div>

      {pages.map((pageItems, pageIdx) => (
        <div key={pageIdx} className="report-page">
          <header className="report-header">
            <h1>รายงานการตรวจสอบกล้องวงจรปิด</h1>
            <p>หน่วย ป.71 พัน.713</p>
          </header>

          <div className="report-content">
            {pageItems.map((camera) => {
              const isChecked = isCameraCheckedInCurrentHalf(camera);
              return (
                <div key={camera.id} className="camera-item">
                  <div className="relative-container">
                    {camera.lastCheckedImage ? (
                      <img
                        src={camera.lastCheckedImage.replace(/%25/g, '%')}
                        alt={camera.name}
                        className="camera-image"
                      />
                    ) : (
                      <div className="camera-image flex items-center justify-center text-slate-400 italic text-xs">
                        ไม่มีรูปภาพ
                      </div>
                    )}
                    {!isChecked && (
                      <div className="status-overlay">
                        กรุณาตรวจสอบ
                      </div>
                    )}
                  </div>
                  <div className="camera-info">
                    <span className="camera-label">
                      {camera.name} : {camera.description}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <footer className="report-footer">
            <div className="report-footer-content">
              <div className="signature-block">
                <p className="sig-line-1">ตรวจถูกต้อง</p>
                <p className="sig-line-2">ร.ต.</p>
                <p className="sig-line-3">(ชัยชนะ   ศรีเชื้อ)</p>
                <p className="sig-line-4">นชง. ป.71 พัน.713 ปฏิบัติหน้าที่</p>
                <p className="sig-line-5">ฝอ.2 ป.71 พัน.713</p>
              </div>
            </div>
          </footer>
        </div>
      ))}
    </div>
  );
}
