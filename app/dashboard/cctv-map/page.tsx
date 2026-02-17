import CctvMap from "@/app/cctv-map/components/CctvMap";

export default function AdminCctvMapPage() {
  return (
    <div className="h-full w-full min-h-0 overflow-hidden">
      <CctvMap isAdminMode={true} />
    </div>
  );
}
