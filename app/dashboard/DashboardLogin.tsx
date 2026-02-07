"use client";

import { useState } from "react";
import {
  getFirebaseAuth,
  isFirebaseAuthEnabled,
} from "@/lib/firebaseClient";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";

export function DashboardLogin({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isFirebaseAuthEnabled()) return null;

  const auth = getFirebaseAuth();
  if (!auth) return null;

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("invalid-credential") ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("popup-closed") ? "" : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#f1f5f9" }}
    >
      <div className="w-full max-w-sm rounded-xl bg-white shadow-lg border border-slate-200 p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-1">แดชบอร์ด</h1>
        <p className="text-sm text-slate-500 mb-6">เข้าสู่ระบบด้วย Google เพื่อดูข้อมูล</p>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-slate-300 hover:bg-slate-50 hover:border-emerald-400 disabled:opacity-50 font-medium text-slate-800"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            เข้าสู่ระบบด้วย Google
          </button>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <details className="mt-4">
          <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
            หรือเข้าสู่ระบบด้วยอีเมล/รหัสผ่าน
          </summary>
          <form onSubmit={handleEmailSignIn} className="mt-3 space-y-3">
            <input
              type="email"
              placeholder="อีเมล"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 text-sm"
              required
            />
            <input
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 text-sm"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-sm font-medium"
            >
              เข้าสู่ระบบ
            </button>
          </form>
        </details>
      </div>
    </div>
  );
}
