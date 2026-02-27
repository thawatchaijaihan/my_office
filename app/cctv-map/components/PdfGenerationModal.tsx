"use client";

type PdfGenerationModalProps = {
  isOpen: boolean;
  pdfReady: boolean;
  pdfUrl: string | null;
  onClose: () => void;
};

export default function PdfGenerationModal({
  isOpen,
  pdfReady,
  pdfUrl,
  onClose,
}: PdfGenerationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5 rounded-2xl bg-white p-8 shadow-2xl min-w-[320px]">
        <div className="relative">
          {pdfReady ? (
            <div className="h-16 w-16 flex items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-10 w-10 text-green-600 animate-bounce"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <polyline points="9 15 12 18 15 15" />
                <line x1="12" y1="12" x2="12" y2="18" />
              </svg>
            </div>
          ) : (
            <>
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-green-100 border-t-green-600" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  className="h-8 w-8 text-green-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
            </>
          )}
        </div>
        {pdfReady && pdfUrl ? (
          <>
            <div className="text-center font-sans">
              <h3 className="text-xl font-bold text-green-600">สร้าง PDF เสร็จสมบูรณ์</h3>
              <p className="text-sm text-zinc-500 mt-1">
                วันที่ {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                เวลา {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <a
                href={pdfUrl}
                download={`cctv-report-${new Date().toISOString().split('T')[0]}.pdf`}
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3.5 font-medium text-white transition hover:bg-green-700 hover:scale-105 active:scale-95 shadow-lg shadow-green-200"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                ดาวน์โหลด PDF
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pdfUrl);
                  alert('คัดลอกลิงก์แล้ว!');
                }}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-zinc-200 px-6 py-2.5 font-medium text-zinc-600 transition hover:bg-zinc-50 hover:border-zinc-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                คัดลอกลิงก์
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-sm text-zinc-400 hover:text-zinc-600 transition"
            >
              ปิด
            </button>
          </>
        ) : (
          <div className="text-center font-sans">
            <h3 className="text-lg font-bold text-zinc-900">กำลังสร้าง PDF</h3>
            <p className="text-sm text-zinc-500 mt-1">กรุณารอสักครู่...</p>
            <p className="text-xs text-zinc-400 mt-2">กำลังประมวลผลภาพและจัดหน้า</p>
          </div>
        )}
      </div>
    </div>
  );
}
