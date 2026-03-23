import { readIndexRows } from "./passSheets";

const LOG = (msg: string, ...args: unknown[]) => console.log("[indexRowsCache]", msg, ...args);

const INDEX_ROWS_CACHE_TTL_MS = 60 * 1000; // 60 วินาที (ปรับได้ตามต้องการ)

let indexRowsCache:
  | { rows: Awaited<ReturnType<typeof readIndexRows>>; at: number }
  | null = null;

/** ดึง indexRows พร้อม in-memory cache ใช้ร่วมกันทุก endpoint */
export async function getCachedIndexRows() {
  const now = Date.now();
  if (indexRowsCache && now - indexRowsCache.at < INDEX_ROWS_CACHE_TTL_MS) {
    LOG("cache hit อายุ", Math.round((now - indexRowsCache.at) / 1000), "วินาที");
    return indexRowsCache.rows;
  }

  LOG("cache miss → อ่าน Google Sheets");
  const rows = await readIndexRows();
  indexRowsCache = { rows, at: now };
  return rows;
}

/** ใช้เมื่อต้องการบังคับให้โหลดจาก Sheets ใหม่ (เช่น หลัง sync ใหญ่) */
export function clearIndexRowsCache() {
  LOG("clear cache");
  indexRowsCache = null;
}

