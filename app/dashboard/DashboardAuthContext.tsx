"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getFirebaseAuth,
  isFirebaseAuthEnabled,
} from "@/lib/firebaseClient";
import type { User } from "firebase/auth";

type AuthState = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  getAuthHeaders: () => Promise<Record<string, string>>;
};

const DashboardAuthContext = createContext<AuthState | null>(null);

export function useDashboardAuth(): AuthState {
  const ctx = useContext(DashboardAuthContext);
  if (!ctx) throw new Error("useDashboardAuth must be used within DashboardAuthProvider");
  return ctx;
}

export function DashboardAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseAuthEnabled()) {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // บันทึกผู้ใช้ที่ล็อกอินลง Realtime Database อัตโนมัติ (users/{uid}) เพื่อให้แอดมินจัดการสิทธิ์ได้
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        if (!token || cancelled) return;
        const res = await fetch("/api/auth/record-user", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok && process.env.NODE_ENV === "development") {
          console.warn("[Dashboard] record-user:", res.status, await res.text());
        }
      } catch (e) {
        if (process.env.NODE_ENV === "development") console.warn("[Dashboard] record-user error", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await auth.signOut();
    setUser(null);
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      return null;
    }
  }, [user]);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getIdToken();
    if (token) return { Authorization: `Bearer ${token}` };
    return {};
  }, [getIdToken]);

  const value: AuthState = {
    user,
    loading,
    signOut,
    getIdToken,
    getAuthHeaders,
  };

  return (
    <DashboardAuthContext.Provider value={value}>
      {children}
    </DashboardAuthContext.Provider>
  );
}
