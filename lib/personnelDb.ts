/**
 * ฐานข้อมูลกำลังพล
 * อ่านรายชื่อตรงจาก Google Sheets (เพื่อหลีกเลี่ยงปัญหา Firestore Not Found)
 */
import { loadAndMergePersonnel } from "./personnelSheets";

export type PersonnelDoc = {
  rank: string;
  firstName: string;
  lastName: string;
  phone: string;
  bank: string;
  accountNumber: string;
  citizenId: string;
  militaryId: string;
  duty: string;
  position: string;
  unit: string;
  birthplace: string;
  birthDate: string;
  registeredDate: string;
  enlistmentDate: string;
  rankDate: string;
  salary: string;
  age: string;
  retireYear: string;
  updatedAt: string;
};

export function personnelKey(rank: string, firstName: string, lastName: string): string {
  const parts = [rank, firstName, lastName].map((s) => String(s ?? "").trim()).filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ");
}

export function personnelKeyByNameOnly(firstName: string, lastName: string): string {
  const parts = [firstName, lastName].map((s) => String(s ?? "").trim()).filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ");
}

// Memory cache
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let personnelCache: { docs: PersonnelDoc[]; at: number } | null = null;

async function getDocsFromCacheOrSheets(): Promise<PersonnelDoc[]> {
  const now = Date.now();
  if (personnelCache && now - personnelCache.at < CACHE_TTL_MS) {
    return personnelCache.docs;
  }
  
  console.log("[personnelDb] Cache miss, fetching directly from Google Sheets...");
  const docs = await loadAndMergePersonnel();
  personnelCache = { docs, at: now };
  return docs;
}

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

export async function getPersonnelRagContext(
  query: string,
  options: { maxDocs?: number } = {}
): Promise<string> {
  try {
    const docs = await getDocsFromCacheOrSheets();
    const maxDocs = options.maxDocs ?? 50;

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
  } catch (e) {
    console.error("[personnelDb] Failed to get RAG context from Sheets", e);
    return "";
  }
}

export async function getAllPersonnel(limit = 2000): Promise<PersonnelDoc[]> {
  try {
    const docs = await getDocsFromCacheOrSheets();
    return docs.slice(0, limit);
  } catch (e) {
    console.error("[personnelDb] Failed to fetch personnel from Sheets", e);
    return [];
  }
}

// Dummy functions for any remaining scripts that try to write to Firestore
export async function setPersonnelDoc(doc: PersonnelDoc): Promise<void> {
  console.log("Firestore bypass: setPersonnelDoc called but ignored");
}

export async function setPersonnelBatch(docs: PersonnelDoc[]): Promise<{ written: number; errors: number }> {
  console.log("Firestore bypass: setPersonnelBatch called but ignored");
  return { written: docs.length, errors: 0 };
}
