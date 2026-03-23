"use client";

import { CameraType } from "../data/types";

const typeOptions: CameraType[] = [
  "ป.71 พัน.713",
  "ป.71 พัน.713 ร้อย.1",
  "ป.71 พัน.713 ร้อย.2",
  "ป.71 พัน.713 ร้อย.3",
  "ร้อย.บก.ป.71 พัน.713",
  "ร้อย.บร.ป.71 พัน.713",
];

const typeLabels: Record<CameraType, string> = {
  "ป.71 พัน.713": "ป.71 พัน.713",
  "ป.71 พัน.713 ร้อย.1": "ร้อย.ป.ที่ 1",
  "ป.71 พัน.713 ร้อย.2": "ร้อย.ป.ที่ 2",
  "ป.71 พัน.713 ร้อย.3": "ร้อย.ป.ที่ 3",
  "ร้อย.บก.ป.71 พัน.713": "ร้อย.บก.",
  "ร้อย.บร.ป.71 พัน.713": "ร้อย.บร.",
};

type FilterPanelProps = {
  activeTypes: CameraType[];
  typeCheckStatus: Record<CameraType, boolean>;
  onToggleType: (type: CameraType, event?: React.MouseEvent) => void;
  onFilterPointerDown: (type: CameraType, e: React.PointerEvent) => void;
  onFilterClick: (type: CameraType, e: React.MouseEvent) => void;
  clearLongPressTimer: () => void;
};

export default function FilterPanel({
  activeTypes,
  typeCheckStatus,
  onToggleType,
  onFilterPointerDown,
  onFilterClick,
  clearLongPressTimer,
}: FilterPanelProps) {
  return (
    <>
      {/* Desktop Filter Panel (Sidebar) */}
      <div className="hidden space-y-2 lg:block">
        <p className="text-[10px] text-zinc-500">กด Ctrl ค้างเพื่อเลือกหลายตัว</p>
        <div className="grid w-full grid-cols-3 gap-1">
          {typeOptions.map((type) => (
            <button
              key={type}
              type="button"
              onClick={(e) => onToggleType(type, e)}
              className={`inline-flex w-full items-center justify-center border px-1 py-2 text-center text-[11px] font-medium transition ${
                activeTypes.includes(type)
                  ? typeCheckStatus[type] === false
                    ? "border-red-600 bg-red-600 text-white ring-2 ring-red-600 ring-offset-1"
                    : "border-green-700 bg-green-700 text-white ring-2 ring-green-700 ring-offset-1"
                  : typeCheckStatus[type] === false
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-green-700 bg-green-700 text-white hover:bg-green-800"
              }`}
            >
              {typeLabels[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Filter Panel */}
      <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 bg-white p-3 lg:hidden">
        <p className="col-span-3 text-[10px] text-zinc-500">แตะเลือก 1 ตัว / กดค้างเพื่อเลือกหลายตัว</p>
        {typeOptions.map((type) => (
          <button
            key={type}
            type="button"
            onPointerDown={(e) => onFilterPointerDown(type, e)}
            onPointerUp={clearLongPressTimer}
            onPointerLeave={clearLongPressTimer}
            onPointerCancel={clearLongPressTimer}
            onClick={(e) => onFilterClick(type, e)}
            className={`w-full border px-3 py-2 text-sm font-medium transition ${
              activeTypes.includes(type)
                ? typeCheckStatus[type] === false
                  ? "border-red-600 bg-red-600 text-white ring-2 ring-red-600 ring-offset-1"
                  : "border-green-700 bg-green-700 text-white ring-2 ring-green-700 ring-offset-1"
                : typeCheckStatus[type] === false
                  ? "border-red-600 bg-red-600 text-white"
                  : "border-green-700 bg-green-700 text-white ring-0"
            }`}
          >
            {typeLabels[type]}
          </button>
        ))}
      </div>
    </>
  );
}

export { typeOptions, typeLabels };
