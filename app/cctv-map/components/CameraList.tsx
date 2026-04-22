"use client";

import { useMemo } from "react";
import { CameraWithCheck } from "../data/types";
import CameraCard from "./CameraCard";

type CameraListProps = {
  cameras: CameraWithCheck[];
  selectedCameraId: string | null;
  isAdminMode: boolean;
  isCheckedInCurrentHalf: (camera: CameraWithCheck) => boolean;
  openImages: Record<string, boolean>;
  onSelect: (id: string) => void;
  onEdit: (camera: CameraWithCheck) => void;
  onMove: (id: string) => void;
  onDelete: (camera: CameraWithCheck) => void;
  onClearHistory: (camera: CameraWithCheck) => void;
  onUploadImage: (camera: CameraWithCheck, file: File) => void;
  onToggleImage: (id: string) => void;
};

export default function CameraList({
  cameras,
  selectedCameraId,
  isAdminMode,
  isCheckedInCurrentHalf,
  openImages,
  onSelect,
  onEdit,
  onMove,
  onDelete,
  onClearHistory,
  onUploadImage,
  onToggleImage,
}: CameraListProps) {
  const cameraCards = useMemo(() => {
    return cameras.map((camera) => ({
      camera,
      isChecked: isCheckedInCurrentHalf(camera),
    }));
  }, [cameras, isCheckedInCurrentHalf]);

  return (
    <div className="soft-scrollbar space-y-3 pr-1 sm:min-h-0 sm:flex-1 sm:overflow-y-auto">
      {cameraCards.map(({ camera, isChecked }) => (
        <CameraCard
          key={camera.id}
          camera={camera}
          isSelected={selectedCameraId === camera.id}
          isChecked={isChecked}
          isAdminMode={isAdminMode}
          showImage={openImages[camera.id] || false}
          onSelect={onSelect}
          onEdit={onEdit}
          onMove={onMove}
          onDelete={onDelete}
          onClearHistory={onClearHistory}
          onUploadImage={onUploadImage}
          onToggleImage={onToggleImage}
        />
      ))}
      {cameras.length === 0 && (
        <div className="border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-500">
          ไม่พบกล้องที่ตรงกับการค้นหา
        </div>
      )}
    </div>
  );
}
