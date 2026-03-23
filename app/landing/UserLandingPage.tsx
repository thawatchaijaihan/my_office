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
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwModalUrl, setPwModalUrl] = useState<string | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");

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
    const paidCount = results.filter((item) => ((item.statusM || "").toString().trim() === "ชำระเงินแล้ว")).length;
    const totalPaid = paidCount * 30;
    const remainingAmount = totalFee - totalPaid;

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
    if (
      s === "รับบัตรเรียบร้อบ" ||
      s === "รับบัตรเรียบร้อย" ||
      s === "รออนุมัติจาก ฝขว.พล.ป." ||
      s === "รอส่ง ฝขว.พล.ป." ||
      s === "ข้อมูลถูกต้อง"
    ) {
      return "#16a34a";
    }
    if (s === "ข้อมูลไม่ถูกต้อง") return "#dc2626";
    if (s === "") return "#dc2626";
    return "#6b7280";
  };

  const getPaymentBadgeColor = (status: string) => {
    if ((status ?? "").includes("ค้าง")) return "#dc2626";
    if ((status ?? "").includes("ชำระ")) return "#16a34a";
    return "#6b7280";
  };

  if (view === "home") {
    return (
      <main className="min-h-screen bg-white">
        {!isInIframe && (
          <div className="bg-gradient-to-r from-[#1e4620] to-[#2d5a2f] text-white py-16 px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="flex items-center justify-center mb-6">
                <img src="/unit-logo.png" alt="ตราหน่วย" className="w-24 h-24 object-contain" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">หมู่การข่าว ป.71 พัน.713</h1>
              <p className="text-xl text-white/90">ระบบบริการอิเล็กทรอนิกส์</p>
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSfCHZhNhdwIKiQoZH3FpSRZWTsuH5qOxD-DsTYAji2i7iKdCw/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white border-2 border-gray-200 hover:border-[#2d5a2f] p-8 transition-all duration-300 hover:shadow-lg"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-[#2d5a2f] group-hover:bg-[#1e4620] transition-colors flex items-center justify-center flex-shrink-0">
                  <svg fill="none" stroke="white" viewBox="0 0 24 24" className="w-7 h-7">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#1e4620]">ขอบัตรผ่านใหม่</h2>
              </div>
              <p className="text-gray-600 leading-relaxed">
                สำหรับขอบัตรผ่านใหม่ หรือลงข้อมูลใหม่ให้ถูกต้อง
              </p>
            </a>

            <button
              onClick={() => setView("search")}
              className="group bg-white border-2 border-gray-200 hover:border-[#2d5a2f] p-8 transition-all duration-300 hover:shadow-lg text-left w-full"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-[#2d5a2f] group-hover:bg-[#1e4620] transition-colors flex items-center justify-center flex-shrink-0">
                  <svg fill="none" stroke="white" viewBox="0 0 24 24" className="w-7 h-7">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#1e4620]">ค้นหาบัตรผ่าน</h2>
              </div>
              <p className="text-gray-600 leading-relaxed">
                ตรวจสอบสถานะการขอบัตรผ่านของคุณ
              </p>
            </button>

            <Link
              href="/cctv-map"
              className="group bg-white border-2 border-gray-200 hover:border-[#2d5a2f] p-8 transition-all duration-300 hover:shadow-lg"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-[#2d5a2f] group-hover:bg-[#1e4620] transition-colors flex items-center justify-center flex-shrink-0">
                  <svg fill="none" stroke="white" viewBox="0 0 24 24" className="w-7 h-7">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#1e4620]">ตรวจสอบกล้องวงจรปิด</h2>
              </div>
              <p className="text-gray-600 leading-relaxed">
                ตรวจสอบตำแหน่งและสถานะกล้องวงจรปิดในพื้นที่
              </p>
            </Link>

            <a
              href="/login"
              className="group bg-white border-2 border-gray-200 hover:border-[#2d5a2f] p-8 transition-all duration-300 hover:shadow-lg"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-[#2d5a2f] group-hover:bg-[#1e4620] transition-colors flex items-center justify-center flex-shrink-0">
                  <svg fill="none" stroke="white" viewBox="0 0 24 24" className="w-7 h-7">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#1e4620]">เจ้าหน้าที่ สาย.2</h2>
              </div>
              <p className="text-gray-600 leading-relaxed">
                สำหรับเจ้าหน้าที่เข้าสู่ระบบจัดการข้อมูล
              </p>
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-[#1e4620] to-[#2d5a2f] text-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => {
              setView("home");
              setResults([]);
              setError(false);
            }}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 font-medium flex items-center gap-2 mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            กลับหน้าหลัก
          </button>
          <h1 className="text-3xl font-bold">ค้นหาข้อมูลผู้ขอบัตรผ่าน</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center mb-6 space-y-2">
              <p className="text-gray-600">กรอกข้อมูล ยศ ชื่อ สกุล และ เบอร์โทร เพื่อตรวจสอบการลงทะเบียนเพื่อขอบัตรผ่านสำหรับยานพาหนะ</p>
              <p className="text-red-600 font-medium text-sm">หากขอบัตรผ่านให้กับ &quot;ตัวเอง&quot; รายชื่อผู้ถือจดทะเบียนรถต้องเป็นรายชื่อของผู้ขอบัตรผ่าน</p>
              <p className="text-green-600 font-medium text-sm">หากข้อมูลและหลักฐานถูกต้องกรุณาแจ้งชำระเงินค่าบัตรผ่านฯ ได้ที่ หมู่การข่าว ป.71 พัน.713</p>
            </div>

            <form onSubmit={handleSearch} className="space-y-4 max-w-xl mx-auto">
              <div>
                <label className="block text-gray-700 font-medium mb-2">ยศ ชื่อ สกุล</label>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d5a2f] focus:border-transparent"
                  placeholder="กรอกยศ ชื่อ สกุล"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">เบอร์โทร</label>
                <input
                  type="text"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d5a2f] focus:border-transparent"
                  placeholder="กรอกเบอร์โทร"
                  required
                />
              </div>
              <div className="flex justify-center pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#2d5a2f] hover:bg-[#1e4620] text-white font-medium py-3 px-12 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                  ค้นหา
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
                <p className="font-medium">ไม่พบข้อมูล</p>
                <p className="text-sm">กรุณาตรวจสอบเบอร์โทรของคุณอีกครั้ง</p>
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">ข้อมูลผู้ขอบัตร</h2>
                  {calculatePaymentInfo()}
                </div>
                <button
                  onClick={() => setResults([])}
                  className="text-gray-500 hover:text-gray-700 font-medium text-sm flex items-center gap-1 transition-colors px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  ล้าง
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map((item, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[#2d5a2f]">รายการที่ {index + 1}</span>
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-white border" style={{ color: getPaymentBadgeColor(item.statusM ?? "") }}>
                          {item.statusM ?? "-"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">{item.timestamp}</span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex gap-2">
                        <span className="text-gray-500 font-medium shrink-0">ยศ ชื่อ สกุล:</span>
                        <span className="font-medium text-gray-900">{item.rank} {item.firstName} {item.lastName}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-500 font-medium shrink-0">ขอให้:</span>
                        <span className="font-medium text-gray-900">{item.relation}</span>
                      </div>
                      <div className="flex gap-2 items-baseline">
                        <span className="text-gray-500 font-medium shrink-0">{item.vehicleType ?? ""}:</span>
                        <span className="font-medium text-gray-900">{item.vehicleModel ?? ""} / สี{item.vehicleColor ?? ""}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-500 font-medium shrink-0">ทะเบียนรถ:</span>
                        <span className="font-medium text-gray-900">{item.plate}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-500 font-medium shrink-0">สถานะ:</span>
                        {(() => {
                          const raw = (item.statusN ?? "").toString().trim();
                          const display = raw === "" ? "กรุณาแจ้ง สาย.2" : raw;
                          const color = getStatusColor(raw);
                          return (
                            <span className="font-semibold" style={{ color }}>
                              {display}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pwModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/50" onClick={() => setPwModalOpen(false)} />
              <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4 z-10">
                <h3 className="text-lg font-bold mb-3 text-gray-900">ตรวจสอบข้อมูลการขอบัตรผ่าน</h3>
                <p className="text-sm text-gray-600 mb-4">กรุณาใส่รหัสผ่านเพื่อเปิดเอกสาร</p>
                <input
                  type="password"
                  value={pwInput}
                  onChange={(e) => setPwInput(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d5a2f] mb-2"
                  placeholder="รหัสผ่าน"
                  autoFocus
                />
                {pwError && <p className="text-sm text-red-600 mb-3">{pwError}</p>}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setPwModalOpen(false);
                      setPwInput("");
                      setPwError("");
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
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
                    className="px-4 py-2 bg-[#2d5a2f] hover:bg-[#1e4620] text-white rounded-lg transition-colors"
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
