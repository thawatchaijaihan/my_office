# Jaihan Assistant – LINE Bot AI

LINE Bot ที่ใช้ Google Gemini เป็น AI ตอบคำถาม และจัดการสลิปโอนเงินกับ Google Sheets รองรับการ deploy บน Firebase App Hosting

## โครงสร้างโปรเจกต์

```
jaihan-assistant-linebot/
├── app/
│   ├── api/
│   │   ├── webhook/route.ts      # LINE Webhook endpoint
│   │   └── admin/sheets/tabs/    # Admin API (รายชื่อแท็บใน Spreadsheet)
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── config.ts                 # Environment config (default GEMINI = gemini-2.5-flash-lite)
│   ├── retry.ts                  # Retry with backoff สำหรับ API ภายนอก
│   ├── rateLimit.ts              # Rate limit ต่อ IP ที่ webhook
│   ├── logger.ts                 # Structured logging (JSON)
│   ├── line.ts                   # LINE SDK client
│   ├── gemini.ts                 # Gemini AI + อ่านสลิปจากรูป
│   ├── lineFlexMessages.ts       # Flex Message (เลือกประเภทรูป, รายการรอตรวจ)
│   ├── googleSheets.ts           # Google Sheets API
│   ├── passSheets.ts             # อ่าน/เขียน แท็บ index, slip
│   ├── paymentAllocation.ts      # logic allocate สลิป → index
│   └── webhook/
│       ├── types.ts
│       ├── utils.ts
│       ├── handleEvents.ts       # กระจาย event ไป handler
│       ├── handleText.ts         # คำสั่งแอดมิน (help, sync, review, incorrect, summary, AI chat)
│       ├── handleImage.ts       # รูปภาพ → เลือกสลิป/อื่นๆ
│       └── handlePostback.ts     # ปุ่ม review, สลิป, อื่นๆ
├── .env.example
├── apphosting.yaml               # Firebase App Hosting (ใช้ secret ไม่ hardcode ค่าลับ)
├── package.json
└── README.md
```

## การติดตั้ง

```bash
npm install
```

## การตั้งค่า

1. คัดลอก `.env.example` เป็น `.env.local`
2. กรอกค่าตามตารางด้านล่าง

```bash
cp .env.example .env.local
```

### ตัวแปร environment

| ตัวแปร | ที่มา | ใช้ทำอะไร |
|--------|--------|------------|
| `LINE_CHANNEL_SECRET` | LINE Developers Console | ตรวจสอบ signature webhook |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console | ส่งข้อความ/ดึงเนื้อหารูป |
| `ADMIN_API_KEY` | ตั้งเอง | ล็อก Admin API (เช่น `GET /api/admin/sheets/tabs`) ผ่าน header `x-admin-key` |
| `ADMIN_LINE_USER_IDS` | หลังรันบอท พิมพ์ `myid` ใน LINE | รายการ LINE userId ของแอดมิน (คั่นด้วย comma) |
| `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` | Google Cloud Console (Service Account → สร้าง key JSON) | แปลงไฟล์ JSON เป็น base64 ใส่ตัวแปรนี้ |
| `GOOGLE_SHEETS_ID` | URL ของ Google Sheet (ค่าหลัง `/d/`) | Spreadsheet ที่มีแท็บ `index` และ `slip` |
| `GEMINI_API_KEY` | Google AI Studio | แชท + อ่านสลิปจากรูป |
| `GEMINI_MODEL` | (optional) | เช่น `gemini-2.0-flash`, `gemini-2.5-flash-lite` |

## โครงสร้าง Google Sheets

ใช้ Spreadsheet เดียว มีอย่างน้อย 2 แท็บ:

### แท็บ `index`

- แถว 1: หัวคอลัมน์
- แถว 2 ลงไป: รายการขอ (ชื่อ, ทะเบียน, ฯลฯ)
- คอลัมน์สำคัญ:
- **M** = สถานะชำระเงิน: `ชำระเงินแล้ว` / `ค้างชำระเงิน` / `ลบข้อมูล` (ถ้าว่าง ระบบสรุปจะนับรวมเป็น "ค้างชำระ")
  - **N** = สถานะการตรวจ: `รออนุมัติจาก ฝขว.พล.ป.`, `รอส่ง ฝขว.พล.ป.`, `รอลบข้อมูล`, `ข้อมูลไม่ถูกต้อง` ฯลฯ
  - **O** = วันที่ตรวจ/อัปเดต (dd/mm/yyyy HH:mm:ss)
  - **L** = หมายเหตุ (ใช้เป็น link ได้ สำหรับปุ่มใน review)

### แท็บ `slip`

- แถว 1: หัวคอลัมน์
- แถว 2 ลงไป: สลิปที่อัปโหลด (จากบอทหรือกรอกมือ)
- คอลัมน์: วันที่บันทึก, ยศ+ชื่อ, นามสกุล, ยอด (บาท), ประเภท (เช่น ค่าบัตรผ่านฯ), วันที่โอน

