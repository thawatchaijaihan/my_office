/**
 * Firebase client SDK - ใช้เฉพาะฝั่ง browser
 * ต้องตั้งค่า NEXT_PUBLIC_FIREBASE_* ใน env
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

function getFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: storageBucket || `${projectId}.firebasestorage.app`,
  };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (typeof window === "undefined") return null;
  if (auth) return auth;
  const config = getFirebaseConfig();
  if (!config) return null;
  app = getApps().length ? getApps()[0] as FirebaseApp : initializeApp(config);
  auth = getAuth(app);
  return auth;
}

export function isFirebaseAuthEnabled(): boolean {
  return !!getFirebaseConfig();
}
