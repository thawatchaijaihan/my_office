"use client";

import { useCallback, useMemo } from "react";

import { CameraType, CameraWithCheck } from "../data/types";
import { typeOptions } from "../components/FilterPanel";
import { getCheckWindow, isCameraCheckedInCurrentHalf } from "../utils/checkUtils";

type UseCameraCheckStatusOptions = {
    cameraItems: CameraWithCheck[];
    filteredCameras: CameraWithCheck[];
    markerMode: 'all' | 'ok' | 'pending' | 'none';
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

    const displayedCameras = useMemo(() => {
        if (markerMode === 'none') return [];
        if (markerMode === 'ok') return filteredCameras.filter(c => isCheckedInCurrentHalf(c));
        if (markerMode === 'pending') return filteredCameras.filter(c => !isCheckedInCurrentHalf(c));
        return filteredCameras;
    }, [markerMode, filteredCameras, isCheckedInCurrentHalf]);

    return {
        typeCheckStatus,
        isCheckedInCurrentHalf,
        displayedCameras,
    };
}
