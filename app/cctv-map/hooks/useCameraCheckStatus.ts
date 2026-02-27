"use client";

import { useCallback, useMemo } from "react";

import { CameraType, CameraWithCheck } from "../data/types";
import { typeOptions } from "../components/FilterPanel";

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

    const isCheckedInCurrentHalf = useCallback(
        (camera: CameraWithCheck) => {
            const legacyMode = process.env.NEXT_PUBLIC_CCTV_LEGACY_MODE === "true";
            if (legacyMode && camera.lastCheckedImage) return true;

            if (!camera.lastCheckedAt) return false;
            const checkedAt = new Date(camera.lastCheckedAt);
            if (Number.isNaN(checkedAt.getTime())) return false;
            if (checkWindow.isFirstHalf) {
                return checkedAt >= checkWindow.start && checkedAt < checkWindow.mid;
            }
            return checkedAt >= checkWindow.mid && checkedAt < checkWindow.end;
        },
        [checkWindow],
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
