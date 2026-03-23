"use client";

import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "../cctv-map/lib/firebase";
import { CameraWithCheck } from "../cctv-map/data/types";
import "./report.css";

export default function CctvReportPage() {
  const [cameras, setCameras] = useState<CameraWithCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  // Chunk cameras into groups of 12 for paging
  const pageSize = 12;
  const pages = [];
  for (let i = 0; i < cameras.length; i += pageSize) {
    pages.push(cameras.slice(i, i + pageSize));
  }

  return (
    <div className="min-h-screen bg-slate-100 py-10 print:p-0 print:bg-white">
      <div className="no-print fixed top-5 right-5 z-50">
        <button
          onClick={handlePrint}
          className="bg-blue-600 text-white px-6 py-2 rounded-full shadow-lg hover:bg-blue-700 transition"
        >
          🖨️ พิมพ์รายงาน (A4)
        </button>
      </div>

      {pages.map((pageItems, pageIdx) => (
        <div key={pageIdx} className="report-page">
          <header className="report-header">
            <h1>รายงานการตรวจสอบกล้องวงจรปิด</h1>
            <p>หน่วย ป.71 พัน.713</p>
          </header>

          <div className="report-content">
            {pageItems.map((camera) => (
              <div key={camera.id} className="camera-item">
                {camera.lastCheckedImage ? (
                  <img
                    src={camera.lastCheckedImage}
                    alt={camera.name}
                    className="camera-image"
                  />
                ) : (
                  <div className="camera-image flex items-center justify-center text-slate-400 italic text-xs">
                    ไม่มีรูปภาพ
                  </div>
                )}
                <div className="camera-info">
                  <span className="camera-name">{camera.name}</span>
                  <span className="camera-desc">{camera.description}</span>
                </div>
              </div>
            ))}
          </div>

          <footer className="report-footer">
            <div className="report-footer-content">
              <p>ตรวจถูกต้อง</p>
              <p>ร.ต.</p>
              <p>(ชัยชนะ   ศรีเชื้อ)</p>
              <p>นชง. ป.71 พัน.713 ปฏิบัติหน้าที่</p>
              <p>ฝอ.2 ป.71 พัน.713</p>
            </div>
          </footer>
        </div>
      ))}
    </div>
  );
}
