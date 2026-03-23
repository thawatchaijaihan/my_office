"use client";

import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "../cctv-map/lib/firebase";
import { CameraWithCheck, CameraType } from "../cctv-map/data/types";
import { typeOptions } from "../cctv-map/components/FilterPanel";
import { isCameraCheckedInCurrentHalf } from "../cctv-map/utils/checkUtils";
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
        setCameras(cameraList);
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

  const groupedCameras = typeOptions.reduce((acc, type) => {
    acc[type] = cameras.filter((c) => c.type === type);
    return acc;
  }, {} as Record<CameraType, CameraWithCheck[]>);

  const now = new Date();
  const dateString = now.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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

      <div className="report-container">
        <header className="report-header">
          <h1 className="text-2xl font-bold text-blue-800">รายงานสรุปการตรวจสอบกล้องวงจรปิด (CCTV)</h1>
          <p className="text-slate-600 mt-2">ประจำวันที่ {dateString}</p>
        </header>

        <div className="report-content">
          {typeOptions.map((type) => {
            const items = groupedCameras[type];
            if (items.length === 0) return null;

            return (
              <section key={type} className="flex flex-col gap-4">
                <h2 className="text-lg font-bold border-l-4 border-blue-600 pl-3 py-1 bg-slate-50">
                  หน่วย: {type}
                </h2>
                <div className="grid grid-cols-1 gap-6">
                  {items.map((camera) => {
                    const isChecked = isCameraCheckedInCurrentHalf(camera);
                    return (
                      <div key={camera.id} className="camera-item">
                        <div className="camera-info flex justify-between items-center">
                          <div>
                            <span className="font-bold text-slate-900">{camera.name}</span>
                            <span className="text-sm text-slate-500 ml-2">({camera.description})</span>
                          </div>
                          <div className={`text-sm font-bold ${isChecked ? 'text-green-600' : 'text-red-500'}`}>
                            {isChecked ? '✅ ตรวจสอบแล้ว' : '⚠️ ยังไม่ได้ตรวจสอบ'}
                          </div>
                        </div>
                        {camera.lastCheckedImage ? (
                          <img
                            src={camera.lastCheckedImage}
                            alt={camera.name}
                            className="camera-image"
                          />
                        ) : (
                          <div className="camera-image flex items-center justify-center text-slate-400 italic text-sm">
                            ไม่มีรูปภาพการตรวจสอบ
                          </div>
                        )}
                        {isChecked && camera.lastCheckedAt && (
                          <div className="text-[10pt] text-slate-500 px-3 py-1 text-right bg-white">
                            เวลาที่ตรวจสอบ: {new Date(camera.lastCheckedAt).toLocaleString("th-TH")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="report-footer">
          <p>จัดทำโดย ระบบบริหารจัดการกล้องวงจรปิด (Jaihan Assistant)</p>
          <p className="text-[8pt] mt-1">วันที่พิมพ์: {new Date().toLocaleString("th-TH")}</p>
        </footer>
      </div>
    </div>
  );
}
