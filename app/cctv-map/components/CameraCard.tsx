"use client";

import { memo } from "react";
import NextImage from "next/image";
import { CameraWithCheck, CameraType } from "../data/types";

const typeLabels: Record<CameraType, string> = {
  "ป.71 พัน.713": "ป.71 พัน.713",
  "ป.71 พัน.713 ร้อย.1": "ร้อย.ป.ที่ 1",
  "ป.71 พัน.713 ร้อย.2": "ร้อย.ป.ที่ 2",
  "ป.71 พัน.713 ร้อย.3": "ร้อย.ป.ที่ 3",
  "ร้อย.บก.ป.71 พัน.713": "ร้อย.บก.",
  "ร้อย.บร.ป.71 พัน.713": "ร้อย.บร.",
};

const statusBadge = {
  ok: "bg-green-100 text-green-800",
  missing: "bg-red-100 text-red-800",
  offline: "bg-zinc-200 text-zinc-700",
} as const;

type CameraCardProps = {
  camera: CameraWithCheck;
  isSelected: boolean;
  isChecked: boolean;
  isAdminMode: boolean;
  showImage: boolean;
  onSelect: (id: string) => void;
  onEdit: (camera: CameraWithCheck) => void;
  onMove: (id: string) => void;
  onDelete: (camera: CameraWithCheck) => void;
  onClearHistory: (camera: CameraWithCheck) => void;
  onUploadImage: (camera: CameraWithCheck, file: File) => void;
  onToggleImage: (id: string) => void;
};

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Invalid image data"));
        return;
      }

      const img = new Image();
      img.onload = () => {
        const MAX_IMAGE_DIMENSION = 1600;
        const MAX_IMAGE_BYTES = 512_000;

        const scale = Math.min(
          1,
          MAX_IMAGE_DIMENSION / Math.max(img.width, img.height),
        );
        const targetWidth = Math.max(1, Math.round(img.width * scale));
        const targetHeight = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        let quality = 0.88;
        const tryEncode = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Compression failed"));
                return;
              }
              if (blob.size <= MAX_IMAGE_BYTES || quality <= 0.5) {
                const outReader = new FileReader();
                outReader.onload = () => {
                  const out = outReader.result;
                  if (typeof out === "string") resolve(out);
                  else reject(new Error("Invalid output data"));
                };
                outReader.onerror = () => reject(new Error("Read error"));
                outReader.readAsDataURL(blob);
                return;
              }
              quality -= 0.1;
              tryEncode();
            },
            "image/jpeg",
            quality,
          );
        };

        tryEncode();
      };
      img.onerror = () => reject(new Error("Image load error"));
      img.src = result;
    };
    reader.onerror = () => reject(new Error("Read error"));
    reader.readAsDataURL(file);
  });
};

