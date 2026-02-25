"use client";

import { GoogleMap, MarkerF, OverlayViewF, useJsApiLoader } from "@react-google-maps/api";
import { get, onValue, push, ref, remove, set, update } from "firebase/database";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes, uploadString } from "firebase/storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import initialCamerasData from "../data/cctv-cameras-backup.json";
import { Camera, CameraType, CameraWithCheck } from "../data/types";
import { database, storage } from "../lib/firebase";
import { generateCctvReport } from "../utils/PdfReportGenerator";

import CameraList from "./CameraList";
import MapControls from "./MapControls";
import FilterPanel, { typeOptions } from "./FilterPanel";
import EditCameraModal from "./EditCameraModal";

const mapCenter = {
  lat: 14.867212037496559,
  lng: 100.63490078774039,
};

const containerStyle = {
  width: "100%",
  height: "100%",
};

const defaultType = typeOptions[0];

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
  const cameraListRef = useRef<HTMLDivElement | null>(null);
  const cameraRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [editingCamera, setEditingCamera] = useState<CameraWithCheck | null>(null);
  const [isAddingCamera, setIsAddingCamera] = useState(false);
  const [movingCameraId, setMovingCameraId] = useState<string | null>(null);
  const hasCleanedBase64 = useRef(false);
  const overlayContainerRef = useRef<HTMLDivElement | null>(null);
  const overlayImageInputRef = useRef<HTMLInputElement | null>(null);
  const overlayUploadCameraRef = useRef<CameraWithCheck | null>(null);
  const longPressTargetRef = useRef<CameraType | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const logDbWarning = (action: string, error: unknown) => {
    console.warn(`[CCTV] ${action} failed:`, error);
  };

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
    get(camerasRef)
      .then((snapshot) => {
        if (!snapshot.exists()) {
          return set(
            camerasRef,
            initialCamerasData as Record<string, Omit<Camera, "id">>,
          ).catch((error) => logDbWarning("seed cameras", error));
        }
      })
      .catch((error) => logDbWarning("load cameras", error));

    const reportRef = ref(database, "cctvReport");
    get(reportRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setCachedPdfUrl(data.url);
        }
      })
      .catch((error) => logDbWarning("load cctvReport", error));

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
          update(ref(database), cleanupUpdates).catch((error) =>
            logDbWarning("cleanup legacy image fields", error),
          );
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

  const listCameras = useMemo(() => filteredCameras, [filteredCameras]);

  const selectedCamera = useMemo(() => {
    if (!selectedCameraId) return null;
    return cameraItems.find((camera) => camera.id === selectedCameraId) ?? null;
  }, [cameraItems, selectedCameraId]);

  useEffect(() => {
    if (!selectedCameraId) return;
    const targetRow = cameraRowRefs.current[selectedCameraId];
    if (!targetRow) return;
    targetRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedCameraId]);

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

  const isCheckedInCurrentHalf = useCallback((camera: CameraWithCheck) => {
    const legacyMode = process.env.NEXT_PUBLIC_CCTV_LEGACY_MODE === "true";
    if (legacyMode && camera.lastCheckedImage) return true;
    
    if (!camera.lastCheckedAt) return false;
    const checkedAt = new Date(camera.lastCheckedAt);
    if (Number.isNaN(checkedAt.getTime())) return false;
    if (checkWindow.isFirstHalf) {
      return checkedAt >= checkWindow.start && checkedAt < checkWindow.mid;
    }
    return checkedAt >= checkWindow.mid && checkedAt < checkWindow.end;
  }, [checkWindow]);

  const displayedCameras = useMemo(() => {
    if (markerMode === 'none') return [];
    if (markerMode === 'ok') return filteredCameras.filter(c => isCheckedInCurrentHalf(c));
    if (markerMode === 'pending') return filteredCameras.filter(c => !isCheckedInCurrentHalf(c));
    return filteredCameras;
  }, [markerMode, filteredCameras, isCheckedInCurrentHalf]);

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

  const regeneratePdf = async (): Promise<string | null> => {
    try {
      console.log('[CctvMap] เริ่มสร้าง PDF...');
      const pdfBlob = await generateCctvReport(cameraItems);
      if (!pdfBlob) {
        console.error('[CctvMap] PDF blob is null');
        return null;
      }
      console.log('[CctvMap] PDF blob size:', pdfBlob.size);
      
      const pdfPath = `cctv-reports/latest-${Date.now()}.pdf`;
      console.log('[CctvMap] Uploading to:', pdfPath);
      const pdfRef = storageRef(storage, pdfPath);
      
      await uploadBytes(pdfRef, pdfBlob);
      console.log('[CctvMap] Upload complete, getting URL...');
      
      const pdfUrl = await getDownloadURL(pdfRef);
      console.log('[CctvMap] PDF URL:', pdfUrl);
      
      try {
        await set(ref(database, "cctvReport"), {
          url: pdfUrl,
          generatedAt: new Date().toISOString(),
        });
        console.log('[CctvMap] Saved to database');
      } catch (dbError) {
        console.warn("Unable to write cctvReport to database:", dbError);
      }
      setCachedPdfUrl(pdfUrl);
      setIsPdfOutdated(false);
      return pdfUrl;
    } catch (e) {
      console.error('[CctvMap] PDF generation failed:', e);
      return null;
    }
  };

  const openPdfUrl = (url: string) => {
    const telegramWebApp = (window as Window & {
      Telegram?: {
        WebApp?: {
          openLink?: (href: string, options?: Record<string, unknown>) => void;
        };
      };
    }).Telegram?.WebApp;

    if (telegramWebApp?.openLink) {
      telegramWebApp.openLink(url, { try_instant_view: false });
      return;
    }

    const link = document.createElement("a");
    link.href = url;
    link.target = "_self";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenPdf = () => {
    if (cachedPdfUrl && !isPdfOutdated) {
      openPdfUrl(cachedPdfUrl);
    } else {
      setIsGeneratingPdf(true);
      regeneratePdf()
        .then((newPdfUrl) => {
          if (newPdfUrl) {
            openPdfUrl(newPdfUrl);
          } else {
            alert("Unable to open PDF");
          }
        })
        .catch((error) => {
          console.error('PDF generation failed:', error);
          alert('สร้าง PDF ไม่สำเร็จ');
        })
        .finally(() => {
          setIsGeneratingPdf(false);
        });
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

  const handleStartAddCamera = () => {
    setIsAddingCamera(true);
    setEditingCamera(null);
    setMovingCameraId(null);
  };

  const handleAddCameraAtCenter = () => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    if (!center) return;
    setEditingCamera({
      id: "",
      name: "",
      description: "",
      type: defaultType,
      status: "online",
      lat: center.lat(),
      lng: center.lng(),
    });
  };

  const closeEditForm = () => {
    setEditingCamera(null);
  };

  const handleEditCamera = (camera: CameraWithCheck) => {
    setEditingCamera(camera);
    setIsAddingCamera(false);
    setMovingCameraId(null);
  };

  const handleSubmitEdit = (camera: CameraWithCheck) => {
    if (editingCamera && camera.id) {
      // Edit mode
      updateCamera(camera.id, {
        name: camera.name.trim(),
        description: camera.description.trim(),
        type: camera.type,
        lat: Number.isFinite(camera.lat) ? camera.lat : editingCamera.lat,
        lng: Number.isFinite(camera.lng) ? camera.lng : editingCamera.lng,
      });
      closeEditForm();
    } else {
      // Add mode
      const newCamera: Omit<Camera, "id"> = {
        name: camera.name.trim(),
        description: camera.description.trim(),
        type: camera.type,
        status: camera.status,
        lat: Number.isFinite(camera.lat) ? camera.lat : mapCenter.lat,
        lng: Number.isFinite(camera.lng) ? camera.lng : mapCenter.lng,
      };

      push(ref(database, "cameras"), newCamera)
        .then((newRef) => {
          setActiveTypes([newCamera.type]);
          if (newRef.key) {
            setSelectedCameraId(newRef.key);
            if (mapRef.current) {
              mapRef.current.panTo({ lat: newCamera.lat, lng: newCamera.lng });
              mapRef.current.setZoom(21);
            }
          }
          setIsAddingCamera(false);
        })
        .catch((error) => {
          console.error("Add camera failed", error);
          window.alert("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
        });
    }
  };

  const handleMoveCamera = (cameraId: string) => {
    setMovingCameraId(cameraId);
    setIsAddingCamera(false);
    setEditingCamera(null);
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

  const cancelMoveCamera = () => {
    setMovingCameraId(null);
  };

  const handleDeleteCamera = (camera: CameraWithCheck) => {
    const confirmDelete = window.confirm(
      `ลบกล้อง "${camera.name}" หรือไม่?`,
    );
    if (!confirmDelete) return;
    remove(ref(database, `cameras/${camera.id}`)).catch(
      (error) => {
        logDbWarning("delete camera", error);
        window.alert("ลบกล้องไม่สำเร็จ (Permission denied หรือเครือข่ายผิดพลาด)");
      },
    );
    if (selectedCameraId === camera.id) {
      setSelectedCameraId(null);
    }
  };

  const handleUploadImage = async (camera: CameraWithCheck, file: File) => {
    try {
      const result = await compressImage(file);
      const imagePath = `camera-checks/${camera.id}/latest.jpg`;
      try {
        if (camera.lastCheckedImagePath) {
          await deleteObject(
            storageRef(storage, camera.lastCheckedImagePath),
          );
        }
      } catch {
        // Ignore delete failures
      }

      const imageRef = storageRef(storage, imagePath);
      await uploadString(imageRef, result, "data_url");
      const url = await getDownloadURL(imageRef);

      await updateCamera(camera.id, {
        lastCheckedImage: url,
        lastCheckedImagePath: imagePath,
        lastCheckedAt: new Date().toISOString(),
      });
      schedulePdfRegeneration();
      setOpenImages((prev) => ({
        ...prev,
        [camera.id]: false,
      }));
    } catch (error) {
      console.error("Image upload failed", error);
      window.alert("บันทึกรูปไม่สำเร็จ กรุณาลองใหม่");
    }
  };

  const handleToggleImage = (id: string) => {
    setOpenImages((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleMarkerModeChange = () => {
    const modes: Array<'all' | 'ok' | 'pending' | 'none'> = ['all', 'ok', 'pending', 'none'];
    const currentIndex = modes.indexOf(markerMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setMarkerMode(nextMode);
    if (nextMode === 'none') setSelectedCameraId(null);
  };

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-600">
        ตั้งค่า `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` ใน `.env.local` เพื่อโหลด Google Maps
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
        {/* Left Panel - Camera List */}
        <section className="order-2 flex flex-col gap-4 bg-white p-5 shadow-sm ring-1 ring-green-100 lg:order-1 lg:h-full lg:min-h-0 lg:overflow-y-auto">
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

          <CameraList
            cameras={listCameras}
            selectedCameraId={selectedCameraId}
            isAdminMode={isAdminMode}
            isCheckedInCurrentHalf={isCheckedInCurrentHalf}
            openImages={openImages}
            onSelect={handleSelect}
            onEdit={handleEditCamera}
            onMove={handleMoveCamera}
            onDelete={handleDeleteCamera}
            onUploadImage={handleUploadImage}
            onToggleImage={handleToggleImage}
          />
        </section>

        {/* Right Panel - Map */}
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

            <FilterPanel
              activeTypes={activeTypes}
              typeCheckStatus={typeCheckStatus}
              onToggleType={toggleType}
              onFilterPointerDown={handleFilterPointerDown}
              onFilterClick={handleFilterClick}
              clearLongPressTimer={clearLongPressTimer}
            />

            <MapControls
              markerMode={markerMode}
              isAdminMode={isAdminMode}
              isAddingCamera={isAddingCamera}
              movingCameraId={movingCameraId}
              isGeneratingPdf={isGeneratingPdf}
              cachedPdfUrl={cachedPdfUrl}
              isPdfOutdated={isPdfOutdated}
              onMarkerModeChange={handleMarkerModeChange}
              onOpenPdf={handleOpenPdf}
              onStartAddCamera={handleStartAddCamera}
              onHandleAddCameraAtCenter={handleAddCameraAtCenter}
              onCloseAddForm={() => setIsAddingCamera(false)}
              onConfirmMoveCamera={confirmMoveCamera}
              onCancelMoveCamera={cancelMoveCamera}
            />

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
                            {selectedCamera.type}
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
                                      await updateCamera(camera.id, {
                                        lastCheckedImage: url,
                                        lastCheckedImagePath: imagePath,
                                        lastCheckedAt: new Date().toISOString(),
                                      });
                                      schedulePdfRegeneration();
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
        </section>
      </div>

      {/* Edit/Add Camera Modal */}
      <EditCameraModal
        isOpen={isAddingCamera || !!editingCamera}
        camera={editingCamera}
        mode={editingCamera?.id ? 'edit' : 'add'}
        defaultType={defaultType}
        onClose={() => {
          setEditingCamera(null);
          setIsAddingCamera(false);
        }}
        onSubmit={handleSubmitEdit}
      />

      {/* PDF Generation Loader */}
      {isGeneratingPdf && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
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
