import CctvMap from "./components/CctvMap";

export const metadata = {
  title: "แผนที่กล้อง CCTV",
  description: "แผนที่แสดงตำแหน่งกล้อง CCTV",
};

export default function PublicCctvMapPage() {
  return (
    <div className="min-h-screen overflow-y-auto bg-white font-sans text-zinc-900 sm:h-screen sm:overflow-hidden">
      <main className="flex min-h-0 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 sm:h-full sm:overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto sm:overflow-hidden">
          <CctvMap isAdminMode={false} />
        </div>
      </main>
    </div>
  );
}
