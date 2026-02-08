/**
 * อ่านรายการอีเมล/UID ที่มีสิทธิ์เข้าแดชบอร์ดจาก Firebase Realtime Database
 * ใช้ร่วมกับ env ADMIN_FIREBASE_EMAILS / ADMIN_FIREBASE_UIDS (fallback)
 *
 * โครงสร้างใน Realtime Database:
 *   dashboardAdmins/
 *     emails/
 *       "<encodedEmail>": true   หรือ  { "role": "admin", "addedAt": 123 }
 *     uids/
 *       "<uid>": true
 *
 * encodedEmail = อีเมลที่แทนที่ . เป็น _dot_ และ @ เป็น _at_ (เพราะ key ห้ามมี . $ # [ ] /)
 * เช่น user@gmail.com → user_at_gmail_dot_com
 */

import { getRealtimeDb } from "./firebaseAdmin";

const EMAILS_PATH = "dashboardAdmins/emails";
const UIDS_PATH = "dashboardAdmins/uids";

function encodeEmail(email: string): string {
  return email
    .toLowerCase()
    .trim()
    .replace(/\./g, "_dot_")
    .replace(/@/g, "_at_");
}

/** เช็คว่าอีเมลนี้อยู่ใน allowlist ใน Realtime Database หรือไม่ */
export async function isEmailAllowedInDb(email: string | null | undefined): Promise<boolean> {
  if (!email || !email.trim()) return false;
  const db = getRealtimeDb();
  if (!db) return false;
  try {
    const key = encodeEmail(email);
    const ref = db.ref(`${EMAILS_PATH}/${key}`);
    const snapshot = await ref.once("value");
    const val = snapshot.val();
    return val === true || (typeof val === "object" && val !== null && (val as { allow?: boolean }).allow !== false);
  } catch {
    return false;
  }
}

/** เช็คว่า UID นี้อยู่ใน allowlist ใน Realtime Database หรือไม่ */
export async function isUidAllowedInDb(uid: string): Promise<boolean> {
  if (!uid || !uid.trim()) return false;
  const db = getRealtimeDb();
  if (!db) return false;
  try {
    const ref = db.ref(`${UIDS_PATH}/${uid}`);
    const snapshot = await ref.once("value");
    const val = snapshot.val();
    return val === true || (typeof val === "object" && val !== null && (val as { allow?: boolean }).allow !== false);
  } catch {
    return false;
  }
}

export function decodeEmail(encoded: string): string {
  return encoded
    .replace(/_dot_/g, ".")
    .replace(/_at_/g, "@");
}

export type UserRecord = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastLoginAt: number | null;
};

/** ดึงรายการผู้ใช้ที่เคยล็อกอินจาก users/ */
export async function listUsersFromDb(): Promise<UserRecord[]> {
  const db = getRealtimeDb();
  if (!db) return [];
  try {
    const ref = db.ref("users");
    const snapshot = await ref.once("value");
    const val = snapshot.val();
    if (!val || typeof val !== "object") return [];
    const list: UserRecord[] = [];
    for (const [uid, data] of Object.entries(val)) {
      const o = data as Record<string, unknown>;
      list.push({
        uid,
        email: (o.email as string) ?? null,
        displayName: (o.displayName as string) ?? null,
        photoURL: (o.photoURL as string) ?? null,
        lastLoginAt: typeof o.lastLoginAt === "number" ? o.lastLoginAt : null,
      });
    }
    list.sort((a, b) => (b.lastLoginAt ?? 0) - (a.lastLoginAt ?? 0));
    return list;
  } catch {
    return [];
  }
}

export type AllowlistEntry = { type: "email"; key: string; email: string } | { type: "uid"; uid: string };

/** ดึงรายการที่อยู่ใน allowlist (emails + uids) */
export async function getAllowlistFromDb(): Promise<AllowlistEntry[]> {
  const db = getRealtimeDb();
  if (!db) return [];
  const out: AllowlistEntry[] = [];
  try {
    const emailsRef = db.ref(EMAILS_PATH);
    const emailsSnap = await emailsRef.once("value");
    const emailsVal = emailsSnap.val();
    if (emailsVal && typeof emailsVal === "object") {
      for (const key of Object.keys(emailsVal)) {
        out.push({ type: "email", key, email: decodeEmail(key) });
      }
    }
    const uidsRef = db.ref(UIDS_PATH);
    const uidsSnap = await uidsRef.once("value");
    const uidsVal = uidsSnap.val();
    if (uidsVal && typeof uidsVal === "object") {
      for (const uid of Object.keys(uidsVal)) {
        out.push({ type: "uid", uid });
      }
    }
  } catch {
    // ignore
  }
  return out;
}

/** เพิ่ม UID เข้า allowlist */
export async function addToAllowlistByUid(uid: string): Promise<boolean> {
  if (!uid || !uid.trim()) return false;
  const db = getRealtimeDb();
  if (!db) return false;
  try {
    await db.ref(`${UIDS_PATH}/${uid}`).set({ allow: true, addedAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}

/** เพิ่มอีเมลเข้า allowlist (ใช้ encoded key) */
export async function addToAllowlistByEmail(email: string): Promise<boolean> {
  if (!email || !email.trim()) return false;
  const db = getRealtimeDb();
  if (!db) return false;
  try {
    const key = encodeEmail(email);
    await db.ref(`${EMAILS_PATH}/${key}`).set({ allow: true, addedAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}

/** ลบ UID ออกจาก allowlist */
export async function removeFromAllowlistByUid(uid: string): Promise<boolean> {
  if (!uid || !uid.trim()) return false;
  const db = getRealtimeDb();
  if (!db) return false;
  try {
    await db.ref(`${UIDS_PATH}/${uid}`).remove();
    return true;
  } catch {
    return false;
  }
}

/** ลบอีเมลออกจาก allowlist */
export async function removeFromAllowlistByEmail(email: string): Promise<boolean> {
  if (!email || !email.trim()) return false;
  const db = getRealtimeDb();
  if (!db) return false;
  try {
    const key = encodeEmail(email);
    await db.ref(`${EMAILS_PATH}/${key}`).remove();
    return true;
  } catch {
    return false;
  }
}
