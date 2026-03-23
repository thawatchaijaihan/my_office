"use client";

type MapControlsProps = {
  markerMode: 'all' | 'ok' | 'pending' | 'none';
  isAdminMode: boolean;
  isAddingCamera: boolean;
  movingCameraId: string | null;
  activeUnit: string;
  onMarkerModeChange: () => void;
  onStartAddCamera: () => void;
  onHandleAddCameraAtCenter: () => void;
  onCloseAddForm: () => void;
  onConfirmMoveCamera: () => void;
  onCancelMoveCamera: () => void;
};

export default function MapControls({
  markerMode,
  isAdminMode,
  isAddingCamera,
  movingCameraId,
  activeUnit,
  onMarkerModeChange,
  onStartAddCamera,
  onHandleAddCameraAtCenter,
  onCloseAddForm,
  onConfirmMoveCamera,
  onCancelMoveCamera,
}: MapControlsProps) {
  const getMarkerModeLabel = () => {
    switch (markerMode) {
      case 'all': return '🔵 ทั้งหมด';
      case 'ok': return '✅ ใช้งานได้';
      case 'pending': return '⚠️ รอตรวจ';
      case 'none': return '🚫 ซ่อนหมุด';
    }
  };

  return (
    <>
      {/* Desktop Map Controls */}
      <div className="absolute bottom-3 left-3 z-10 hidden w-40 flex-col gap-2 lg:flex">
        {isAdminMode && (
          <>
            <button
              type="button"
              onClick={onMarkerModeChange}
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-green-700 bg-green-700 text-white shadow-lg transition hover:bg-green-800"
              title={markerMode === 'all' ? 'ทั้งหมด' : markerMode === 'ok' ? 'ใช้งานได้' : markerMode === 'pending' ? 'รอตรวจ' : 'ซ่อนหมุด'}
            >
              {markerMode === 'all' && (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {markerMode === 'ok' && (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {markerMode === 'pending' && (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {markerMode === 'none' && (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              )}
            </button>
            <a
              href="/cctv-report"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-indigo-600 bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-700"
              title="พิมพ์รายงาน (A4)"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </a>
            {!isAddingCamera && !movingCameraId ? (
              <button
                type="button"
                onClick={onStartAddCamera}
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-green-700 bg-green-700 text-white shadow-lg transition hover:bg-green-800"
                title="เพิ่มกล้อง"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            ) : isAddingCamera ? (
              <div className="flex gap-2 text-white">
                <button
                  type="button"
                  onClick={onHandleAddCameraAtCenter}
                  className="w-full border border-green-700 bg-green-700 px-3 py-2 text-sm font-medium shadow-sm"
                >
                  เพิ่มกล้อง
                </button>
                <button
                  type="button"
                  onClick={onCloseAddForm}
                  className="w-full border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium shadow-sm"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onConfirmMoveCamera}
                  className="w-full border border-amber-600 bg-amber-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
                >
                  ย้ายกล้อง
                </button>
                <button
                  type="button"
                  onClick={onCancelMoveCamera}
                  className="w-full border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
                >
                  ยกเลิก
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Mobile Map Controls */}
      {isAdminMode && (
        <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 bg-white p-3 lg:hidden">
          <button
            type="button"
            onClick={onMarkerModeChange}
            className="w-full border border-green-700 bg-green-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-800"
          >
            {getMarkerModeLabel()}
          </button>
          <a
            href="/cctv-report"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center border border-indigo-600 bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            title="พิมพ์รายงาน"
          >
            🖨️
          </a>
          <>
            {!isAddingCamera && !movingCameraId ? (
              <button
                type="button"
                onClick={onStartAddCamera}
                className="w-full border border-green-700 bg-green-700 px-3 py-2 text-sm font-medium text-white"
                title="เพิ่มกล้อง"
              >
                ➕
              </button>
            ) : isAddingCamera ? (
              <>
                <button
                  type="button"
                  onClick={onHandleAddCameraAtCenter}
                  className="w-full border border-green-700 bg-green-700 px-3 py-2 text-sm font-medium text-white"
                >
                  เพิ่มกล้อง
                </button>
                <button
                  type="button"
                  onClick={onCloseAddForm}
                  className="w-full border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white"
                >
                  ยกเลิก
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onConfirmMoveCamera}
                  className="w-full border border-amber-600 bg-amber-600 px-3 py-2 text-sm font-medium text-white"
                >
                  ย้ายกล้อง
                </button>
                <button
                  type="button"
                  onClick={onCancelMoveCamera}
                  className="w-full border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white"
                >
                  ยกเลิก
                </button>
              </>
            )}
          </>
        </div>
      )}
    </>
  );
}
