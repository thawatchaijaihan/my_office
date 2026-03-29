/**
 * Firebase Admin SDK - ใช้เฉพาะฝั่ง server (API routes)
 * ใช้ GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 (ต้องมีสิทธิ์ Firebase Admin)
 * หรือ Application Default Credentials บน Firebase App Hosting
 *
 * Realtime Database ใช้แอปแยกชื่อ "realtime-db" (credential + databaseURL) เพื่อให้ credential ใช้กับ DB ถูกต้อง
 */
import { initializeApp, getApps, cert, type App, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";

const REALTIME_DB_APP_NAME = "realtime-db";

let adminApp: App | null = null;
let databaseApp: App | null = null;

function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  if (getApps().length) {
    const existing = getApps().find((a) => (a as App).name !== REALTIME_DB_APP_NAME);
    if (existing) {
      adminApp = existing as App;
      return adminApp;
    }
  }
  
  try {
    const t0 = Date.now();
    let cred;
    try {
      cred = applicationDefault();
    } catch (e) {
      console.warn("[Firebase Admin] applicationDefault failed, using fallback credential:", e instanceof Error ? e.message : e);
      const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
      if (b64) {
        try {
          const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
          cred = cert(json);
        } catch (je) {
          console.warn("[Firebase Admin] fallback credential also failed:", je);
          // provide a dummy credential to prevent initializeApp from crashing when calling applicationDefault internally
          cred = { getAccessToken: () => Promise.resolve({ access_token: 'dummy', expires_in: 3600 }) };
        }
      } else {
        cred = { getAccessToken: () => Promise.resolve({ access_token: 'dummy', expires_in: 3600 }) };
      }
    }
    
    // We can verify ID tokens without full access to my-office-713 if projectId is provided explicitly
    adminApp = initializeApp({ 
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "my-office-713",
      credential: cred
    });
    console.log("[Firebase Admin] init (default credentials) ใช้เวลา", Date.now() - t0, "ms");
    return adminApp;
  } catch (e) {
    console.error("[Firebase Admin] Init failed:", e instanceof Error ? e.stack : e);
    return null;
  }
}

/** แอปสำหรับ Realtime Database เท่านั้น — ต้องมี credential + databaseURL เพื่อไม่ให้ขึ้น credential invalid */
function getDatabaseApp(): App | null {
  if (databaseApp) return databaseApp;
  const existing = getApps().find((a) => (a as App).name === REALTIME_DB_APP_NAME);
  if (existing) {
    databaseApp = existing as App;
    return databaseApp;
  }
  const dbUrl = (
    process.env.FIREBASE_DATABASE_URL?.trim()
    || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.trim()
  );
  if (!dbUrl) return null;
  
  try {
    const t0 = Date.now();
    let cred;
    try {
      cred = applicationDefault();
    } catch (e) {
      const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
      if (b64) {
        try {
          const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
          cred = cert(json);
        } catch {}
      }
      if (!cred) cred = { getAccessToken: () => Promise.resolve({ access_token: 'dummy', expires_in: 3600 }) };
    }

    databaseApp = initializeApp(
      { 
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "my-office-713", 
        databaseURL: dbUrl,
        credential: cred
      },
      REALTIME_DB_APP_NAME
    );
    console.log("[Firebase Admin] init (realtime-db app) ใช้เวลา", Date.now() - t0, "ms");
    return databaseApp;
  } catch (e) {
    console.error("[Firebase Admin] Realtime DB app init failed:", e instanceof Error ? e.stack : e);
    return null;
  }
}

export type FirebaseDecodedUser = {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
};

export async function verifyFirebaseToken(idToken: string): Promise<FirebaseDecodedUser | null> {
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin SDK failed to initialize");
  try {
    const decoded = await getAuth(app).verifyIdToken(idToken);
    const d = decoded as { uid: string; email?: string; name?: string; picture?: string };
    return {
      uid: d.uid,
      email: d.email,
      displayName: d.name,
      photoURL: d.picture,
    };
  } catch (e: any) {
    throw new Error(`verifyIdToken failed: ${e.message || String(e)}`);
  }
}

/** Realtime Database (ต้องตั้ง FIREBASE_DATABASE_URL ใน env) ใช้แอป "realtime-db" ที่มี credential + databaseURL */
export function getRealtimeDb() {
  const app = getDatabaseApp();
  if (!app) return null;
  try {
    return getDatabase(app);
  } catch {
    return null;
  }
}

/** Cloud Firestore — ใช้ default app (project จาก credential) */
export function getFirestoreDb() {
  const app = getAdminApp();
  if (!app) return null;
  try {
    return getFirestore(app);
  } catch {
    return null;
  }
}
