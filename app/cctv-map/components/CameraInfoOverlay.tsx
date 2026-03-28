"use client";

import { OverlayViewF } from "@react-google-maps/api";
import { deleteObject, getDownloadURL, ref as storageRef, uploadString } from "firebase/storage";
import { useRef } from "react";

import { CameraWithCheck } from "../data/types";
import { storage } from "../lib/firebase";
import { compressImage } from "../utils/compressImage";

type CameraInfoOverlayProps = {
  camera: CameraWithCheck;
  isCheckedInCurrentHalf: (camera: CameraWithCheck) => boolean;
  onClose: () => void;
  onUpdateCamera: (id: string, updates: Partial<CameraWithCheck>) => Promise<void>;
  isAdminMode: boolean;
};

export default function CameraInfoOverlay({
  camera,
  isCheckedInCurrentHalf,
  onClose,
  onUpdateCamera,
  isAdminMode,
}: CameraInfoOverlayProps) {
  const overlayContainerRef = useRef<HTMLDivElement | null>(null);
  const overlayImageInputRef = useRef<HTMLInputElement | null>(null);
  const overlayUploadCameraRef = useRef<CameraWithCheck | null>(null);

  return (
    <OverlayViewF
      position={{
        lat: camera.lat,
        lng: camera.lng,
      }}
      mapPaneName="floatPane"
      getPixelPositionOffset={(width, height) => ({
        x: Math.round(-width / 2),
        y: Math.round(-height - 10),
      })}
    >
      <div
        ref={(el) => {
          overlayContainerRef.current = el;
          if (el && typeof google !== "undefined" && google.maps?.OverlayView?.preventMapHitsAndGesturesFrom) {
            google.maps.OverlayView.preventMapHitsAndGesturesFrom(el);
          }
        }}
        className="relative"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="w-fit max-w-[240px] border border-zinc-200 bg-white p-3 text-sm shadow-md">
          <button
            type="button"
            onClick={() => onClose()}
            aria-label="ปิด"
            className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-700"
          >
            ×
          </button>
          <div className="text-sm font-semibold text-zinc-900">
            {camera.name}
          </div>
          <div className="text-xs text-zinc-600">
            บริเวณ : {camera.description}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            <div className="font-semibold text-zinc-900">
              {camera.type}
            </div>
            {isCheckedInCurrentHalf(camera) ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (camera.lastCheckedImage) {
                      window.open(camera.lastCheckedImage.replace(/%25/g, '%'), "_blank", "noopener,noreferrer");
                    }
                  }}
                  className={`font-bold text-green-700 ${
                    camera.lastCheckedImage
                      ? "cursor-pointer underline decoration-green-700/50 hover:decoration-green-700"
                      : ""
                  }`}
                  title={camera.lastCheckedImage ? "คลิกเพื่อดูภาพจากกล้อง" : undefined}
                >
                  ใช้งานได้
                </button>
                {camera.lastCheckedImage && (
                  <>
                    <span className="text-zinc-400">•</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        overlayUploadCameraRef.current = camera;
                        overlayImageInputRef.current?.click();
                      }}
                      className="font-bold text-red-600 underline decoration-red-600/50 hover:decoration-red-600"
                    >
                      แก้ไขภาพ
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <input
                  ref={overlayImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    const cam = overlayUploadCameraRef.current;
                    event.target.value = "";
                    if (!file || !cam) return;
                    overlayUploadCameraRef.current = null;
                    compressImage(file)
                      .then(async (result) => {
                        const imagePath = `camera-checks/${cam.id}/latest.jpg`;
                        try {
                          if (cam.lastCheckedImagePath) {
                            await deleteObject(
                              storageRef(storage, cam.lastCheckedImagePath),
                            );
                          }
                        } catch {
                          /* ignore */
                        }
                        const imageRef = storageRef(storage, imagePath);
                        await uploadString(imageRef, result, "data_url", { contentType: 'image/jpeg' });
                        const url = await getDownloadURL(imageRef);
                        await onUpdateCamera(cam.id, {
                          lastCheckedImage: url,
                          lastCheckedImagePath: imagePath,
                          lastCheckedAt: new Date().toISOString(),
                        });
                      })
                      .catch((err) => {
                        console.error("Image upload failed", err);
                        window.alert("บันทึกรูปไม่สำเร็จ กรุณาลองใหม่");
                      });
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    overlayUploadCameraRef.current = camera;
                    overlayImageInputRef.current?.click();
                  }}
                  className="font-bold text-red-600 cursor-pointer underline decoration-red-600/50 hover:decoration-red-600"
                  title="คลิกเพื่ออัปโหลดรูปตรวจสอบกล้อง"
                >
                  {isAdminMode ? "กรุณาตรวจสอบ" : "รอตรวจสอบ"}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-l border-b border-zinc-200 bg-white" />
      </div>
    </OverlayViewF>
  );
}
