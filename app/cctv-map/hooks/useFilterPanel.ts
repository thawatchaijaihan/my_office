"use client";

import { useRef, useState } from "react";

import { CameraType } from "../data/types";
import { typeOptions } from "../components/FilterPanel";

const defaultType = typeOptions[0];
const LONG_PRESS_MS = 500;

export function useFilterPanel() {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTypes, setActiveTypes] = useState<CameraType[]>([defaultType]);
    const [markerMode, setMarkerMode] = useState<'all' | 'ok' | 'pending' | 'none'>('all');

    const longPressTargetRef = useRef<CameraType | null>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

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

    const handleMarkerModeChange = () => {
        const modes: Array<'all' | 'ok' | 'pending' | 'none'> = ['all', 'ok', 'pending', 'none'];
        const currentIndex = modes.indexOf(markerMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        setMarkerMode(nextMode);
    };

    return {
        searchTerm,
        setSearchTerm,
        activeTypes,
        setActiveTypes,
        markerMode,
        setMarkerMode,
        clearLongPressTimer,
        toggleType,
        handleFilterPointerDown,
        handleFilterClick,
        handleMarkerModeChange,
    };
}
