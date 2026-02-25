"use client";

import { useState, useEffect } from "react";
import { CameraWithCheck, CameraType } from "../data/types";

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

type EditCameraModalProps = {
  isOpen: boolean;
  camera: CameraWithCheck | null;
  mode: 'add' | 'edit';
  defaultType: CameraType;
  onClose: () => void;
  onSubmit: (camera: CameraWithCheck) => void;
};

export default function EditCameraModal({
  isOpen,
  camera,
  mode,
  defaultType,
  onClose,
  onSubmit,
}: EditCameraModalProps) {
  const [draft, setDraft] = useState<CameraWithCheck | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (camera && mode === 'edit') {
        setDraft({ ...camera });
      } else {
        setDraft({
          id: "",
          name: "",
          description: "",
          type: defaultType,
          status: "online",
          lat: 14.867212037496559,
          lng: 100.63490078774039,
        });
      }
    }
  }, [isOpen, camera, mode, defaultType]);

  if (!isOpen || !draft) return null;

  const handleSubmit = () => {
    if (!draft.name.trim()) {
      window.alert(mode === 'edit' ? "กรุณากรอกชื่อกล้อง" : "กรุณากรอกชื่อกล้อง");
      return;
    }
    onSubmit(draft);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg border border-zinc-200 bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-green-900">
            {mode === 'edit' ? 'แก้ไขข้อมูลกล้อง' : 'เพิ่มกล้อง'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="text-zinc-400 hover:text-zinc-700"
          >
            ×
          </button>
        </div>

        <div className="mt-4 grid gap-3 text-sm">
          <label className="grid gap-1">
            ชื่อกล้อง
            <input
              className="border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
              value={draft.name}
              onChange={(event) =>
                setDraft((prev) =>
                  prev ? { ...prev, name: event.target.value } : prev,
                )
              }
            />
          </label>

          <label className="grid gap-1">
            คำอธิบาย
            <textarea
              rows={3}
              className="border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
              value={draft.description}
              onChange={(event) =>
                setDraft((prev) =>
                  prev ? { ...prev, description: event.target.value } : prev,
                )
              }
            />
          </label>

          <div className="grid gap-3">
            <label className="grid gap-1">
              ประเภท
              <select
                className="border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                value={draft.type}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          type: event.target.value as CameraType,
                        }
                      : prev,
                  )
                }
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {typeLabels[type]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              ละติจูด
              <input
                type="number"
                step="0.000001"
                className="border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                value={draft.lat}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev
                      ? { ...prev, lat: Number(event.target.value) }
                      : prev,
                  )
                }
              />
            </label>
            <label className="grid gap-1">
              ลองจิจูด
              <input
                type="number"
                step="0.000001"
                className="border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                value={draft.lng}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev
                      ? { ...prev, lng: Number(event.target.value) }
                      : prev,
                  )
                }
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="border border-green-700 bg-green-700 px-3 py-1 text-xs font-medium text-white"
          >
            {mode === 'edit' ? 'บันทึก' : 'เพิ่มกล้อง'}
          </button>
        </div>
      </div>
    </div>
  );
}

export { typeLabels };
