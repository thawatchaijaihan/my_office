/**
 * บันทึกข้อมูลผู้ใช้ที่ล็อกอิน (Google/อีเมล) ลง Realtime Database
 * โครงสร้าง: users/{uid} = { email, displayName?, photoURL?, lastLoginAt }
 * ให้แอดมินเห็นรายชื่อคนที่เคยล็อกอิน แล้วไปกำหนดสิทธิ์ใน dashboardAdmins ได้
 */

import { getRealtimeDb } from "./firebaseAdmin";
import { ServerValue } from "firebase-admin/database";

const USERS_PATH = "users";

export type UserProfile = {
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

export async function recordUserToDb(uid: string, profile: UserProfile): Promise<boolean> {
  const db = getRealtimeDb();
  if (!db) {
    console.warn("[recordUserToDb] getRealtimeDb() เป็น null — ตรวจว่า FIREBASE_DATABASE_URL ถูกตั้งใน env และ server รีสตาร์ทแล้ว");
    return false;
  }
  try {
    const ref = db.ref(`${USERS_PATH}/${uid}`);
    await ref.set({
      email: profile.email ?? null,
      displayName: profile.displayName ?? null,
      photoURL: profile.photoURL ?? null,
      lastLoginAt: ServerValue.TIMESTAMP,
    });
    return true;
  } catch (err) {
    console.error("[recordUserToDb] เขียน users/" + uid + " ไม่สำเร็จ:", err);
    return false;
  }
}
