/**
 * ฐานข้อมูลกำลังพลบน Firestore
 * รายชื่อจากแท็บ "รายชื่อกำลังพล" + เบอร์จาก "index" + ธนาคาร/บัญชีจาก "bank"
 */
import { getFirestoreDb } from "./firebaseAdmin";

export const PERSONNEL_COLLECTION = "personnel";

export type PersonnelDoc = {
  /** ยศ (จากรายชื่อกำลังพล) */
  rank: string;
  /** ชื่อ (จากรายชื่อกำลังพล) */
  firstName: string;
  /** สกุล (จากรายชื่อกำลังพล) */
  lastName: string;
  /** หมายเลขโทรศัพท์ (จากแท็บ index) */
  phone: string;
  /** ชื่อธนาคาร (จากแท็บ bank) */
  bank: string;
  /** เลขที่บัญชี (จากแท็บ bank) */
  accountNumber: string;
  /** อัปเดตล่าสุด (ใช้ใน Firestore) */
  updatedAt: string;
};

/** สร้าง key สำหรับ document id และการอ้างอิง: ยศ+ชื่อ+สกุล (trim, ช่องว่างเดี่ยว) */
export function personnelKey(rank: string, firstName: string, lastName: string): string {
  const parts = [rank, firstName, lastName].map((s) => String(s ?? "").trim()).filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ");
}

/** สร้าง key สำหรับจับคู่ข้ามแท็บ: เฉพาะ ชื่อ+สกุล (trim, ช่องว่างเดี่ยว) */
export function personnelKeyByNameOnly(firstName: string, lastName: string): string {
  const parts = [firstName, lastName].map((s) => String(s ?? "").trim()).filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ");
}

/**
 * บันทึก/อัปเดทรายการกำลังพลลง Firestore (ใช้ document id = personnelKey)
 */
export async function setPersonnelDoc(doc: PersonnelDoc): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore not available (check GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 / project)");

  const id = personnelKey(doc.rank, doc.firstName, doc.lastName);
  const payload: PersonnelDoc = {
    ...doc,
    updatedAt: new Date().toISOString(),
  };

  await db.collection(PERSONNEL_COLLECTION).doc(id).set(payload, { merge: true });
}

/**
 * บันทึกหลายรายการแบบ batch (ละ batch 500 ตาม limit Firestore)
 */
export async function setPersonnelBatch(docs: PersonnelDoc[]): Promise<{ written: number; errors: number }> {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore not available");

  const BATCH_SIZE = 500;
  let written = 0;
  let errors = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);
    for (const doc of chunk) {
      const id = personnelKey(doc.rank, doc.firstName, doc.lastName);
      const ref = db.collection(PERSONNEL_COLLECTION).doc(id);
      batch.set(ref, { ...doc, updatedAt: now }, { merge: true });
      written++;
    }
    try {
      await batch.commit();
    } catch (e) {
      errors += chunk.length;
      console.error("[personnelDb] batch commit error:", e);
      throw e;
    }
  }
  return { written, errors };
}

/** คะแนนความเกี่ยวข้องของคำถามกับรายชื่อ (ยศ ชื่อ สกุล) */
function scorePersonnelDoc(query: string, doc: PersonnelDoc): number {
  const q = query
    .toLowerCase()
    .replace(/[^\u0E00-\u0E7F\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const combined = `${doc.rank} ${doc.firstName} ${doc.lastName}`.toLowerCase();
  let score = 0;
  for (const w of q) {
    if (combined.includes(w)) score += 1;
  }
  return score;
}

/**
 * ดึงรายชื่อกำลังพลจาก Firestore สำหรับใช้เป็น context ใน RAG
 * - ถ้ามีคำถาม: เลือกรายการที่คำในคำถามตรงกับ ยศ/ชื่อ/สกุล (สูงสุด maxDocs รายการ)
 * - ถ้าไม่มีคำถาม: ส่งคืนรายการแรกสุดไม่เกิน maxDocs
 */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let personnelCache: { docs: PersonnelDoc[]; at: number } | null = null;

export async function getPersonnelRagContext(
  query: string,
  options: { maxDocs?: number } = {}
): Promise<string> {
  const db = getFirestoreDb();
  if (!db) return "";

  const maxDocs = options.maxDocs ?? 50;
  const now = Date.now();

  let docs: PersonnelDoc[] = [];

  // Check cache first
  if (personnelCache && now - personnelCache.at < CACHE_TTL_MS) {
    docs = personnelCache.docs;
  } else {
    // Cache miss, fetch from Firestore
    console.log("[personnelDb] Cache miss, fetching from Firestore...");
    const snapshot = await db.collection(PERSONNEL_COLLECTION).limit(300).get();
    snapshot.forEach((doc) => {
      const d = doc.data() as PersonnelDoc;
      if (d?.rank != null || d?.firstName != null || d?.lastName != null) {
        docs.push({
          rank: String(d.rank ?? ""),
          firstName: String(d.firstName ?? ""),
          lastName: String(d.lastName ?? ""),
          phone: String(d.phone ?? ""),
          bank: String(d.bank ?? ""),
          accountNumber: String(d.accountNumber ?? ""),
          updatedAt: String(d.updatedAt ?? ""),
        });
      }
    });
    // Update cache
    personnelCache = { docs, at: now };
  }

  let selected: PersonnelDoc[];
  const q = (query ?? "").trim();
  if (q) {
    const scored = docs
      .map((d) => ({ doc: d, score: scorePersonnelDoc(q, d) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    selected = scored.slice(0, maxDocs).map((x) => x.doc);
    if (selected.length === 0) selected = docs.slice(0, maxDocs);
  } else {
    selected = docs.slice(0, maxDocs);
  }

  if (selected.length === 0) return "";

  const lines = selected.map((d) => {
    const name = `${d.rank} ${d.firstName} ${d.lastName}`.trim();
    const parts = [name];
    if (d.phone) parts.push(`เบอร์: ${d.phone}`);
    if (d.bank) parts.push(`ธนาคาร: ${d.bank}`);
    if (d.accountNumber) parts.push(`เลขบัญชี: ${d.accountNumber}`);
    return parts.join(" | ");
  });
  return "รายชื่อกำลังพล (ยศ ชื่อ สกุล | เบอร์ | ธนาคาร | เลขบัญชี):\n" + lines.join("\n");
}

/**
 * ดึงรายชื่อกำลังพลทั้งหมดจาก Firestore สำหรับแสดงในแดชบอร์ด (สูงสุด 2000 รายการ)
 */
export async function getAllPersonnel(limit = 2000): Promise<PersonnelDoc[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const snapshot = await db.collection(PERSONNEL_COLLECTION).limit(limit).get();
  const docs: PersonnelDoc[] = [];
  snapshot.forEach((doc) => {
    const d = doc.data() as PersonnelDoc;
    if (d?.rank != null || d?.firstName != null || d?.lastName != null) {
      docs.push({
        rank: String(d.rank ?? ""),
        firstName: String(d.firstName ?? ""),
        lastName: String(d.lastName ?? ""),
        phone: String(d.phone ?? ""),
        bank: String(d.bank ?? ""),
        accountNumber: String(d.accountNumber ?? ""),
        updatedAt: String(d.updatedAt ?? ""),
      });
    }
  });
  return docs;
}