function CameraCard({
  camera,
  isSelected,
  isChecked,
  isAdminMode,
  showImage,
  onSelect,
  onEdit,
  onMove,
  onDelete,
  onClearHistory,
  onUploadImage,
  onToggleImage,
}: CameraCardProps) {
  const isOffline = camera.status === "offline";
  const hasHistory = Boolean(
    camera.lastCheckedAt || camera.lastCheckedImage || camera.lastCheckedImagePath,
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    compressImage(file)
      .then((result) => onUploadImage(camera, file))
      .catch((error) => {
        console.error("Image upload failed", error);
        window.alert("บันทึกรูปไม่สำเร็จ กรุณาลองใหม่");
      });
    event.target.value = "";
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(camera.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(camera.id);
        }
      }}
      className={`w-full rounded-md border p-3 text-left transition hover:border-green-200 hover:bg-green-50 ${
        isSelected
          ? "border-transparent bg-green-50 ring-2 ring-green-400"
          : "border-zinc-100 bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-green-900">{camera.name}</p>
          {isOffline ? (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge.offline}`}>
              ออฟไลน์
            </span>
          ) : isChecked ? (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge.ok}`}>
              ใช้งานได้
            </span>
          ) : (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge.missing}`}>
              กรุณาตรวจสอบ
            </span>
          )}
        </div>
        {isAdminMode && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(camera);
              }}
              aria-label="แก้ไขข้อมูลกล้อง"
              className="text-green-700 hover:text-green-900"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08zM20.7 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMove(camera.id);
              }}
              aria-label="ย้ายกล้อง"
              className="text-amber-600 hover:text-amber-700"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2 9.5 4.5h2V8h1V4.5h2L12 2zm0 20 2.5-2.5h-2V16h-1v3.5h-2L12 22zM2 12l2.5-2.5v2H8v1H4.5v2L2 12zm20 0-2.5 2.5v-2H16v-1h3.5v-2L22 12z"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(camera);
              }}
              aria-label="ลบกล้อง"
              className="text-red-600 hover:text-red-700"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-600">
        {camera.description} / {typeLabels[camera.type]}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className={`inline-flex min-w-[96px] items-center justify-center cursor-pointer rounded-md px-2 py-1 text-[11px] font-bold text-white transition ${
          isChecked ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
        }`}>
          อัพโหลดภาพจากกล้อง
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onClick={(event) => event.stopPropagation()}
            onChange={handleFileChange}
          />
        </label>
        {isAdminMode && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (!hasHistory) return;
              onClearHistory(camera);
            }}
            className={`inline-flex min-w-[96px] items-center justify-center rounded-md px-2 py-1 text-[11px] font-bold transition ${
              hasHistory
                ? "border border-zinc-300 bg-white text-zinc-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                : "cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-400"
            }`}
            disabled={!hasHistory}
          >
            ล้างประวัติ
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
        <span>
          ตรวจสอบเมื่อ:{" "}
          {camera.lastCheckedAt
            ? new Date(camera.lastCheckedAt).toLocaleString("th-TH")
            : "ยังไม่ตรวจสอบ"}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (!camera.lastCheckedImage) return;
            onToggleImage(camera.id);
          }}
          aria-label={showImage ? "ซ่อนภาพ" : "แสดงภาพ"}
          className={`text-[11px] font-medium transition ${
            camera.lastCheckedImage
              ? "text-zinc-700 hover:text-zinc-900"
              : "cursor-not-allowed text-zinc-300"
          }`}
          disabled={!camera.lastCheckedImage}
        >
          {showImage ? (
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                fill="currentColor"
                d="M3.3 2.3 2 3.6l3.2 3.2C3.2 8.2 2 10 2 12c0 0 3 7 10 7 2.1 0 3.9-.6 5.4-1.5l3.1 3.1 1.3-1.3L3.3 2.3zm8.7 14.7c-3.3 0-5.7-2.3-6.9-4 0-.1.8-1.3 2.4-2.4l2 2a4 4 0 0 0 5.3 5.3l1.6 1.6c-1 .3-2 .5-3.4.5zm9-5c0 0-1.2 2.7-4 4.4l-2.1-2.1a4 4 0 0 0-5.3-5.3L7.7 6c1.3-.7 2.8-1 4.3-1 7 0 10 7 10 7z"
              />
            </svg>
          )}
        </button>
      </div>
      {camera.lastCheckedImage && showImage && (
        <NextImage
          src={camera.lastCheckedImage.replace(/%25/g, '%')}
          alt={`ภาพตรวจสอบล่าสุดของ ${camera.name}`}
          width={300}
          height={160}
          className="mt-2 h-40 w-full border border-zinc-100 object-cover"
        />
      )}
    </div>
  );
}

const CameraCardMemo = memo(CameraCard, (prevProps, nextProps) => {
  return (
    prevProps.camera.id === nextProps.camera.id &&
    prevProps.camera.name === nextProps.camera.name &&
    prevProps.camera.description === nextProps.camera.description &&
    prevProps.camera.type === nextProps.camera.type &&
    prevProps.camera.lastCheckedAt === nextProps.camera.lastCheckedAt &&
    prevProps.camera.lastCheckedImage === nextProps.camera.lastCheckedImage &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isChecked === nextProps.isChecked &&
    prevProps.showImage === nextProps.showImage &&
    prevProps.isAdminMode === nextProps.isAdminMode
  );
});

CameraCardMemo.displayName = "CameraCard";

export { typeLabels, statusBadge };
export default CameraCardMemo;
