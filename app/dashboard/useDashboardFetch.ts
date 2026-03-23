"use client";

import { useCallback } from "react";
import { useDashboardAuth } from "./DashboardAuthContext";

/**
 * คืนฟังก์ชัน fetch ที่ใส่ auth headers (Firebase token หรือ key จาก URL) ให้อัตโนมัติ
 */
export function useDashboardFetch() {
  const { getAuthHeaders } = useDashboardAuth();

  const dashboardFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const key =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("key") ?? ""
          : "";
      const sep = path.includes("?") ? "&" : "?";
      const url = path + (key ? `${sep}key=${encodeURIComponent(key)}` : "");
      const authHeaders = await getAuthHeaders();
      const headers = { ...authHeaders, ...(options.headers as Record<string, string>) };
      return fetch(url, { ...options, headers });
    },
    [getAuthHeaders]
  );

  return dashboardFetch;
}
