/**
 * Firebase Admin SDK - ใช้เฉพาะฝั่ง server (API routes)
 * ใช้ GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 (ต้องมีสิทธิ์ Firebase Admin)
 * หรือ Application Default Credentials บน Firebase App Hosting
 */
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let adminApp: App | null = null;

function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  if (getApps().length) {
    adminApp = getApps()[0] as App;
    return adminApp;
  }
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64?.trim();
  if (b64) {
    try {
      const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
      adminApp = initializeApp({ credential: cert(json) });
      return adminApp;
    } catch {
      console.error("[Firebase Admin] Invalid GOOGLE_SERVICE_ACCOUNT_KEY_BASE64");
      return null;
    }
  }
  try {
    adminApp = initializeApp({ projectId: process.env.GCLOUD_PROJECT || "jaihan-assistant" });
    return adminApp;
  } catch (e) {
    console.error("[Firebase Admin] Init failed:", e);
    return null;
  }
}

export async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; email?: string } | null> {
  const app = getAdminApp();
  if (!app) return null;
  try {
    const decoded = await getAuth(app).verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}
