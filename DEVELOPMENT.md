# รายงานตรวจสอบและแนวทางพัฒนา Jaihan Assistant LINE Bot

## 1. สรุปโปรเจกต์ปัจจุบัน

| ส่วน | รายละเอียด |
|------|------------|
| **Stack** | Next.js 14, LINE Messaging API, Google Gemini, Google Sheets API |
| **Deploy** | Firebase App Hosting |
| **บทบาท** | บอทแอดมิน: คุยกับ AI, อ่านสลิปโอนเงิน, ซิงก์กับ Google Sheets (index + slip), รีวิวสถานะการชำระ |

### ฟีเจอร์หลัก
- **แชทกับ AI** (Gemini) – เฉพาะแอดมิน
- **ส่งรูปสลิป** → เลือก "รูปสลิปโอนเงิน" → อ่านยอด/ชื่อ/วันโอนด้วย Vision → บันทึกลง slip แล้ว allocate ไป index
- **คำสั่งแอดมิน**: `sync`, `review`, `summary`, `help`, `myid`
- **Review flow**: แสดงรายการรอตรวจ (N ว่าง) เป็น Carousel → กดปุ่มกำหนด N (รออนุมัติ/รอส่ง/รอลบ/ข้อมูลไม่ถูกต้อง) แล้วอัปเดต M,N,O ใน index
- **Admin API**: `GET /api/admin/sheets/tabs` (ใช้ `x-admin-key`) สำหรับดึงรายชื่อแท็บใน Spreadsheet

---

## 2. จุดที่ควรแก้ไข / ความเสี่ยง

### 2.1 ความปลอดภัยและค่า config ✅ ทำแล้ว
- ~~**`apphosting.yaml`** hardcode~~ → ใช้ secret `adminLineUserIds`, `googleSheetsId` แล้ว
- ~~README ไม่ครบ~~ → อัปเดตแล้ว (env, Sheets, คำสั่งแอดมิน, รายการ secrets)

### 2.2 โครงสร้างโค้ด ✅ ทำแล้ว
- ~~**route.ts** ยาวมาก~~ → แยกเป็น `lib/webhook/` (handleText, handleImage, handlePostback, handleEvents) และ `lib/lineFlexMessages.ts` แล้ว

### 2.3 ความสอดคล้องของ config ✅ ทำแล้ว
- ~~Gemini model ไม่ตรง~~ → `config.ts` default เป็น `gemini-2.5-flash-lite` ตรงกับ apphosting แล้ว

### 2.4 ฟีเจอร์ที่ยังไม่ครบ ✅ ทำแล้ว
- ~~ปุ่ม "อื่นๆ (ยังไม่ทำ)"~~ ✅
- ~~ไม่มี rate limiting~~ → จำกัด 120 req/IP/นาที ที่ `lib/rateLimit.ts`
- ~~ไม่มี retry~~ → `lib/retry.ts` ใช้กับ LINE, Gemini, Sheets (exponential backoff, สูงสุด 3 ครั้ง)

### 2.5 การทดสอบและคุณภาพ ✅ ทำแล้ว
- ~~ยังไม่มี unit test~~ → Vitest + `lib/paymentAllocation.test.ts` (allocateSlipToIndex 7 cases)
- ยังไม่มี e2e/integration test สำหรับ webhook (เลือกได้)

### 2.6 บันทึกและตรวจสอบ ✅ ทำแล้ว
- ~~ไม่มี structured logging~~ → `lib/logger.ts` + `logWebhookError` ใน handleEvents และ route

---

## 3. แนวทางพัฒนา (เรียงตามความสำคัญ)

### สูง (ความปลอดภัย + รองรับการใช้งานจริง) ✅ ทำแล้ว
1. ~~ย้ายค่า sensitive ใน apphosting.yaml~~ ✅
2. ~~อัปเดต README~~ ✅
3. ~~แยก webhook handler~~ ✅

### กลาง (ความทนทาน + ประสบการณ์แอดมิน) ✅ ทำแล้ว
4. ~~Rate limiting~~ ✅ `lib/rateLimit.ts` + ใช้ใน webhook route
5. ~~Retry สำหรับ external API~~ ✅ `lib/retry.ts` ใช้ใน line, gemini, googleSheets
6. ~~จัดการ intent "อื่นๆ"~~ ✅

### ปานกลาง–ต่ำ (คุณภาพและบำรุงรักษา) ✅ ทำแล้ว
7. ~~Unit tests~~ ✅ Vitest + `paymentAllocation.test.ts`
8. ~~Structured logging~~ ✅ `lib/logger.ts` + logWebhookError
9. ~~Type สำหรับ LINE event~~ ✅ ใช้ `WebhookEvent` จาก `@line/bot-sdk` ใน handleEvents และ route

### เลือกได้ (ฟีเจอร์ใหม่)
10. **Dashboard หรือหน้าแอดมินบนเว็บ**
    - ใช้ Admin API ที่มีอยู่แล้ว แสดงรายการแท็บ หรือสรุปจาก index/slip (ต้องมี auth เพิ่ม เช่น session หรือ OAuth)
11. **แจ้งเตือนเมื่อมีสลิปที่ต้องตรวจมือ**
    - จาก allocation summary อาจ push message ไป LINE แอดมินเมื่อ `needsReview > 0` (ระวังเรื่อง spam)
12. **รองรับหลาย Spreadsheet**
    - ถ้าในอนาคตมีหลายหน่วยงาน อาจใช้ `GOOGLE_SHEETS_ID` ต่อ channel หรือเก็บ mapping channel → spreadsheetId

---

## 4. สรุปสั้นๆ

- โปรเจกต์ทำงานครบตามเป้า: LINE Bot + Gemini + Sheets สำหรับสลิปและ index พร้อมคำสั่ง sync/review/summary
- **ทำแล้วทั้งหมด (รอบปรับปรุงล่าสุด):** secret ใน apphosting, README, แยก webhook handler, ปุ่ม "อื่นๆ", rate limiting, retry (LINE/Gemini/Sheets), unit tests (Vitest + paymentAllocation), structured logging, GEMINI_MODEL default ตรงกับ production, ใช้ type WebhookEvent จาก LINE SDK
- **เลือกได้ต่อไป:** e2e/integration test สำหรับ webhook, Dashboard แอดมิน, แจ้งเตือน needsReview, รองรับหลาย Spreadsheet
