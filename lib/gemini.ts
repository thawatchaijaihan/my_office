import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "./config";

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

/**
 * Generate AI response from user message
 */
export async function chat(message: string): Promise<string> {
  const model = getGenAI().getGenerativeModel({
    model: config.gemini.model,
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent(message);
  const response = result.response;

  if (!response.text) {
    return "ขออภัย ไม่สามารถประมวลผลได้ในขณะนี้ ลองใหม่อีกครั้งนะครับ";
  }

  return response.text();
}