บอทจะ allocate สลิปไปปิดรายการใน index ตามยอด (30 บาทต่อ 1 รายการ) และจับคู่ชื่อ–นามสกุล

## คำสั่งแอดมิน (ใน LINE)

ใช้ได้เฉพาะ userId ที่อยู่ใน `ADMIN_LINE_USER_IDS`

| คำสั่ง | ความหมาย |
|--------|----------|
| `help` / `เมนู` | แสดงรายการคำสั่ง |
| `myid` | แสดง LINE userId (ใช้ตอนตั้งค่าแอดมิน) |
| `sync` | ซิงก์และคำนวณสถานะชำระจาก slip → index แล้วอัปเดต M,N,O |
| `review` | แสดงรายการที่ N ว่าง (รอตรวจ) เป็น Carousel มีปุ่มกำหนด N |
| `invalid` | แสดงรายการที่ N = ข้อมูลไม่ถูกต้อง (รูปแบบเดียวกับ review แต่ไม่มีปุ่ม) |
| `summary` / `สรุป` / `สรุปวันนี้` | สรุปจำนวนทั้งหมด, ยอดชำระแล้ว/ค้างชำระ (คิดเป็นบาท), ลบข้อมูล, และแยกจำนวนตามสถานะ N |

- ส่ง**รูปภาพ** → บอทถามว่าเป็นรูปอะไร → เลือก "รูปสลิปโอนเงิน" จะอ่านสลิปด้วย Gemini แล้วบันทึกลง slip + allocate; เลือก "อื่นๆ" = ไม่บันทึก

## การทดสอบ

```bash
npm run test        # รัน unit tests (Vitest)
npm run test:watch  # รันแบบ watch
```

มี unit tests สำหรับ `lib/paymentAllocation.ts` (allocateSlipToIndex)

## รันในเครื่อง

```bash
npm run dev
```

เปิด http://localhost:3000

## Webhook

LINE ส่งเหตุการณ์มายัง:

```
POST https://<your-domain>/api/webhook
```

ใช้ URL นี้ตั้งเป็น Webhook URL ใน LINE Developers Console

## Deploy บน Firebase App Hosting

1. Push โค้ดขึ้น GitHub
2. Firebase Console → **Build → App Hosting** → Create backend
3. เชื่อม GitHub (root = `/`, branch = `main`)
4. ตั้งค่า **secrets** ให้ตรงกับ `apphosting.yaml` (ค่าลับไม่เก็บใน repo):

| Secret name | ค่าที่ใส่ |
|-------------|-----------|
| `lineChannelSecret` | LINE Channel Secret |
| `lineChannelAccessToken` | LINE Channel Access Token (long-lived) |
| `geminiApiKey` | Google Gemini API key |
| `adminApiKey` | คีย์สำหรับ Admin API (header `x-admin-key`) |
| `adminLineUserIds` | LINE userId ของแอดมิน (คั่นด้วย comma ตัวอย่าง `Uxxx,Uyyy`) |
| `googleServiceAccountKeyBase64` | เนื้อหา JSON ของ Service Account key แปลงเป็น base64 |
| `googleSheetsId` | Spreadsheet ID (ค่าหลัง `/d/` ใน URL ของ Sheet) |

ตั้ง secrets ด้วย Firebase CLI:

```bash
firebase login
firebase use <PROJECT_ID>

firebase apphosting:secrets:set lineChannelSecret
firebase apphosting:secrets:set lineChannelAccessToken
firebase apphosting:secrets:set geminiApiKey
firebase apphosting:secrets:set adminApiKey
firebase apphosting:secrets:set adminLineUserIds
firebase apphosting:secrets:set googleServiceAccountKeyBase64
firebase apphosting:secrets:set googleSheetsId
```

5. Trigger rollout โดย push เข้า `main` หรือกด Deploy ใน Firebase Console

## สิ่งที่จำเป็น

- Node.js 20+
- LINE Messaging API channel
- Google Gemini API Key
- Google Cloud Service Account (เปิดใช้ Google Sheets API) + Spreadsheet ที่มีแท็บ `index`, `slip`

## หมายเหตุการทำงาน

- **Rate limiting**: Webhook จำกัด 120 request ต่อ IP ต่อนาที (in-memory)
- **Retry**: การเรียก LINE API, Gemini, Google Sheets จะ retry อัตโนมัติเมื่อเกิด error ชั่วคราว (5xx, 429, network) สูงสุด 3 ครั้ง พร้อม exponential backoff
- **Logging**: ใช้ structured JSON log (level, message, userId, eventType, error) เพื่อให้ค้นใน Cloud Logging ง่าย
- **Default model**: `GEMINI_MODEL` ค่า default ใน config คือ `gemini-2.5-flash-lite` (สอดคล้องกับ apphosting.yaml)
