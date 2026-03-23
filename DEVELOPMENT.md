# รายงานตรวจสอบและแนวทางพัฒนา Jaihan Assistant (gate-pass)

## 1. สรุปโปรเจกต์ปัจจุบัน

| ส่วน | รายละเอียด |
|------|------------|
| **Stack** | Next.js 14, Telegram Bot API, Google Gemini, Google Sheets API, Firebase (Auth, Realtime DB) |
| **Deploy** | Firebase App Hosting |
| **บทบาท** | บอทแอดมิน (Telegram): คุยกับ AI, อ่านสลิปโอนเงิน, ซิงก์กับ Google Sheets (index + slip), รีวิวสถานะการชำระ + แดชบอร์ดเว็บสรุปและจัดการรายการ |

### ฟีเจอร์หลัก
- **แชทกับ AI** (Gemini) – เฉพาะแอดมิน (Telegram)
- **ส่งรูปสลิป** → เลือก "รูปสลิปโอนเงิน" → อ่านยอด/ชื่อ/วันโอนด้วย Vision → บันทึกลง slip แล้ว allocate ไป index
- **คำสั่งแอดมิน (Telegram)**: `sync`, `review`, `summary`, `help`, `myid`, `invalid`
- **Review flow**: แสดงรายการรอตรวจ (N ว่าง) พร้อมปุ่มกำหนด N (รออนุมัติ/รอส่ง/รอลบ/ข้อมูลไม่ถูกต้อง) แล้วอัปเดต M,N,O ใน index
- **แดชบอร์ดเว็บ** (`/dashboard`): สรุปจำนวน, กราฟ, หน้ารายการขอบัตรผ่าน (ค้นหา, เลือก/เรียงคอลัมน์, ตัวกรอง M/N, แก้ไขเลขบัตรคอลัมน์ P), จำการตั้งค่าตารางผ่าน Realtime Database
- **Cache index**: In-memory cache 60s สำหรับข้อมูลแท็บ index ใช้ร่วมทุก endpoint แดชบอร์ด/Telegram
- **Admin API**: `GET /api/admin/sheets/tabs`, `POST /api/admin/sync-personnel` (ใช้ `x-admin-key`)

---

## 2. จุดที่ควรแก้ไข / ความเสี่ยง

### 2.1 ความปลอดภัยและค่า config ✅ ทำแล้ว
- ~~**`apphosting.yaml`** hardcode~~ → ใช้ secret `adminLineUserIds`, `googleSheetsId` แล้ว
- ~~README ไม่ครบ~~ → อัปเดตแล้ว (env, Sheets, คำสั่งแอดมิน, รายการ secrets)

### 2.2 โครงสร้างโค้ด ✅ ทำแล้ว
- Handler Telegram แยกใน `lib/telegram/handleTelegram.ts` (handleText, รูปสลิป, callback ปุ่ม review)
- API แดชบอร์ดแยก route ต่อหน้าที่ใช้ (dashboard, review, pending-*, invalid, preferences, card-number)

### 2.3 ความสอดคล้องของ config ✅ ทำแล้ว
- ~~Gemini model ไม่ตรง~~ → `config.ts` default เป็น `gemini-2.5-flash-lite` ตรงกับ apphosting แล้ว

### 2.4 ฟีเจอร์ที่ยังไม่ครบ ✅ ทำแล้ว
- ~~ปุ่ม "อื่นๆ (ยังไม่ทำ)"~~ ✅
- ~~ไม่มี rate limiting~~ → จำกัด 120 req/IP/นาที ที่ `lib/rateLimit.ts`
- ~~ไม่มี retry~~ → `lib/retry.ts` ใช้กับ Telegram, Gemini, Sheets (exponential backoff, สูงสุด 3 ครั้ง)

### 2.5 การทดสอบและคุณภาพ ✅ ทำแล้ว
- ~~ยังไม่มี unit test~~ → Vitest + `lib/paymentAllocation.test.ts` (allocateSlipToIndex 7 cases)
- ยังไม่มี e2e/integration test สำหรับ Telegram webhook (เลือกได้)

