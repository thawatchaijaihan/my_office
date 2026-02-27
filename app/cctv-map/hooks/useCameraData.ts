"use client";

import { get, onValue, ref, set, update } from "firebase/database";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import initialCamerasData from "../data/cctv-cameras-backup.json";
import { Camera, CameraType, CameraWithCheck } from "../data/types";
import { database } from "../lib/firebase";
import { typeOptions } from "../components/FilterPanel";

const defaultType = typeOptions[0];

const logDbWarning = (action: string, error: unknown) => {
    console.warn(`[CCTV] ${action} failed:`, error);
};

type UseCameraDataOptions = {
    searchTerm: string;
    activeTypes: CameraType[];
};

export function useCameraData({ searchTerm, activeTypes }: UseCameraDataOptions) {
    const [cameraItems, setCameraItems] = useState<CameraWithCheck[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
    const hasCleanedBase64 = useRef(false);

    // Load from localStorage + subscribe to Firebase
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

    const updateCamera = useCallback(
        (id: string, updates: Partial<CameraWithCheck>) => {
            return update(ref(database, `cameras/${id}`), updates);
        },
        [],
    );

    return {
        cameraItems,
        selectedCameraId,
        setSelectedCameraId,
        filteredCameras,
        listCameras,
        selectedCamera,
        updateCamera,
    };
}
