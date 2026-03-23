import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "./config";
import { withRetry } from "./retry";

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const key = config.gemini.apiKey;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    _genAI = new GoogleGenerativeAI(key);
  }
  return _genAI;
}

const SYSTEM_PROMPT = `คุณคือผู้ช่วยอัจฉริยะที่ทำงานผ่าน Telegram Bot
- ตอบคำถามอย่างกระชับและเป็นกันเอง
- ใช้ภาษาไทยเป็นหลัก
- หากไม่แน่ใจให้ตอบอย่างสุภาพว่าไม่ทราบ`;

const RAG_SYSTEM_PROMPT = `คุณคือผู้ช่วยอัจฉริยะที่ทำงานผ่าน Telegram Bot
- ตอบคำถามจาก "เอกสารอ้างอิง" ด้านล่างเท่านั้น
- ตอบอย่างกระชับ เป็นกันเอง ใช้ภาษาไทย
- ถ้าคำถามไม่อยู่ในเอกสารหรือไม่เกี่ยวข้อง ให้ตอบอย่างสุภาพว่า "ในคู่มือไม่มีข้อมูลนี้ครับ ถ้าต้องการความช่วยเหลือเพิ่มเติมลองติดต่อแอดมิน"
- ห้ามแต่งเรื่องหรือตอบนอกเหนือจากเอกสารที่ให้มา`;

const PERSONNEL_RAG_SYSTEM_PROMPT = `คุณคือผู้ช่วยตอบคำถามจาก "รายชื่อกำลังพล" (ฐานข้อมูล Firestore)
- ตอบจากรายการด้านล่างเท่านั้น: ยศ ชื่อ สกุล เบอร์โทร ธนาคาร เลขที่บัญชี
- ตอบอย่างกระชับ เป็นกันเอง ใช้ภาษาไทย
- ถ้าไม่พบชื่อหรือข้อมูลในรายชื่อ ให้ตอบว่า "ไม่พบในรายชื่อกำลังพลครับ"
- ห้ามแต่งเรื่องหรือให้ข้อมูลนอกเหนือจากรายชื่อที่ให้มา`;

const SLIP_PROMPT = `คุณคือผู้ช่วยอ่านข้อความจาก "สลิปการโอนเงิน" (รูปภาพ)
หน้าที่ของคุณคือดึงข้อมูลสำคัญเพื่อใช้ตรวจการชำระเงินค่าบัตรผ่าน

ให้ตอบ "เฉพาะ JSON" เท่านั้น ห้ามมีข้อความอื่น
รูปแบบ JSON:
{
  "payer_first_name": "string|null",
  "payer_last_name": "string|null",
  "amount": number|null,
  "transfer_datetime": "YYYY-MM-DD HH:mm:ss|null",
  "confidence": number
}

กติกา:
- ถ้าอ่านไม่ออกให้ใส่ null
- confidence ให้ 0 ถึง 1
- amount เป็นตัวเลขบาท (เช่น 60)
`;

/**
 * Generate AI response from user message (with retry on transient errors)
 */
export async function chat(message: string): Promise<string> {
  const model = getGenAI().getGenerativeModel({
    model: config.gemini.model,
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await withRetry(() => model.generateContent(message));
  const response = result.response;

  if (!response.text) {
    return "ขออภัย ไม่สามารถประมวลผลได้ในขณะนี้ ลองใหม่อีกครั้งนะครับ";
  }

  return response.text();
}

/**
 * ตอบคำถามโดยอิงจากบริบท (RAG): ใส่เอกสารที่ดึงมาเป็น context
 * ใช้เมื่อมี context จาก getRagContext()
 */
export async function chatWithContext(
  message: string,
  contextFromDocs: string
): Promise<string> {
  if (!contextFromDocs.trim()) {
    return chat(message);
  }

  const model = getGenAI().getGenerativeModel({
    model: config.gemini.model,
    systemInstruction: RAG_SYSTEM_PROMPT,
  });

  const prompt = `เอกสารอ้างอิง:\n\n${contextFromDocs}\n\n---\n\nคำถามจากผู้ใช้: ${message}`;
  const result = await withRetry(() => model.generateContent(prompt));
  const response = result.response;

  if (!response.text) {
    return "ขออภัย ไม่สามารถประมวลผลได้ในขณะนี้ ลองใหม่อีกครั้งนะครับ";
  }

  return response.text();
}

/**
 * ถาม-ตอบเกี่ยวกับฐานข้อมูลกำลังพล (RAG จาก Firestore)
 * ใส่ context จาก getPersonnelRagContext()
 */
export async function chatWithPersonnelContext(
  message: string,
  personnelContext: string
): Promise<string> {
  if (!personnelContext.trim()) {
    return "ขณะนี้ไม่มีข้อมูลรายชื่อกำลังพลในระบบครับ";
  }

  const model = getGenAI().getGenerativeModel({
    model: config.gemini.model,
    systemInstruction: PERSONNEL_RAG_SYSTEM_PROMPT,
  });

  const prompt = `${personnelContext}\n\n---\n\nคำถาม: ${message}`;
  const result = await withRetry(() => model.generateContent(prompt));
  const response = result.response;

  if (!response.text) {
    return "ขออภัย ไม่สามารถประมวลผลได้ในขณะนี้ ลองใหม่อีกครั้งนะครับ";
  }

  return response.text();
}

function tryParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export type SlipExtraction = {
  payer_first_name: string | null;
  payer_last_name: string | null;
  amount: number | null;
  transfer_datetime: string | null;
  confidence: number;
};

/**
 * Extract fields from slip image using Gemini multimodal.
 */
export async function extractSlipFromImage(params: {
  imageBytes: Buffer;
  mimeType: string;
}): Promise<{ data: SlipExtraction | null; rawText: string }> {
  const model = getGenAI().getGenerativeModel({
    model: config.gemini.model,
    systemInstruction: SLIP_PROMPT,
  });

  const base64 = params.imageBytes.toString("base64");

  const result = await withRetry(() =>
    model.generateContent([
      { text: "อ่านข้อความจากสลิปนี้ แล้วตอบเป็น JSON ตามรูปแบบที่กำหนด" } as any,
      {
        inlineData: {
          mimeType: params.mimeType,
          data: base64,
        },
      } as any,
    ])
  );

  const rawText = result.response.text?.() ?? "";
  const parsed = tryParseJson<SlipExtraction>(rawText);
  return { data: parsed, rawText };
}