### 2.6 บันทึกและตรวจสอบ ✅ ทำแล้ว
- ~~ไม่มี structured logging~~ → `lib/logger.ts` + `logWebhookError` ใน handleEvents และ route

---

## 3. แนวทางพัฒนา (เรียงตามความสำคัญ)

### สูง (ความปลอดภัย + รองรับการใช้งานจริง) ✅ ทำแล้ว
1. ~~ย้ายค่า sensitive ใน apphosting.yaml~~ ✅
2. ~~อัปเดต README~~ ✅
3. ~~แยก Telegram/webhook handler~~ ✅

### กลาง (ความทนทาน + ประสบการณ์แอดมิน) ✅ ทำแล้ว
4. ~~Rate limiting~~ ✅ `lib/rateLimit.ts` + ใช้ใน Telegram webhook route
5. ~~Retry สำหรับ external API~~ ✅ `lib/retry.ts` ใช้ใน line, gemini, googleSheets
6. ~~จัดการ intent "อื่นๆ"~~ ✅

### ปานกลาง–ต่ำ (คุณภาพและบำรุงรักษา) ✅ ทำแล้ว
7. ~~Unit tests~~ ✅ Vitest + `paymentAllocation.test.ts`
8. ~~Structured logging~~ ✅ `lib/logger.ts` + logWebhookError
9. ~~Type สำหรับ Telegram event~~ ✅ ใช้ type จาก Telegram payload ใน handleTelegram และ route

### ทำแล้ว (แดชบอร์ด + cache + รายการขอบัตรผ่าน) ✅
10. **Dashboard หน้าแอดมินบนเว็บ** ✅
    - Firebase Auth + Realtime DB allowlist, หน้าสรุป/กราฟ, หน้ารายการขอบัตรผ่าน
    - ช่องค้นหา, เลือกคอลัมน์ + ลากเรียง, ตัวกรองสถานะ M/N, แก้ไขเลขบัตร (คอลัมน์ P) บันทึกลง index
    - จำการตั้งค่าตาราง: Realtime DB (`dashboardPreferences/{uid}/review`) ผูกกับ Firebase UID ของผู้ใช้
11. **Cache ข้อมูล index** ✅
    - `lib/indexRowsCache.ts` TTL 60s ใช้ร่วม dashboard/review/pending*/invalid และ Telegram sync/summary/review/invalid

### เลือกได้ (ฟีเจอร์ใหม่)
12. **แจ้งเตือนเมื่อมีสลิปที่ต้องตรวจมือ**
    - จาก allocation summary อาจ push message ไป Telegram แอดมินเมื่อ `needsReview > 0` (ระวังเรื่อง spam)
13. **รองรับหลาย Spreadsheet**
    - ถ้าในอนาคตมีหลายหน่วยงาน อาจใช้ `GOOGLE_SHEETS_ID` ต่อ channel หรือเก็บ mapping channel → spreadsheetId

---

## 4. สรุปสั้นๆ

- โปรเจกต์ทำงานครบตามเป้า: **Telegram Bot** + Gemini + Google Sheets (index + slip) พร้อมคำสั่ง sync/review/summary/invalid และ **แดชบอร์ดเว็บ** (สรุป, รายการขอบัตรผ่าน, แก้ไขเลขบัตร, จำการตั้งค่า)
- **ทำแล้วทั้งหมด:** secret ใน apphosting, README, rate limiting, retry, unit tests (Vitest + paymentAllocation, rag, personnelDb), structured logging, GEMINI_MODEL ตรง production, แดชบอร์ด + Firebase Auth + Realtime DB allowlist, หน้ารายการขอบัตรผ่าน (ค้นหา/คอลัมน์/ตัวกรอง M,N/เลขบัตร), cache index 60s, preferences (บันทึกใน Realtime Database ต่อผู้ใช้)
- **เลือกได้ต่อไป:** e2e/integration test สำหรับ Telegram webhook, แจ้งเตือน needsReview, รองรับหลาย Spreadsheet
