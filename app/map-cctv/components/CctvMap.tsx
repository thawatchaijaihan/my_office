"use client";

import { GoogleMap, MarkerF, OverlayViewF, useJsApiLoader } from "@react-google-maps/api";
import { get, onValue, push, ref, remove, set, update } from "firebase/database";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes, uploadString } from "firebase/storage";
import { useEffect, useMemo, useRef, useState } from "react";

import initialCamerasData from "../data/cctv-cameras-backup.json";
import { Camera, CameraType } from "../data/types";
import { database, storage } from "../lib/firebase";
import { generateCctvReport } from "../utils/PdfReportGenerator";

const mapCenter = {
  lat: 14.867212037496559,
  lng: 100.63490078774039,
};

const containerStyle = {
  width: "100%",
  height: "100%",
};

const typeOptions: CameraType[] = [
  "ป.71 พัน.713",
  "ป.71 พัน.713 ร้อย.1",
  "ป.71 พัน.713 ร้อย.2",
  "ป.71 พัน.713 ร้อย.3",
  "ร้อย.บก.ป.71 พัน.713",
  "ร้อย.บร.ป.71 พัน.713",
];
const defaultType = typeOptions[0];

const statusBadge = {
  ok: "bg-green-100 text-green-800",
  missing: "bg-red-100 text-red-800",
} as const;

const typeLabels: Record<CameraType, string> = {
  "ป.71 พัน.713": "ป.71 พัน.713",
  "ป.71 พัน.713 ร้อย.1": "ร้อย.ป.ที่ 1",
  "ป.71 พัน.713 ร้อย.2": "ร้อย.ป.ที่ 2",
  "ป.71 พัน.713 ร้อย.3": "ร้อย.ป.ที่ 3",
  "ร้อย.บก.ป.71 พัน.713": "ร้อย.บก.",
  "ร้อย.บร.ป.71 พัน.713": "ร้อย.บร.",
};

const EDIT_PASSWORD = "713713713";

const MAX_IMAGE_BYTES = 512_000;
const MAX_IMAGE_DIMENSION = 1600;

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


type CameraWithCheck = Camera & {
  lastCheckedAt?: string;
  lastCheckedImage?: string;
  lastCheckedImagePath?: string;
};

type CctvMapProps = {
  isAdminMode?: boolean;
};

