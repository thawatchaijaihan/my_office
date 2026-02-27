"use client";

import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useRef } from "react";

import { CameraWithCheck } from "../data/types";

import CameraList from "./CameraList";
import MapControls from "./MapControls";
import FilterPanel from "./FilterPanel";
import EditCameraModal from "./EditCameraModal";
import CameraInfoOverlay from "./CameraInfoOverlay";
import PdfGenerationModal from "./PdfGenerationModal";

import { useFilterPanel } from "../hooks/useFilterPanel";
import { useCameraData } from "../hooks/useCameraData";
import { useCameraCheckStatus } from "../hooks/useCameraCheckStatus";
import { usePdfReport } from "../hooks/usePdfReport";
import { useCameraActions } from "../hooks/useCameraActions";

const mapCenter = {
  lat: 14.867212037496559,
  lng: 100.63490078774039,
};

const containerStyle = {
  width: "100%",
  height: "100%",
};

type CctvMapProps = {
  isAdminMode?: boolean;
};

export default function CctvMap({ isAdminMode = true }: CctvMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const mapRef = useRef<google.maps.Map | null>(null);
  const cameraListRef = useRef<HTMLDivElement | null>(null);
  const cameraRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { isLoaded } = useJsApiLoader({
    id: "cctv-map",
    googleMapsApiKey: apiKey,
  });

  // --- Custom Hooks ---
  const filter = useFilterPanel();
  const {
    searchTerm, setSearchTerm,
    activeTypes, setActiveTypes,
    markerMode,
    clearLongPressTimer,
    toggleType,
    handleFilterPointerDown,
    handleFilterClick,
    handleMarkerModeChange,
  } = filter;

  const cameraData = useCameraData({ searchTerm, activeTypes });
  const {
    cameraItems,
    selectedCameraId, setSelectedCameraId,
    filteredCameras, listCameras,
    selectedCamera,
    updateCamera,
  } = cameraData;

  const checkStatus = useCameraCheckStatus({
    cameraItems,
    filteredCameras,
    markerMode,
  });
  const { typeCheckStatus, isCheckedInCurrentHalf, displayedCameras } = checkStatus;

  const pdf = usePdfReport(cameraItems);
  const {
    isGeneratingPdf, setIsGeneratingPdf,
    cachedPdfUrl, isPdfOutdated,
    newPdfUrl, setNewPdfUrl,
    pdfReady, setPdfReady,
    handleOpenPdf,
    schedulePdfRegeneration,
  } = pdf;

  const actions = useCameraActions({
    mapRef,
    updateCamera,
    setSelectedCameraId,
    setActiveTypes,
    schedulePdfRegeneration,
  });
  const {
    editingCamera, setEditingCamera,
    isAddingCamera, setIsAddingCamera,
    movingCameraId,
    openImages,
    handleStartAddCamera,
    handleAddCameraAtCenter,
    handleEditCamera,
    handleSubmitEdit,
    handleMoveCamera,
    confirmMoveCamera,
    cancelMoveCamera,
    handleDeleteCamera,
    handleUploadImage,
    handleToggleImage,
  } = actions;

  // --- Side Effects ---
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

  // Scroll to selected camera in list
  useEffect(() => {
    if (!selectedCameraId) return;
    const targetRow = cameraRowRefs.current[selectedCameraId];
    if (!targetRow) return;
    targetRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedCameraId]);

  // Clear selection when marker mode is 'none'
  useEffect(() => {
    if (markerMode === 'none' && selectedCameraId) {
      setSelectedCameraId(null);
    }
  }, [markerMode, selectedCameraId, setSelectedCameraId]);

  // Clear selection when camera is no longer in filtered results
  useEffect(() => {
    if (!selectedCameraId) return;
    const stillVisible = filteredCameras.some(
      (camera) => camera.id === selectedCameraId,
    );
    if (!stillVisible) {
      setSelectedCameraId(null);
    }
  }, [filteredCameras, selectedCameraId, setSelectedCameraId]);

  // Fit map bounds to filtered cameras
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

  // --- Render ---
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
                  <CameraInfoOverlay
                    camera={selectedCamera}
                    isCheckedInCurrentHalf={isCheckedInCurrentHalf}
                    onClose={() => setSelectedCameraId(null)}
                    onUpdateCamera={updateCamera}
                    onSchedulePdfRegeneration={schedulePdfRegeneration}
                  />
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
        defaultType={(activeTypes[0] ?? "ป.71 พัน.713") as CameraWithCheck["type"]}
        onClose={() => {
          setEditingCamera(null);
          setIsAddingCamera(false);
        }}
        onSubmit={handleSubmitEdit}
      />

      {/* PDF Generation Modal */}
      <PdfGenerationModal
        isOpen={isGeneratingPdf}
        pdfReady={pdfReady}
        pdfUrl={newPdfUrl}
        onClose={() => {
          setNewPdfUrl(null);
          setPdfReady(false);
          setIsGeneratingPdf(false);
        }}
      />
    </>
  );
}
