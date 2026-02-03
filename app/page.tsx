export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-bold text-slate-800">
          Jaihan Assistant
        </h1>
        <p className="text-slate-600">
          LINE Bot AI powered by Google Gemini
        </p>
        <div className="rounded-lg bg-white border border-slate-200 p-6 text-left">
          <h2 className="font-semibold text-slate-700 mb-2">Webhook Endpoint</h2>
          <code className="text-sm text-slate-600 break-all">
            POST /api/webhook
          </code>
        </div>
      </div>
    </main>
  );
}
