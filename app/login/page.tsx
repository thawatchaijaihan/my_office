"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { getFirebaseAuth, isFirebaseAuthEnabled, isDashboardSkipAuth } from "@/lib/firebaseClient";
import Image from "next/image";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipAuth = isDashboardSkipAuth();

  const handleLogin = async () => {
    if (isFirebaseAuthEnabled()) {
      const auth = getFirebaseAuth();
      if (!auth) return;
      setError(null);
      setLoading(true);
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        router.push("/dashboard");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("popup-closed")) return;
        if (msg.includes("auth/unauthorized-domain")) {
          setError(
            "โดเมนนี้ยังไม่อนุญาตใน Firebase — ไปที่ Firebase Console → Authentication → Settings → Authorized domains แล้วเพิ่ม localhost (หรือโดเมนที่ใช้)"
          );
        } else if (msg.includes("auth/popup-blocked")) {
          setError("ปิดป๊อปอัปล็อกอิน — อนุญาตป๊อปอัปสำหรับไซต์นี้แล้วลองใหม่");
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <section
      className="w-full bg-cover bg-center bg-no-repeat px-4 pb-10 font-sans"
      style={{
        backgroundImage: "url('https://assets.prebuiltui.com/images/components/hero-section/hero-grid-gradient-img.png')",
      }}
    >
      <div className="w-full md:px-16 lg:px-24 xl:px-32 mx-auto flex flex-col-reverse md:flex-row items-center justify-between gap-8 py-20">
        <div className="flex flex-col items-center justify-center text-center w-full md:flex-1">
          <h1 className="text-neutral-900 text-4xl md:text-5xl lg:text-[52px] leading-tight font-semibold mt-4">
            Assistant Admin
            <br />
            bot and dashboard
          </h1>
          <p className="text-base/7 text-neutral-600 max-w-md mt-4">
            Card request data management via Google Sheet — review requests, track inventory, and get notifications in one place.
          </p>

          {skipAuth && (
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white h-[52px] max-w-[280px] w-full rounded-full mt-4 text-sm font-medium transition"
            >
              เข้าแดชบอร์ด (ไม่ต้องล็อกอิน)
            </button>
          )}
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-white border border-neutral-300 hover:bg-gray-50 h-[52px] max-w-[280px] w-full rounded-full mt-6 text-sm text-neutral-700 font-medium transition disabled:opacity-60"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {loading ? "Signing in..." : "Sign in"}
          </button>
          {error && (
            <p className="mt-3 text-sm text-red-600 max-w-[280px]">{error}</p>
          )}
        </div>

        <div className="w-full max-w-md md:max-w-lg">
          <Image
            className="w-full h-auto object-contain"
            src="https://assets.prebuiltui.com/images/components/hero-section/hero-rightsocial-image.png"
            alt="Dashboard Preview"
            width={672}
            height={672}
            priority
          />
        </div>
      </div>
    </section>
  );
}
