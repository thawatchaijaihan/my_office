"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const API_URL = "/api/search";

interface SearchResult {
  timestamp: string;
  rank: string;
  firstName: string;
  lastName: string;
  relation: string;
  phone: string;
  vehicleType?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  plate: string;
  image: string;
  statusM: string;
  statusN?: string;
  paidAmount?: number;
  approvedPassNumber?: string;
}

export default function UserLandingPage() {
  const [view, setView] = useState<"home" | "search">("home");
  const [searchPhone, setSearchPhone] = useState("");
  const [searchName, setSearchName] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  // Password modal state for opening protected links
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwModalUrl, setPwModalUrl] = useState<string | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");

  // ตรวจสอบว่าอยู่ใน iframe หรือไม่
  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    setResults([]);

    try {
      const response = await fetch(`${API_URL}?q=${encodeURIComponent(searchPhone)}`);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        setResults(data.results);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Search Error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const calculatePaymentInfo = () => {
    if (results.length === 0) return null;
    const totalFee = results.length * 30;

    // นับจำนวนรายการที่คอลัมน์ M ระบุชัดเจนว่าเป็น 'ชำระเงินแล้ว' (ไม่รวม 'ค้างชำระเงิน')
    const paidCount = results.filter((item) => ((item.statusM || "").toString().trim() === "ชำระเงินแล้ว")).length;
    const totalPaid = paidCount * 30;
    const remainingAmount = totalFee - totalPaid;

    // Debug: แสดงข้อมูลการคำนวณโดยอิงจากคอลัมน์ M
    console.log("=== Payment Calculation (from column M) Debug ===");
    console.log("จำนวนรายการ:", results.length);
    console.log("ค่าธรรมเนียมทั้งหมด:", totalFee, "บาท");
    console.log("จำนวนรายการที่ระบุเป็นชำระเงินแล้ว (คอลัมน์ M):", paidCount);
    console.log("ยอดที่ชำระ (คำนวณจากจำนวน):", totalPaid, "บาท");
    console.log("ยอดค้างชำระ:", remainingAmount, "บาท");
    console.log("รายละเอียดแต่ละรายการ:");
    results.forEach((item, index) => {
      console.log(`  รายการที่ ${index + 1}:`, {
        name: `${item.rank} ${item.firstName} ${item.lastName}`,
        plate: item.plate,
        statusM: item.statusM,
        statusN: item.statusN,
        approvedPassNumber: item.approvedPassNumber,
      });
    });
    console.log("================================");

    return (
      <div className="mt-1 text-sm font-semibold">
        พบข้อมูล {results.length} รายการ
        {remainingAmount === 0 ? (
          <>
            {" "}
            <span className="text-green-600 underline font-bold">ชำระเงินเรียบร้อย</span>
          </>
        ) : totalPaid > 0 ? (
          <>
            {" "}
            <span className="text-green-600 underline">ชำระแล้ว {totalPaid} บาท</span>
            {" "}
            <span className="text-red-600 underline font-bold">ค้างชำระ {remainingAmount} บาท</span>
          </>
        ) : (
          <>
            {" "}
            <span className="text-red-600 underline font-bold">ยังไม่ชำระเงิน (ค้าง {totalFee} บาท)</span>
          </>
        )}
      </div>
    );
  };

  const getStatusColor = (status: string) => {
    const s = (status ?? "").trim();
    // Green statuses
    if (
      s === "รับบัตรเรียบร้อบ" ||
      s === "รออนุมัติจาก ฝขว.พล.ป." ||
      s === "รอส่ง ฝขว.พล.ป." ||
      s === "ข้อมูลถูกต้อง"
    ) {
      return "#16a34a";
    }
    // Red statuses
    if (s === "ข้อมูลไม่ถูกต้อง") return "#dc2626";
    if (s === "") return "#dc2626";
    // default gray
    return "#6b7280";
  };

  const getPaymentBadgeColor = (status: string) => {
    if ((status ?? "").includes("ค้าง")) return "#dc2626";
    if ((status ?? "").includes("ชำระ")) return "#16a34a";
    return "#6b7280";
  };

  if (view === "home") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-8 flex flex-col items-center justify-center font-sans">
        {!isInIframe && (
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 drop-shadow-lg">หมู่การข่าว ป.71 พัน.713</h1>
            <p className="text-xl text-white opacity-90">กรุณาเลือกรายการที่ต้องการใช้บริการ</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSfCHZhNhdwIKiQoZH3FpSRZWTsuH5qOxD-DsTYAji2i7iKdCw/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-[20px] p-10 shadow-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_50px_rgba(102,126,234,0.3)] group"
          >
            <div className="w-[70px] h-[70px] mx-auto mb-6 bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-[15px] flex items-center justify-center">
              <svg fill="none" stroke="white" viewBox="0 0 24 24" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-center mb-3 text-[#667eea]">ขอบัตรผ่านใหม่</h2>
            <p className="text-gray-600 text-center leading-relaxed whitespace-pre-line">
              สำหรับผู้ที่ต้องการขอบัตรผ่านใหม่ หรือเพื่อลงข้อมูลใหม่แทนข้อมูลเดิมให้ถูกต้อง
            </p>
          </a>

          <button
            onClick={() => setView("search")}
            className="bg-white rounded-[20px] p-10 shadow-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_50px_rgba(102,126,234,0.3)] group text-left"
          >
            <div className="w-[70px] h-[70px] mx-auto mb-6 bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-[15px] flex items-center justify-center">
              <svg fill="none" stroke="white" viewBox="0 0 24 24" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-center mb-3 text-[#667eea]">ค้นหาบัตรผ่าน</h2>
            <p className="text-gray-600 text-center leading-relaxed">ตรวจสอบสถานะการขอบัตรผ่านของคุณ</p>
          </button>

          <a
            href="https://jaihan-assistant--jaihan-assistant.asia-southeast1.hosted.app/cctv-map"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-[20px] p-10 shadow-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_50px_rgba(102,126,234,0.3)] group"
          >
            <div className="w-[70px] h-[70px] mx-auto mb-6 bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-[15px] flex items-center justify-center">
              <svg fill="none" stroke="white" viewBox="0 0 24 24" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-center mb-3 text-[#667eea]">ตรวจสอบกล้องวงจรปิด</h2>
            <p className="text-gray-600 text-center leading-relaxed whitespace-pre-line">
              ตรวจสอบตำแหน่งและสถานะของกล้องวงจรปิดในพื้นที่
            </p>
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-4 md:p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => {
            setView("home");
            setResults([]);
            setError(false);
          }}
          className="bg-white text-[#667eea] px-6 py-3 rounded-xl font-bold flex items-center gap-2 mb-6 shadow-lg transition-transform hover:-translate-y-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          กลับหน้าหลัก
        </button>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <h1 className="text-2xl font-bold text-center mb-2 text-[#667eea]">ค้นหาข้อมูลผู้ขอบัตรผ่าน</h1>
            <div className="text-center text-gray-600 mb-6 text-sm">
              <p>กรอกข้อมูล ยศ ชื่อ สกุล และ เบอร์โทร เพื่อตรวจสอบการลงทะเบียนเพื่อขอบัตรผ่านสำหรับยานพาหนะ</p>
              <p className="text-red-600 font-semibold">หากขอบัตรผ่านให้กับ &quot;ตัวเอง&quot; รายชื่อผู้ถือจดทะเบียนรถต้องเป็นรายชื่อของผู้ขอบัตรผ่าน</p>
              <p className="text-green-600 font-semibold">หากข้อมูลและหลักฐานถูกต้องกรุณาแจ้งชำระเงินค่าบัตรผ่านฯ ได้ที่ หมู่การข่าว ป.71 พัน.713</p>
            </div>

            <form onSubmit={handleSearch} className="space-y-4 max-w-xl mx-auto">
              <div>
                <label className="block text-gray-700 font-semibold mb-1.5 text-sm italic">ยศ ชื่อ สกุล</label>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition-all focus:-translate-y-0.5"
                  placeholder="กรอกยศ ชื่อ สกุล"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1.5 text-sm italic">เบอร์โทร</label>
                <input
                  type="text"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition-all focus:-translate-y-0.5"
                  placeholder="กรอกเบอร์โทร"
                  required
                />
              </div>
              <div className="flex justify-center pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white font-bold py-3 px-10 rounded-lg transition-all hover:-translate-y-1 hover:shadow-lg disabled:opacity-70 flex items-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                  ค้นหา
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg animate-pulse">
                <p className="font-bold">ไม่พบข้อมูล</p>
                <p className="text-xs">กรุณาตรวจสอบเบอร์โทรของคุณอีกครั้ง</p>
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-2xl animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[#667eea]">ข้อมูลผู้ขอบัตร</h2>
                  {calculatePaymentInfo()}
                </div>
                <button
                  onClick={() => setResults([])}
                  className="text-gray-500 hover:text-gray-700 font-bold text-sm flex items-center gap-1 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  ล้าง
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map((item, index) => (
                  <div key={index} className="bg-gradient-to-br from-[#f8f9ff] to-[#f0f4ff] border-2 border-indigo-50 rounded-xl p-4 transition-all hover:-translate-y-1 hover:shadow-md">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-purple-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-purple-700">รายการที่ {index + 1}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white shadow-sm" style={{ color: getPaymentBadgeColor(item.statusM ?? "") }}>
                          {item.statusM ?? "-"}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-gray-400">{item.timestamp}</span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex gap-2">
                        <span className="text-gray-500 font-bold shrink-0">ยศ ชื่อ สกุล:</span>
                        <span className="font-semibold text-gray-800">{item.rank} {item.firstName} {item.lastName}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-500 font-bold shrink-0">ขอให้ :</span>
                        <span className="font-semibold text-gray-800">{item.relation}</span>
                      </div>
                      <div className="flex gap-2 items-baseline">
                        <span className="text-gray-500 font-bold shrink-0">{item.vehicleType ?? ""}:</span>
                        <span className="font-semibold text-gray-800">{item.vehicleModel ?? ""} / สี{item.vehicleColor ?? ""}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-500 font-bold shrink-0">ทะเบียนรถ:</span>
                        <span className="font-semibold text-gray-800">{item.plate}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-500 font-bold shrink-0">สถานะ:</span>
                        {(() => {
                          const raw = (item.statusN ?? "").toString().trim();
                          const display = raw === "" ? "กรุณาแจ้ง สาย.2" : raw;
                          const color = getStatusColor(raw);
                          return (
                            <span className="font-bold" style={{ color }}>
                              {display}
                            </span>
                          );
                        })()}
                      </div>
                      {item.image && item.image !== "-" && (
                        <div className="flex gap-2 items-center">
                          <button
                            onClick={() => {
                              setPwModalUrl(item.image);
                              setPwInput("");
                              setPwError("");
                              setPwModalOpen(true);
                            }}
                            className="text-sm font-semibold text-blue-600 hover:underline truncate"
                          >
                            ตรวจสอบข้อมูลการขอบัตรผ่าน
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        {/* Password modal */}
        {pwModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setPwModalOpen(false)} />
            <div className="relative bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl z-10">
              <h3 className="text-lg font-bold mb-3">ตรวจสอบข้อมูลการขอบัตรผ่าน</h3>
              <p className="text-sm text-gray-600 mb-3">กรุณาใส่รหัสผ่านเพื่อเปิดเอกสาร</p>
              <input
                type="password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg mb-2"
                placeholder="รหัสผ่าน"
                autoFocus
              />
              {pwError && <p className="text-sm text-red-600 mb-2">{pwError}</p>}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setPwModalOpen(false);
                    setPwInput("");
                    setPwError("");
                  }}
                  className="px-4 py-2 bg-gray-100 rounded-lg"
                >ยกเลิก</button>
                <button
                  onClick={() => {
                    if (pwInput === "713713713") {
                      if (pwModalUrl) window.open(pwModalUrl, "_blank", "noopener,noreferrer");
                      setPwModalOpen(false);
                      setPwInput("");
                      setPwError("");
                    } else {
                      setPwError("รหัสผ่านไม่ถูกต้อง");
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >เปิด</button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </main>
  );
}

// Inline password modal component is rendered inside the page component tree.

