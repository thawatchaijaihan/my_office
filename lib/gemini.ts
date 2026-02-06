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

const SYSTEM_PROMPT = `คุณคือผู้ช่วยอัจฉริยะที่ทำงานผ่าน LINE Bot
- ตอบคำถามอย่างกระชับและเป็นกันเอง
- ใช้ภาษาไทยเป็นหลัก
- หากไม่แน่ใจให้ตอบอย่างสุภาพว่าไม่ทราบ`;

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
