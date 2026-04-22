"use client";

import { useCallback, useMemo } from "react";

import { CameraType, CameraWithCheck, MarkerMode } from "../data/types";
import { typeOptions } from "../components/FilterPanel";
import { getCheckWindow, isCameraCheckedInCurrentHalf } from "../utils/checkUtils";

type UseCameraCheckStatusOptions = {
    cameraItems: CameraWithCheck[];
    filteredCameras: CameraWithCheck[];
    markerMode: MarkerMode;
};

export function useCameraCheckStatus({
    cameraItems,
    filteredCameras,
    markerMode,
}: UseCameraCheckStatusOptions) {
    const typeCheckStatus = useMemo(() => {
        const window = getCheckWindow();

        return typeOptions.reduce<Record<CameraType, boolean>>((acc, type) => {
            const camerasOfType = cameraItems.filter(
                (camera) => camera.type === type,
            );
            if (camerasOfType.length === 0) {
                acc[type] = false;
                return acc;
            }

            acc[type] = camerasOfType.every((camera) => isCameraCheckedInCurrentHalf(camera));
            return acc;
        }, {} as Record<CameraType, boolean>);
    }, [cameraItems]);

    const checkWindow = useMemo(() => getCheckWindow(), []);

    const isCheckedInCurrentHalf = useCallback(
        (camera: CameraWithCheck) => isCameraCheckedInCurrentHalf(camera),
        [],
    );

    const hasLatestImage = useCallback(
        (camera: CameraWithCheck) => Boolean(camera.lastCheckedImage),
        [],
    );

    const isOfflineCamera = useCallback(
        (camera: CameraWithCheck) => camera.status === "offline",
        [],
    );

    const isOkCamera = useCallback(
        (camera: CameraWithCheck) =>
            !isOfflineCamera(camera) && isCheckedInCurrentHalf(camera),
        [isCheckedInCurrentHalf, isOfflineCamera],
    );

    const isPendingCamera = useCallback(
        (camera: CameraWithCheck) =>
            !isOfflineCamera(camera) && !isCheckedInCurrentHalf(camera),
        [isCheckedInCurrentHalf, isOfflineCamera],
    );

    const displayedCameras = useMemo(() => {
        switch (markerMode) {
            case "none":
                return [];
            case "ok":
                return filteredCameras.filter(isOkCamera);
            case "pending":
                return filteredCameras.filter(isPendingCamera);
            case "has-image":
                return filteredCameras.filter(hasLatestImage);
            case "no-image":
                return filteredCameras.filter((camera) => !hasLatestImage(camera));
            case "offline":
                return filteredCameras.filter(isOfflineCamera);
            default:
                return filteredCameras;
        }
    }, [
        markerMode,
        filteredCameras,
        hasLatestImage,
        isOfflineCamera,
        isOkCamera,
        isPendingCamera,
    ]);

    const getMarkerFillColor = useCallback(
        (camera: CameraWithCheck) => {
            switch (markerMode) {
                case "has-image":
                    return "#2563eb";
                case "no-image":
                    return "#dc2626";
                case "offline":
                    return "#6b7280";
                default:
                    if (isOfflineCamera(camera)) return "#6b7280";
                    return isCheckedInCurrentHalf(camera) ? "#2563eb" : "#dc2626";
            }
        },
        [isCheckedInCurrentHalf, isOfflineCamera, markerMode],
    );

    return {
        typeCheckStatus,
        isCheckedInCurrentHalf,
        hasLatestImage,
        isOfflineCamera,
        isOkCamera,
        isPendingCamera,
        displayedCameras,
        getMarkerFillColor,
    };
}
