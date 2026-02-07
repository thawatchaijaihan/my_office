export default function Home() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ backgroundColor: "#f8fafc", color: "#0f172a" }}
    >
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-bold text-slate-800" style={{ color: "#1e293b" }}>
          Jaihan Assistant
        </h1>
        <p className="text-slate-600" style={{ color: "#475569" }}>
          LINE Bot AI powered by Google Gemini
        </p>
        <div
          className="rounded-lg border p-6 text-left space-y-4"
          style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}
        >
          <div>
            <h2 className="font-semibold text-slate-700 mb-2">Webhook Endpoint</h2>
            <code className="text-sm text-slate-600 break-all">
              POST /api/webhook
            </code>
          </div>
          <div>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
            >
              เปิดแดชบอร์ดสรุปข้อมูล
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
