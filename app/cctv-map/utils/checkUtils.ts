"use client";

import { CameraWithCheck } from "../data/types";

export function getCheckWindow() {
  const now = new Date();
  const isFirstHalf = now.getDate() <= 15;
  
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const mid = new Date(now.getFullYear(), now.getMonth(), 16);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  
  return {
    isFirstHalf,
    start,
    mid,
    end,
  };
}

export function isCameraCheckedInCurrentHalf(camera: CameraWithCheck) {
  const legacyMode = typeof window !== "undefined" && window.localStorage?.getItem("CCTV_LEGACY_MODE") === "true";
  
  if (legacyMode && camera.lastCheckedImage) return true;

  if (!camera.lastCheckedAt) return false;
  
  const checkedAt = new Date(camera.lastCheckedAt);
  if (Number.isNaN(checkedAt.getTime())) return false;
  
  const checkWindow = getCheckWindow();
  
  if (checkWindow.isFirstHalf) {
    return checkedAt >= checkWindow.start && checkedAt < checkWindow.mid;
  } else {
    return checkedAt >= checkWindow.mid && checkedAt < checkWindow.end;
  }
}
