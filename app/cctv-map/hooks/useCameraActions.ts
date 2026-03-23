"use client";

import { push, ref, remove } from "firebase/database";
import { deleteObject, getDownloadURL, ref as storageRef, uploadString } from "firebase/storage";
import { useState } from "react";

import { Camera, CameraWithCheck } from "../data/types";
import { database, storage } from "../lib/firebase";
import { typeOptions } from "../components/FilterPanel";
import { compressImage } from "../utils/compressImage";

const defaultType = typeOptions[0];

const mapCenter = {
    lat: 14.867212037496559,
    lng: 100.63490078774039,
};

type UseCameraActionsOptions = {
    mapRef: React.RefObject<google.maps.Map | null>;
    updateCamera: (id: string, updates: Partial<CameraWithCheck>) => Promise<void>;
    setSelectedCameraId: (id: string | null) => void;
    setActiveTypes: (types: React.SetStateAction<import("../data/types").CameraType[]>) => void;
    schedulePdfRegeneration: () => void;
};

export function useCameraActions({
    mapRef,
    updateCamera,
    setSelectedCameraId,
    setActiveTypes,
    schedulePdfRegeneration,
}: UseCameraActionsOptions) {
    const [editingCamera, setEditingCamera] = useState<CameraWithCheck | null>(null);
    const [isAddingCamera, setIsAddingCamera] = useState(false);
    const [movingCameraId, setMovingCameraId] = useState<string | null>(null);
    const [openImages, setOpenImages] = useState<Record<string, boolean>>({});

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
                console.warn("[CCTV] delete camera failed:", error);
                window.alert("ลบกล้องไม่สำเร็จ (Permission denied หรือเครือข่ายผิดพลาด)");
            },
        );
        setSelectedCameraId(null);
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

    return {
        editingCamera,
        setEditingCamera,
        isAddingCamera,
        setIsAddingCamera,
        movingCameraId,
        openImages,
        handleStartAddCamera,
        handleAddCameraAtCenter,
        closeEditForm,
        handleEditCamera,
        handleSubmitEdit,
        handleMoveCamera,
        confirmMoveCamera,
        cancelMoveCamera,
        handleDeleteCamera,
        handleUploadImage,
        handleToggleImage,
    };
}
