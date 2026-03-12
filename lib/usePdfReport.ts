"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CameraWithCheck } from "../app/cctv-map/data/types"; // Adjust path if needed

const FUNCTIONS_URL = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL || 
  "https://asia-southeast1-jaihan-assistant.cloudfunctions.net";

interface PdfMetadata {
  exists: boolean;
  outdated?: boolean;
  url?: string;
  lastGenerated?: string;
}

export interface UsePdfReportReturn {
  pdfUrl: string | null;
  isLoading: boolean;
  isOutdated: boolean;
  isGenerating: boolean;
  pdfReady: boolean;
  error: string | null;
  checkStatus: () => Promise<void>;
  regenerate: () => Promise<string | null>;
  openPdf: (url: string) => void;
}

export function usePdfReport(cameraItems?: CameraWithCheck[]): UsePdfReportReturn {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOutdated, setIsOutdated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${FUNCTIONS_URL}/getPdfMetadata`);
      const data: PdfMetadata = await response.json();
      
      if (data.exists && data.url) {
        setPdfUrl(data.url);
        setIsOutdated(!!data.outdated);
        setPdfReady(true);
      } else {
        setPdfUrl(null);
        setIsOutdated(true);
      }
    } catch (err) {
      setError("Failed to check PDF status");
      console.warn("[usePdfReport] Check status failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const regenerate = useCallback(async (): Promise<string | null> => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(`${FUNCTIONS_URL}/generatePdf`, {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.pdfUrl) {
        setPdfUrl(data.pdfUrl);
        setIsOutdated(false);
        setPdfReady(true);
        return data.pdfUrl;
      } else {
        throw new Error(data.message || "Generation failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      console.error("[usePdfReport] Regenerate failed:", err);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const openPdf = useCallback((url: string) => {
    const telegramWebApp = (window as any).Telegram?.WebApp;
    if (telegramWebApp?.openLink) {
      telegramWebApp.openLink(url, { try_instant_view: false });
      return;
    }
    
    // Fallback
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  useEffect(() => {
    checkStatus();

    // Optional: Auto-regenerate if outdated after delay
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (isOutdated) {
      timeoutRef.current = setTimeout(() => regenerate(), 3000);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [cameraItems?.length, checkStatus, regenerate, isOutdated]); // Re-check if cameras change

  return {
    pdfUrl,
    isLoading,
    isOutdated,
    isGenerating,
    pdfReady,
    error,
    checkStatus,
    regenerate,
    openPdf,
  };
}

// Server-side helper (use in RSCs/server actions)
export async function getServerPdfReport(): Promise<{
  url: string | null;
  outdated: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`${process.env.FIREBASE_FUNCTIONS_URL || FUNCTIONS_URL}/getPdfMetadata`);
    const data: PdfMetadata = await response.json();
    return {
      url: data.url || null,
      outdated: !!data.outdated,
    };
  } catch (err) {
    return {
      url: null,
      outdated: true,
      error: "Failed to fetch PDF metadata",
    };
  }
}

