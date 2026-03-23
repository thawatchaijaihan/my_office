import { getKnowledge } from "./ragKnowledge";
import { RAG_KNOWLEDGE_INLINE } from "./ragKnowledge";

/** แบ่งเอกสารเป็นส่วนตามหัวข้อ ## หรือ ### */
export function splitIntoChunks(doc: string): { title: string; text: string }[] {
  const chunks: { title: string; text: string }[] = [];
  const sections = doc.split(/(?=^##\s)/m).filter(Boolean);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    const firstLine = trimmed.split("\n")[0] ?? "";
    const title = firstLine.replace(/^#+\s*/, "").trim();
    chunks.push({ title, text: trimmed });
  }

  if (chunks.length === 0 && doc.trim()) {
    chunks.push({ title: "เอกสาร", text: doc.trim() });
  }
  return chunks;
}

/** คะแนนความเกี่ยวข้องแบบง่าย: นับคำใน query ที่ปรากฏใน chunk (ไม่สนใจตัวพิมพ์) */
export function scoreChunk(query: string, chunk: { title: string; text: string }): number {
  const words = query
    .toLowerCase()
    .replace(/[^\u0E00-\u0E7F\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const combined = `${chunk.title} ${chunk.text}`.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (combined.includes(w)) score += 1;
  }
  return score;
}

/**
 * ดึงส่วนของเอกสารที่เกี่ยวข้องกับคำถาม (แบบ keyword overlap)
 * ถ้าใส่ doc จะใช้เอกสารนั้น ไม่ใช้ cache
 */
export function getRelevantChunks(
  query: string,
  options: { maxChunks?: number; minScore?: number; doc?: string } = {}
): string[] {
  const { maxChunks = 5, minScore = 0, doc } = options;
  const chunks = doc !== undefined ? splitIntoChunks(doc) : splitIntoChunks(RAG_KNOWLEDGE_INLINE);
  if (!query.trim()) return [];

  const scored = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(query, chunk) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, maxChunks).map((x) => x.chunk.text);
}

/**
 * ดึงบริบทจากเอกสารสำหรับคำถามนี้ (โหลดจากไฟล์/inline ตาม config)
 * ถ้าไม่มีส่วนที่เกี่ยวข้องจะคืนสตริงว่าง (แล้วให้ใช้แชทธรรมดา)
 */
export async function getRagContext(query: string, maxChunks = 5): Promise<string> {
  const doc = await getKnowledge();
  const chunks = getRelevantChunks(query, { maxChunks, doc });
  return chunks.join("\n\n---\n\n");
}
