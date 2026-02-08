/**
 * เอกสาร/คู่มือสำหรับ RAG (ถาม-ตอบจากเอกสาร)
 * โหลดจากไฟล์ content/knowledge.md (หรือ path จาก RAG_KNOWLEDGE_PATH) ถ้ามี ไม่ต้อง deploy เพื่อแก้คู่มือ
 */
import { readFile } from "fs/promises";
import path from "path";
import { config } from "./config";

/** เนื้อหา fallback เมื่อไม่อ่านจากไฟล์ได้ */
export const RAG_KNOWLEDGE_INLINE = `
## บัตรผ่านและค่าบริการ

บัตรผ่านมีอัตราค่าบริการ 30 บาทต่อรายการ (ต่อ 1 บัตร)
การชำระเงินให้โอนเข้าบัญชีที่แจ้งในระบบ และส่งสลิปการโอนผ่าน LINE เพื่อให้แอดมินตรวจและปิดรายการ

## วิธีส่งสลิป

1. โอนเงินตามยอดที่แจ้ง
2. ถ่ายภาพสลิปการโอน (หรือ screenshot จากแอปธนาคาร) ให้เห็นชื่อผู้โอน ยอดเงิน วันที่-เวลา
3. ส่งรูปสลิปในแชท LINE กับบอท
4. เลือก "สลิปการโอน" เมื่อบอทถามประเภทของรูป
5. รอแอดมินตรวจและอัปเดตสถานะ

## สถานะการชำระเงิน

- **ค้างชำระ** = ยังไม่โอนหรือยังไม่ตรวจ
- **ชำระเงินแล้ว** = ตรวจสลิปแล้ว ปิดรายการ
- **กรุณาแจ้ง สาย.2** = รอการตรวจหรือรอแอดมินกำหนดสายอนุมัติ
- **ข้อมูลไม่ถูกต้อง** = ข้อมูลในสลิปไม่ตรงกับรายการ (ชื่อ/ยอด/วันที่) ต้องตรวจใหม่หรือแจ้งแอดมิน

## คำสั่งแอดมิน (เฉพาะแอดมิน)

- **help / เมนู** = แสดงคำสั่งทั้งหมด
- **myid** = แสดง LINE userId ของตัวเอง
- **sync** = ซิงก์ข้อมูลจากสลิปไปยัง index และคำนวณสถานะชำระเงิน
- **review** = แสดงรายการรอตรวจ (สถานะ M)
- **invalid** = แสดงรายการที่ N = ข้อมูลไม่ถูกต้อง
- **summary / สรุป** = สรุปภาพรวมจำนวนรายการ ชำระแล้ว/ค้างชำระ/ลบข้อมูล

## ข้อควรระวัง

- สลิปต้องเป็นของรายการที่ลงทะเบียนในระบบเท่านั้น
- ถ้ายอดหรือชื่อไม่ตรง รายการจะถูกใส่เป็น "ข้อมูลไม่ถูกต้อง" และต้องตรวจมือ
`.trim();

/** @deprecated ใช้ RAG_KNOWLEDGE_INLINE หรือ getKnowledge() */
export const RAG_KNOWLEDGE = RAG_KNOWLEDGE_INLINE;

let _cachedKnowledge: string | null = null;

/**
 * ดึงเนื้อหาคู่มือสำหรับ RAG
 * - ถ้า RAG_KNOWLEDGE_PATH ว่างหรือ "inline" ใช้เนื้อหาใน code
 * - ถ้ามี path อ่านจากไฟล์ (เทียบกับ project root) และ cache ในหน่วยความจำ
 */
export async function getKnowledge(): Promise<string> {
  if (_cachedKnowledge !== null) return _cachedKnowledge;

  const rawPath = config.rag.knowledgePath.trim();
  if (!rawPath || rawPath.toLowerCase() === "inline") {
    _cachedKnowledge = RAG_KNOWLEDGE_INLINE;
    return _cachedKnowledge;
  }

  try {
    const fullPath = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
    const content = await readFile(fullPath, "utf8");
    _cachedKnowledge = content.trim() || RAG_KNOWLEDGE_INLINE;
    return _cachedKnowledge;
  } catch {
    _cachedKnowledge = RAG_KNOWLEDGE_INLINE;
    return _cachedKnowledge;
  }
}

/** ล้าง cache (ใช้เมื่อต้องการให้โหลดไฟล์ใหม่ เช่นหลังอัปเดต content) */
export function clearKnowledgeCache(): void {
  _cachedKnowledge = null;
}