export default function CctvMap({ isAdminMode = true }: CctvMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const mapRef = useRef<google.maps.Map | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTypes, setActiveTypes] = useState<CameraType[]>([defaultType]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [cachedPdfUrl, setCachedPdfUrl] = useState<string | null>(null);
  const [isPdfOutdated, setIsPdfOutdated] = useState(false);
  const pdfGenerationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [markerMode, setMarkerMode] = useState<'all' | 'ok' | 'pending' | 'none'>('all');
  const [cameraItems, setCameraItems] = useState<CameraWithCheck[]>([]);
  const [openImages, setOpenImages] = useState<Record<string, boolean>>({});
  const [editingCamera, setEditingCamera] = useState<CameraWithCheck | null>(null);
  const [editDraft, setEditDraft] = useState<CameraWithCheck | null>(null);
  const [isAddingCamera, setIsAddingCamera] = useState(false);
  const [addDraft, setAddDraft] = useState<CameraWithCheck | null>(null);
  const [movingCameraId, setMovingCameraId] = useState<string | null>(null);
  const hasCleanedBase64 = useRef(false);
  const overlayContainerRef = useRef<HTMLDivElement | null>(null);
  const overlayImageInputRef = useRef<HTMLInputElement | null>(null);
  const overlayUploadCameraRef = useRef<CameraWithCheck | null>(null);
  const longPressTargetRef = useRef<CameraType | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const LONG_PRESS_MS = 500;
  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const { isLoaded } = useJsApiLoader({
    id: "cctv-map",
    googleMapsApiKey: apiKey,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem("cctv:cameras");
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CameraWithCheck[];
          if (Array.isArray(parsed)) {
            setCameraItems(parsed);
          }
        } catch {
          window.localStorage.removeItem("cctv:cameras");
        }
      }
    }

    const camerasRef = ref(database, "cameras");
    get(camerasRef).then((snapshot) => {
      if (!snapshot.exists()) {
        set(camerasRef, initialCamerasData as Record<string, Omit<Camera, "id">>);
      }
    });

    // โหลด cached PDF URL
    const reportRef = ref(database, "cctvReport");
    get(reportRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCachedPdfUrl(data.url);
      }
    });

    const unsubscribe = onValue(camerasRef, (snapshot) => {
      const data = snapshot.val() as Record<string, CameraWithCheck> | null;
      if (data && !hasCleanedBase64.current) {
        const cleanupUpdates: Record<string, null> = {};
        Object.entries(data).forEach(([id, value]) => {
          if (
            typeof value.lastCheckedImage === "string" &&
            value.lastCheckedImage.startsWith("data:image")
          ) {
            cleanupUpdates[`cameras/${id}/lastCheckedImage`] = null;
            cleanupUpdates[`cameras/${id}/lastCheckedImagePath`] = null;
          }
        });
        if (Object.keys(cleanupUpdates).length > 0) {
          update(ref(database), cleanupUpdates);
        }
        hasCleanedBase64.current = true;
      }
      const list = data
        ? Object.entries(data).map(([id, value]) => ({
            ...value,
            id,
            lastCheckedImage:
              typeof value.lastCheckedImage === "string" &&
              value.lastCheckedImage.startsWith("data:image")
                ? undefined
                : value.lastCheckedImage,
            status: value.status ?? "online",
            type: typeOptions.includes(value.type as CameraType)
              ? (value.type as CameraType)
              : defaultType,
          }))
        : [];
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCameraItems(list);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("cctv:cameras", JSON.stringify(list));
        window.localStorage.setItem("cctv:cameras:cachedAt", new Date().toISOString());
      }
      setSelectedCameraId((prev) =>
        prev && list.some((item) => item.id === prev) ? prev : null,
      );
    });

    return () => unsubscribe();
  }, []);

  const filteredCameras = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return cameraItems.filter((camera) => {
      const matchesType = activeTypes.includes(camera.type);
      if (!matchesType) return false;
      if (!normalized) return true;
      const haystack = [
        camera.name,
        camera.description,
        camera.id,
        camera.type,
        camera.status,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [searchTerm, activeTypes, cameraItems]);

  /** แถบรายการ: เมื่อมีกล้องที่เลือกบนแผนที่ แสดงแค่กล้องนั้น */
  const listCameras = useMemo(() => {
    if (!selectedCameraId) return filteredCameras;
    const one = filteredCameras.find((c) => c.id === selectedCameraId);
    return one ? [one] : filteredCameras;
  }, [filteredCameras, selectedCameraId]);

  const selectedCamera = useMemo(() => {
    if (!selectedCameraId) return null;
    return cameraItems.find((camera) => camera.id === selectedCameraId) ?? null;
  }, [cameraItems, selectedCameraId]);

  useEffect(() => {
    if (markerMode === 'none' && selectedCameraId) {
      setSelectedCameraId(null);
    }
  }, [markerMode, selectedCameraId]);

  useEffect(() => {
    if (!selectedCameraId) return;
    const stillVisible = filteredCameras.some(
      (camera) => camera.id === selectedCameraId,
    );
    if (!stillVisible) {
      setSelectedCameraId(null);
    }
  }, [filteredCameras, selectedCameraId]);

  const typeCheckStatus = useMemo(() => {
    const now = new Date();
    const isFirstHalf = now.getDate() <= 15;
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const mid = new Date(now.getFullYear(), now.getMonth(), 16);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return typeOptions.reduce<Record<CameraType, boolean>>((acc, type) => {
      const camerasOfType = cameraItems.filter(
        (camera) => camera.type === type,
      );
      if (camerasOfType.length === 0) {
        acc[type] = false;
        return acc;
      }

      const inCurrentHalf = (date: Date) =>
        isFirstHalf ? date >= start && date < mid : date >= mid && date < end;

      acc[type] = camerasOfType.every((camera) => {
        if (!camera.lastCheckedAt) return false;
        const checkedAt = new Date(camera.lastCheckedAt);
        if (Number.isNaN(checkedAt.getTime())) return false;
        return inCurrentHalf(checkedAt);
      });
      return acc;
    }, {} as Record<CameraType, boolean>);
  }, [cameraItems]);

  const checkWindow = useMemo(() => {
    const now = new Date();
    const isFirstHalf = now.getDate() <= 15;
    return {
      isFirstHalf,
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      mid: new Date(now.getFullYear(), now.getMonth(), 16),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }, []);

  const isCheckedInCurrentHalf = (camera: CameraWithCheck) => {
    // โหมดพิเศษ: ถ้ามีภาพอยู่แล้ว ถือว่าใช้งานได้ (ไม่สนว่าอัปโหลดเมื่อไหร่)
    // ตั้งค่า NEXT_PUBLIC_CCTV_LEGACY_MODE=true เพื่อใช้โหมดนี้
    const legacyMode = process.env.NEXT_PUBLIC_CCTV_LEGACY_MODE === "true";
    if (legacyMode && camera.lastCheckedImage) return true;
    
    if (!camera.lastCheckedAt) return false;
    const checkedAt = new Date(camera.lastCheckedAt);
    if (Number.isNaN(checkedAt.getTime())) return false;
    if (checkWindow.isFirstHalf) {
      return checkedAt >= checkWindow.start && checkedAt < checkWindow.mid;
    }
    return checkedAt >= checkWindow.mid && checkedAt < checkWindow.end;
  };

  const displayedCameras = useMemo(() => {
    if (markerMode === 'none') return [];
    if (markerMode === 'ok') return filteredCameras.filter(c => isCheckedInCurrentHalf(c));
    if (markerMode === 'pending') return filteredCameras.filter(c => !isCheckedInCurrentHalf(c));
    return filteredCameras;
  }, [markerMode, filteredCameras]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (filteredCameras.length === 0) return;
    if (typeof google === "undefined") return;

    const bounds = new google.maps.LatLngBounds();
    filteredCameras.forEach((camera) => {
      bounds.extend({ lat: camera.lat, lng: camera.lng });
    });
    mapRef.current.fitBounds(bounds);
  }, [filteredCameras]);

  const toggleType = (type: CameraType, event?: React.MouseEvent) => {
    const multiSelect = event?.ctrlKey || event?.metaKey;
    if (multiSelect) {
      setActiveTypes((prev) =>
        prev.includes(type)
          ? prev.filter((item) => item !== type)
          : [...prev, type],
      );
    } else {
      setActiveTypes([type]);
    }
  };

  const handleFilterPointerDown = (type: CameraType, e: React.PointerEvent) => {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    clearLongPressTimer();
    longPressTargetRef.current = null;
    longPressTimerRef.current = setTimeout(() => {
      longPressTargetRef.current = type;
      setActiveTypes((prev) =>
        prev.includes(type)
          ? prev.filter((item) => item !== type)
          : [...prev, type],
      );
      longPressTimerRef.current = null;
    }, LONG_PRESS_MS);
  };

  const handleFilterClick = (type: CameraType, e: React.MouseEvent) => {
    if (longPressTargetRef.current === type) {
      longPressTargetRef.current = null;
      e.preventDefault();
      return;
    }
    toggleType(type, e);
  };

  const handleSelect = (cameraId: string) => {
    const camera = cameraItems.find((item) => item.id === cameraId);
    setSelectedCameraId(cameraId);
    if (mapRef.current) {
      if (camera) {
        mapRef.current.panTo({ lat: camera.lat, lng: camera.lng });
      }
      mapRef.current.setZoom(21);
    }
  };

  const regeneratePdf = async () => {
    try {
      const pdfBlob = await generateCctvReport(cameraItems);
      const pdfPath = `cctv-reports/latest-${Date.now()}.pdf`;
      const pdfRef = storageRef(storage, pdfPath);
      await uploadBytes(pdfRef, pdfBlob);
      const pdfUrl = await getDownloadURL(pdfRef);
      await set(ref(database, "cctvReport"), {
        url: pdfUrl,
        generatedAt: new Date().toISOString(),
      });
      setCachedPdfUrl(pdfUrl);
      setIsPdfOutdated(false);
    } catch (e) {
      console.error('PDF generation failed:', e);
    }
  };

  const schedulePdfRegeneration = () => {
    setIsPdfOutdated(true);
    if (pdfGenerationTimeoutRef.current) {
      clearTimeout(pdfGenerationTimeoutRef.current);
    }
    pdfGenerationTimeoutRef.current = setTimeout(() => {
      regeneratePdf();
    }, 3000);
  };

  const updateCamera = (id: string, updates: Partial<CameraWithCheck>) => {
    return update(ref(database, `cameras/${id}`), updates);
  };

  const handleAddCameraAtCenter = () => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    if (!center) return;
    setAddDraft({
      id: "",
      name: "",
      description: "",
      type: defaultType,
      status: "online",
      lat: center.lat(),
      lng: center.lng(),
    });
  };

  const closeAddForm = () => {
    setAddDraft(null);
    setIsAddingCamera(false);
  };

  const submitAddForm = async () => {
    if (!addDraft) return;
    if (!addDraft.name.trim()) {
      window.alert("กรุณากรอกชื่อกล้อง");
      return;
    }

    const camera: Omit<Camera, "id"> = {
      name: addDraft.name.trim(),
      description: addDraft.description.trim(),
      type: addDraft.type,
      status: addDraft.status,
      lat: Number.isFinite(addDraft.lat) ? addDraft.lat : mapCenter.lat,
      lng: Number.isFinite(addDraft.lng) ? addDraft.lng : mapCenter.lng,
    };

    const newRef = push(ref(database, "cameras"));
    try {
      await set(newRef, camera);
      setActiveTypes([camera.type]);
      if (newRef.key) {
        setSelectedCameraId(newRef.key);
        if (mapRef.current) {
          mapRef.current.panTo({ lat: camera.lat, lng: camera.lng });
          mapRef.current.setZoom(21);
        }
      }
      closeAddForm();
    } catch (error) {
      console.error("Add camera failed", error);
      window.alert("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  };

  const startMoveCamera = (cameraId: string) => {
    setMovingCameraId(cameraId);
    setIsAddingCamera(false);
    setAddDraft(null);
  };

  const cancelMoveCamera = () => {
    setMovingCameraId(null);
  };

  const confirmMoveCamera = () => {
    if (!mapRef.current || !movingCameraId) return;
    const center = mapRef.current.getCenter();
    if (!center) return;
    updateCamera(movingCameraId, {
      lat: center.lat(),
      lng: center.lng(),
    });
    setSelectedCameraId(movingCameraId);
    setMovingCameraId(null);
  };

  const openEditForm = (camera: CameraWithCheck) => {
    setEditingCamera(camera);
    setEditDraft({ ...camera });
  };

  const requirePassword = (action: () => void) => {
    if (isUnlocked) {
      action();
      return;
    }
    pendingActionRef.current = action;
    setPasswordInput("");
    setPasswordError("");
    setShowPasswordModal(true);
  };

  const submitPassword = () => {
    if (passwordInput.trim() !== EDIT_PASSWORD) {
      setPasswordError("รหัสผ่านไม่ถูกต้อง");
      return;
    }
    setIsUnlocked(true);
    setShowPasswordModal(false);
    setPasswordInput("");
    setPasswordError("");
    pendingActionRef.current?.();
    pendingActionRef.current = null;
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordInput("");
    setPasswordError("");
    pendingActionRef.current = null;
  };

  const closeEditForm = () => {
    setEditingCamera(null);
    setEditDraft(null);
  };

  const submitEditForm = () => {
    if (!editingCamera || !editDraft) return;
    if (!editDraft.name.trim()) return;

    updateCamera(editingCamera.id, {
      name: editDraft.name.trim(),
      description: editDraft.description.trim(),
      type: editDraft.type,
      lat: Number.isFinite(editDraft.lat) ? editDraft.lat : editingCamera.lat,
      lng: Number.isFinite(editDraft.lng) ? editDraft.lng : editingCamera.lng,
    });
    closeEditForm();
  };

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-600">
        ตั้งค่า `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` ใน `.env.local` เพื่อโหลด
        Google Maps
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">
        กำลังโหลดแผนที่…
      </div>
    );
  }

  return (
    <>
      <div className="grid min-h-0 grid-cols-1 grid-rows-[auto_auto] gap-4 lg:h-full lg:grid-rows-none lg:grid-cols-[360px_1fr] lg:items-start xl:grid-cols-[380px_1fr] 2xl:grid-cols-[420px_1fr]">
        <section className="order-2 flex flex-col gap-4 bg-white p-5 shadow-sm ring-1 ring-green-100 lg:order-1 lg:h-full lg:min-h-0 lg:overflow-y-auto">
          <h1 className="hidden text-2xl font-semibold text-green-900 lg:block">
            แผนที่ติดตั้งกล้องวงจรปิด
          </h1>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-green-900">
              รายการกล้องวงจรปิด
            </h2>
          </div>

        <div className="space-y-4">
          <label className="text-sm font-medium text-green-900">
            <input
              className="w-full border border-zinc-200 px-3 py-2 text-sm outline-none ring-0 focus:border-green-500 focus:ring-2 focus:ring-green-200"
              placeholder="ค้นหาตามชื่อหรือคำอธิบาย"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>

        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
          <span>จำนวน {listCameras.length} กล้อง</span>
          <span>ใช้งานได้ {listCameras.filter((c) => isCheckedInCurrentHalf(c)).length} กล้อง</span>
          <span>รอตรวจสอบ {listCameras.filter((c) => !isCheckedInCurrentHalf(c)).length} กล้อง</span>
        </div>

        <div className="soft-scrollbar space-y-3 pr-1 lg:min-h-0 lg:flex-1 lg:overflow-y-scroll">
          {listCameras.map((camera) => (
            <div
              key={camera.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(camera.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSelect(camera.id);
                }
              }}
              className="w-full border border-zinc-100 bg-white p-3 text-left transition hover:border-green-200 hover:bg-green-50"
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-green-900">
                    {camera.name}
                  </p>
                  {isCheckedInCurrentHalf(camera) ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge.ok}`}
                    >
                      ใช้งานได้
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge.missing}`}
                    >
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
                      requirePassword(() => openEditForm(camera));
                    }}
                    aria-label="แก้ไขข้อมูลกล้อง"
                    className="text-green-700 hover:text-green-900"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      aria-hidden="true"
                    >
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
                      requirePassword(() => startMoveCamera(camera.id));
                    }}
                    aria-label="ย้ายกล้อง"
                    className="text-amber-600 hover:text-amber-700"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      aria-hidden="true"
                    >
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
                      requirePassword(() => {
                        const confirmDelete = window.confirm(
                          `ลบกล้อง "${camera.name}" หรือไม่?`,
                        );
                        if (!confirmDelete) return;
                        remove(ref(database, `cameras/${camera.id}`));
                        if (selectedCameraId === camera.id) {
                          setSelectedCameraId(null);
                        }
                      });
                    }}
                    aria-label="ลบกล้อง"
                    className="text-red-600 hover:text-red-700"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      aria-hidden="true"
                    >
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
                {camera.description}
              </p>
              <p className="mt-2 text-[11px] text-zinc-500">
                {typeLabels[camera.type]}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex min-w-[96px] items-center justify-center border border-green-600 px-2 py-1 text-[11px] font-medium text-green-700 transition hover:bg-green-50 cursor-pointer">
                  ภาพจากกล้อง
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      event.stopPropagation();
                      const file = event.target.files?.[0];
                      if (!file) return;
                      compressImage(file)
                        .then(async (result) => {
                          const imagePath = `camera-checks/${camera.id}/latest.jpg`;
                          try {
                            if (camera.lastCheckedImagePath) {
                              await deleteObject(
                                storageRef(storage, camera.lastCheckedImagePath),
                              );
                            }
                          } catch {
                            // Ignore delete failures to avoid blocking upload.
                          }

                          const imageRef = storageRef(storage, imagePath);
                          await uploadString(imageRef, result, "data_url");
                          const url = await getDownloadURL(imageRef);

                          updateCamera(camera.id, {
                            lastCheckedImage: url,
                            lastCheckedImagePath: imagePath,
                            lastCheckedAt: new Date().toISOString(),
                          }).then(() => {
                            schedulePdfRegeneration();
                          });
                          setOpenImages((prev) => ({
                            ...prev,
                            [camera.id]: false,
                          }));
                        })
                        .catch((error) => {
                          console.error("Image upload failed", error);
                          window.alert("บันทึกรูปไม่สำเร็จ กรุณาลองใหม่");
                        });
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
                <span>
                  ตรวจสอบช่วงนี้:{" "}
                  {camera.lastCheckedAt
                    ? new Date(camera.lastCheckedAt).toLocaleString("th-TH")
                    : "ยังไม่ตรวจสอบ"}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!camera.lastCheckedImage) return;
                    setOpenImages((prev) => ({
                      ...prev,
                      [camera.id]: !prev[camera.id],
                    }));
                  }}
                  aria-label={
                    openImages[camera.id] ? "ซ่อนภาพ" : "แสดงภาพ"
                  }
                  className={`text-[11px] font-medium transition ${
                    camera.lastCheckedImage
                      ? "text-zinc-700 hover:text-zinc-900"
                      : "cursor-not-allowed text-zinc-300"
                  }`}
                  disabled={!camera.lastCheckedImage}
                >
                  {openImages[camera.id] ? (
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"
                      />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M3.3 2.3 2 3.6l3.2 3.2C3.2 8.2 2 10 2 12c0 0 3 7 10 7 2.1 0 3.9-.6 5.4-1.5l3.1 3.1 1.3-1.3L3.3 2.3zm8.7 14.7c-3.3 0-5.7-2.3-6.9-4 0-.1.8-1.3 2.4-2.4l2 2a4 4 0 0 0 5.3 5.3l1.6 1.6c-1 .3-2 .5-3.4.5zm9-5c0 0-1.2 2.7-4 4.4l-2.1-2.1a4 4 0 0 0-5.3-5.3L7.7 6c1.3-.7 2.8-1 4.3-1 7 0 10 7 10 7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {camera.lastCheckedImage && openImages[camera.id] && (
                <img
                  src={camera.lastCheckedImage}
                  alt={`ภาพตรวจสอบล่าสุดของ ${camera.name}`}
                  className="mt-2 h-40 w-full border border-zinc-100 object-cover"
                />
              )}
            </div>
          ))}
          {listCameras.length === 0 && (
            <div className="border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-500">
              ไม่พบกล้องที่ตรงกับการค้นหา
            </div>
          )}
        </div>
      </section>

      <section className="order-1 flex min-h-[50vh] flex-col self-start overflow-hidden border border-zinc-100 bg-white shadow-sm ring-1 ring-green-100 lg:order-2 lg:min-h-0 lg:h-full">
        <div
          className="relative h-[50vh] w-full shrink-0 grow lg:min-h-0 lg:h-full lg:flex-1"
          style={{ minHeight: "50vh" }}
        >
          {(isAddingCamera || movingCameraId) && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <div className="h-4 w-4 rounded-full border-2 border-white bg-green-600 shadow-md" />
            </div>
          )}
          <div className="absolute left-3 top-3 z-10 hidden space-y-2 lg:block">
            <p className="text-[10px] text-zinc-500">กด Ctrl ค้างเพื่อเลือกหลายตัว</p>
            <div className="flex w-40 flex-col gap-1">
              {typeOptions.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={(e) => toggleType(type, e)}
                  className={`inline-flex w-full justify-center border px-3 py-2 text-sm font-medium transition-transform ${
                    activeTypes.includes(type) ? "translate-x-[25%]" : ""
                  } ${
                    typeCheckStatus[type] === false
                      ? "border-red-600 bg-red-600 text-white"
                      : activeTypes.includes(type)
                        ? "border-green-700 bg-green-700 text-white"
                        : "border-green-700 bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  {typeLabels[type]}
                </button>
              ))}
            </div>
          </div>
          <div className="absolute bottom-3 left-3 z-10 hidden w-40 flex-col gap-2 lg:flex">
            <button
              type="button"
              onClick={() => {
                const modes: Array<'all' | 'ok' | 'pending' | 'none'> = ['all', 'ok', 'pending', 'none'];
                const currentIndex = modes.indexOf(markerMode);
                const nextMode = modes[(currentIndex + 1) % modes.length];
                setMarkerMode(nextMode);
                if (nextMode === 'none') setSelectedCameraId(null);
              }}
              className="inline-flex w-full justify-center border border-green-700 bg-green-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-800"
            >
              {markerMode === 'all' && '🔵 ทั้งหมด'}
              {markerMode === 'ok' && '✅ ใช้งานได้'}
              {markerMode === 'pending' && '⚠️ รอตรวจ'}
              {markerMode === 'none' && '🚫 ซ่อนหมุด'}
            </button>
            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={async () => {
                console.log('[PDF Button] cachedPdfUrl:', cachedPdfUrl);
                console.log('[PDF Button] isPdfOutdated:', isPdfOutdated);
                
                if (cachedPdfUrl && !isPdfOutdated) {
                  console.log('[PDF Button] ใช้ cache - เปิดทันที');
                  window.open(cachedPdfUrl, '_blank');
                } else {
                  console.log('[PDF Button] สร้างใหม่');
                  setIsGeneratingPdf(true);
                  try {
                    await regeneratePdf();
                    window.open(cachedPdfUrl, '_blank');
                  } catch (error) {
                    console.error('PDF generation failed:', error);
                    alert('สร้าง PDF ไม่สำเร็จ');
                  } finally {
                    setIsGeneratingPdf(false);
                  }
                }
              }}
              className="inline-flex w-full justify-center border border-green-700 bg-green-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPdf ? "กำลังสร้าง..." : (cachedPdfUrl && !isPdfOutdated) ? "📄 ดาวน์โหลด PDF" : "🔄 สร้างรายงาน PDF"}
            </button>
            {isAdminMode && (
              <>
                {!isAddingCamera && !movingCameraId ? (
              <button
                type="button"
                onClick={() => requirePassword(() => setIsAddingCamera(true))}
                className="w-full border border-green-700 bg-green-700 px-3 py-2 text-sm font-medium text-white shadow-sm"
              >
                เพิ่มกล้อง
              </button>
            ) : isAddingCamera ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddCameraAtCenter}
                  className="w-full border border-green-700 bg-green-700 px-3 py-2 text-sm font-medium text-white shadow-sm"
                >
                  เพิ่มกล้อง
                </button>
                <button
                  type="button"
                  onClick={() => closeAddForm()}
                  className="w-full border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={confirmMoveCamera}
                  className="w-full border border-amber-600 bg-amber-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
                >
                  ย้ายกล้อง
                </button>
                <button
                  type="button"
                  onClick={cancelMoveCamera}
                  className="w-full border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
                >
                  ยกเลิก
                </button>
              </>
            )}
              </>
            )}
          </div>
          <div className="absolute inset-0 h-full w-full lg:relative lg:block">
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={mapCenter}
              zoom={15}
              onLoad={(map) => {
                mapRef.current = map;
                window.setTimeout(() => {
                  if (mapRef.current && "resize" in mapRef.current && typeof mapRef.current.resize === "function") {
                    mapRef.current.resize();
                  }
                }, 0);
                window.setTimeout(() => {
                  if (mapRef.current && "resize" in mapRef.current && typeof mapRef.current.resize === "function") {
                    mapRef.current.resize();
                  }
                }, 200);
              }}
          onClick={() => setSelectedCameraId(null)}
          options={{
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeId: "satellite",
          }}
        >
          {markerMode !== 'none' &&
            displayedCameras.map((camera) => {
              const needsCheck = !isCheckedInCurrentHalf(camera);
              const icon =
                typeof google !== "undefined"
                  ? {
                      path: google.maps.SymbolPath.CIRCLE,
                      fillColor: needsCheck ? "#dc2626" : "#2563eb",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 4,
                      scale: 10,
                    }
                  : undefined;

              return (
                <MarkerF
                  key={camera.id}
                  position={{ lat: camera.lat, lng: camera.lng }}
                  onClick={() => handleSelect(camera.id)}
                  icon={icon}
                />
              );
            })}

          {markerMode !== 'none' && selectedCamera && (
            <OverlayViewF
              position={{
                lat: selectedCamera.lat,
                lng: selectedCamera.lng,
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
                    onClick={() => setSelectedCameraId(null)}
                    aria-label="ปิด"
                    className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-700"
                  >
                    ×
                  </button>
                  <div className="text-sm font-semibold text-zinc-900">
                    {selectedCamera.name}
                  </div>
                  <div className="text-xs text-zinc-600">
                    บริเวณ : {selectedCamera.description}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    <div className="font-semibold text-zinc-900">
                      {typeLabels[selectedCamera.type]}
                    </div>
                    {isCheckedInCurrentHalf(selectedCamera) ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedCamera.lastCheckedImage) {
                              window.open(selectedCamera.lastCheckedImage, "_blank", "noopener,noreferrer");
                            }
                          }}
                          className={`font-bold text-green-700 ${
                            selectedCamera.lastCheckedImage
                              ? "cursor-pointer underline decoration-green-700/50 hover:decoration-green-700"
                              : ""
                          }`}
                          title={selectedCamera.lastCheckedImage ? "คลิกเพื่อดูภาพจากกล้อง" : undefined}
                        >
                          ใช้งานได้
                        </button>
                        {selectedCamera.lastCheckedImage && (
                          <>
                            <span className="text-zinc-400">•</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                overlayUploadCameraRef.current = selectedCamera;
                                overlayImageInputRef.current?.click();
                              }}
                              className="text-blue-600 underline decoration-blue-600/50 hover:decoration-blue-600"
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
                            const camera = overlayUploadCameraRef.current;
                            event.target.value = "";
                            if (!file || !camera) return;
                            overlayUploadCameraRef.current = null;
                            compressImage(file)
                              .then(async (result) => {
                                const imagePath = `camera-checks/${camera.id}/latest.jpg`;
                                try {
                                  if (camera.lastCheckedImagePath) {
                                    await deleteObject(
                                      storageRef(storage, camera.lastCheckedImagePath),
                                    );
                                  }
                                } catch {
                                  /* ignore */
                                }
                                const imageRef = storageRef(storage, imagePath);
                                await uploadString(imageRef, result, "data_url");
                                const url = await getDownloadURL(imageRef);
                                updateCamera(camera.id, {
                                  lastCheckedImage: url,
                                  lastCheckedImagePath: imagePath,
                                  lastCheckedAt: new Date().toISOString(),
                                }).then(() => {
                                  schedulePdfRegeneration();
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
                            if (selectedCamera.lastCheckedImage) {
                              window.open(selectedCamera.lastCheckedImage, "_blank", "noopener,noreferrer");
                            } else {
                              overlayUploadCameraRef.current = selectedCamera;
                              overlayImageInputRef.current?.click();
                            }
                          }}
                          className={`font-bold text-red-600 ${
                            selectedCamera.lastCheckedImage
                              ? "cursor-pointer underline decoration-red-600/50 hover:decoration-red-600"
                              : "cursor-pointer underline decoration-red-600/50 hover:decoration-red-600"
                          }`}
                          title={
                            selectedCamera.lastCheckedImage
                              ? "คลิกเพื่อดูภาพจากกล้อง"
                              : "คลิกเพื่ออัปโหลดรูปตรวจสอบกล้อง"
                          }
                        >
                          กรุณาตรวจสอบ
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-l border-b border-zinc-200 bg-white" />
              </div>
            </OverlayViewF>
          )}
            </GoogleMap>
          </div>
        </div>

        {/* เมนูใต้แผนที่สำหรับหน้าจอเล็ก */}
        <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 bg-white p-3 lg:hidden">
          <p className="col-span-3 text-[10px] text-zinc-500">แตะเลือก 1 ตัว / กดค้างเพื่อเลือกหลายตัว</p>
          {typeOptions.map((type) => (
            <button
              key={type}
              type="button"
              onPointerDown={(e) => handleFilterPointerDown(type, e)}
              onPointerUp={clearLongPressTimer}
              onPointerLeave={clearLongPressTimer}
              onPointerCancel={clearLongPressTimer}
              onClick={(e) => handleFilterClick(type, e)}
              className={`w-full border px-3 py-2 text-sm font-medium transition ${
                activeTypes.includes(type)
                  ? typeCheckStatus[type] === false
                    ? "border-red-600 bg-white text-red-600 ring-2 ring-red-600 ring-offset-1"
                    : "border-green-700 bg-white text-green-700 ring-2 ring-green-700 ring-offset-1"
                  : typeCheckStatus[type] === false
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-green-700 bg-green-50 text-green-700"
              }`}
            >
              {typeLabels[type]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const modes: Array<'all' | 'ok' | 'pending' | 'none'> = ['all', 'ok', 'pending', 'none'];
              const currentIndex = modes.indexOf(markerMode);
              const nextMode = modes[(currentIndex + 1) % modes.length];
              setMarkerMode(nextMode);
              if (nextMode === 'none') setSelectedCameraId(null);
            }}
            className="w-full border border-green-700 bg-green-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-800"
          >
            {markerMode === 'all' && '🔵 ทั้งหมด'}
            {markerMode === 'ok' && '✅ ใช้งานได้'}
            {markerMode === 'pending' && '⚠️ รอตรวจ'}
            {markerMode === 'none' && '🚫 ซ่อนหมุด'}
          </button>
          <button
            type="button"
            disabled={isGeneratingPdf}
            onClick={async () => {
              if (cachedPdfUrl && !isPdfOutdated) {
                window.open(cachedPdfUrl, '_blank');
              } else {
                setIsGeneratingPdf(true);
                try {
                  await regeneratePdf();
                  window.open(cachedPdfUrl, '_blank');
                } catch (error) {
                  console.error('PDF generation failed:', error);
                  alert('สร้าง PDF ไม่สำเร็จ');
                } finally {
                  setIsGeneratingPdf(false);
                }
              }
            }}
            className="w-full border border-green-700 bg-green-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingPdf ? "..." : (cachedPdfUrl && !isPdfOutdated) ? "📄 PDF" : "🔄 PDF"}
          </button>
          {isAdminMode && (
            <>
              {!isAddingCamera && !movingCameraId ? (
            <button
              type="button"
              onClick={() => requirePassword(() => setIsAddingCamera(true))}
              className="w-full border border-green-700 bg-green-700 px-3 py-2 text-sm font-medium text-white"
            >
              เพิ่มกล้อง
            </button>
          ) : isAddingCamera ? (
            <>
              <button
                type="button"
                onClick={handleAddCameraAtCenter}
                className="w-full border border-green-700 bg-green-700 px-3 py-2 text-sm font-medium text-white"
              >
                เพิ่มกล้อง
              </button>
              <button
                type="button"
                onClick={() => closeAddForm()}
                className="w-full border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white"
              >
                ยกเลิก
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={confirmMoveCamera}
                className="w-full border border-amber-600 bg-amber-600 px-3 py-2 text-sm font-medium text-white"
              >
                ย้ายกล้อง
              </button>
              <button
                type="button"
                onClick={cancelMoveCamera}
                className="w-full border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white"
              >
                ยกเลิก
              </button>
            </>
          )}
            </>
          )}
        </div>
      </section>
      </div>
    {isAdminMode && showPasswordModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm border border-zinc-200 bg-white p-4 shadow-lg">
          <h2 className="text-base font-semibold text-green-900">
            กรุณาป้อนรหัสผ่าน
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            สำหรับ แก้ไข / ย้าย / ลบ / เพิ่ม กล้องวงจรปิด
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="รหัสผ่าน"
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
              setPasswordError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitPassword();
              if (e.key === "Escape") closePasswordModal();
            }}
            className="mt-3 w-full border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
          />
          {passwordError && (
            <p className="mt-1 text-sm text-red-600">{passwordError}</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={closePasswordModal}
              className="border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={submitPassword}
              className="border border-green-700 bg-green-700 px-3 py-1.5 text-sm font-medium text-white"
            >
              ตกลง
            </button>
          </div>
        </div>
      </div>
    )}
    {isAdminMode && editDraft && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg border border-zinc-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-green-900">
              แก้ไขข้อมูลกล้อง
            </h2>
            <button
              type="button"
              onClick={closeEditForm}
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
                value={editDraft.name}
                onChange={(event) =>
                  setEditDraft((prev) =>
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
                value={editDraft.description}
                onChange={(event) =>
                  setEditDraft((prev) =>
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
                  value={editDraft.type}
                  onChange={(event) =>
                    setEditDraft((prev) =>
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
                  value={editDraft.lat}
                  onChange={(event) =>
                    setEditDraft((prev) =>
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
                  value={editDraft.lng}
                  onChange={(event) =>
                    setEditDraft((prev) =>
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
              onClick={closeEditForm}
              className="border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={submitEditForm}
              className="border border-green-700 bg-green-700 px-3 py-1 text-xs font-medium text-white"
            >
              บันทึก
            </button>
          </div>
        </div>
      </div>
    )}
      {isAdminMode && addDraft && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg border border-zinc-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-green-900">
              เพิ่มกล้อง
            </h2>
            <button
              type="button"
              onClick={closeAddForm}
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
                value={addDraft.name}
                onChange={(event) =>
                  setAddDraft((prev) =>
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
                value={addDraft.description}
                onChange={(event) =>
                  setAddDraft((prev) =>
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
                  value={addDraft.type}
                  onChange={(event) =>
                    setAddDraft((prev) =>
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
                  value={addDraft.lat}
                  onChange={(event) =>
                    setAddDraft((prev) =>
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
                  value={addDraft.lng}
                  onChange={(event) =>
                    setAddDraft((prev) =>
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
              onClick={closeAddForm}
              className="border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={submitAddForm}
              className="border border-green-700 bg-green-700 px-3 py-1 text-xs font-medium text-white"
            >
              เพิ่มกล้อง
            </button>
          </div>
        </div>
      </div>
      )}
      {/* PDF Generation Loader */}
      {isGeneratingPdf && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-xl bg-white p-8 shadow-2xl">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-green-100 border-t-green-600" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  className="h-8 w-8 text-green-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
            </div>
            <div className="text-center font-sans">
              <h3 className="text-lg font-bold text-zinc-900">กำลังสร้าง PDF</h3>
              <p className="text-sm text-zinc-500">กรุณารอสักครู่...</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
