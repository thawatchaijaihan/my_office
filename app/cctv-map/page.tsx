import CctvMap from "./components/CctvMap";

export default function PublicCctvMapPage() {
  return (
    <div className="min-h-screen overflow-y-auto bg-white font-sans text-zinc-900 lg:h-screen lg:overflow-hidden">
      <main className="flex min-h-0 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:h-full lg:overflow-hidden">
        <header className="shrink-0 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2 lg:hidden">
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
          <CctvMap isAdminMode={false} />
        </div>
      </main>
    </div>
  );
}
