# Jaihan Assistant – Telegram Bot AI

บอท **Telegram** ใช้ Google Gemini เป็น AI ตอบคำถาม (RAG จากคู่มือ + ฐานข้อมูลกำลังพลบน Firestore) และจัดการสลิปโอนเงินกับ Google Sheets รองรับการ deploy บน Firebase App Hosting

## โครงสร้างโปรเจกต์

```
jaihan-assistant-linebot/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── sheets/tabs/        # Admin API (รายชื่อแท็บใน Spreadsheet)
│   │   │   └── sync-personnel/     # POST ซิงก์ Sheets → Firestore กำลังพล
│   │   └── ...
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── content/
│   └── knowledge.md                # คู่มือสำหรับ RAG (ถาม-ตอบจากเอกสาร)
├── lib/
│   ├── config.ts                   # Environment config (default GEMINI = gemini-2.5-flash-lite)
│   ├── retry.ts                    # Retry with backoff สำหรับ API ภายนอก
│   ├── rateLimit.ts                # Rate limit ต่อ IP ที่ Telegram webhook
│   ├── formatDateTime.ts           # รูปแบบวันที่ dd/mm/yyyy HH:mm:ss (Sheets, สลิป)
│   ├── logger.ts                   # Structured logging (JSON)
│   ├── gemini.ts                   # Gemini AI + อ่านสลิปจากรูป + RAG
│   ├── googleSheets.ts             # Google Sheets API
│   ├── passSheets.ts               # อ่าน/เขียน แท็บ index, slip
│   ├── paymentAllocation.ts        # logic allocate สลิป → index
│   ├── rag.ts                      # RAG คู่มือ (แบ่ง chunk, ค้น keyword)
│   ├── ragKnowledge.ts             # โหลดคู่มือจากไฟล์หรือ inline
│   ├── personnelDb.ts              # Firestore ฐานข้อมูลกำลังพล (personnel)
│   ├── personnelSheets.ts          # อ่านแท็บ รายชื่อกำลังพล, index, bank จาก Sheets
│   ├── firebaseAdmin.ts            # Firebase Admin (Auth, Realtime DB, Firestore)
│   └── telegram/
│       └── handleTelegram.ts       # รับข้อความ/รูป/callback จาก Telegram (คำสั่ง, สลิป, RAG, กำลังพล)
├── scripts/
│   └── sync-personnel.mjs         # รันซิงก์ Sheets → Firestore (เรียก API)
├── docs/
│   └── RAG-AND-PERSONNEL.md       # ตั้งค่า RAG + ฐานข้อมูลกำลังพล
├── .env.example
├── apphosting.yaml                 # Firebase App Hosting (ใช้ secret ไม่ hardcode ค่าลับ)
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
| `ADMIN_API_KEY` | ตั้งเอง | ล็อกแดชบอร์ด (fallback ถ้าไม่ใช้ Firebase Auth) |
| `ADMIN_FIREBASE_EMAILS` | (optional) | อีเมลที่เข้าแดชบอร์ดได้ คั่นด้วย comma (fallback ถ้าไม่ใช้ Realtime Database) |
| `ADMIN_FIREBASE_UIDS` | (optional) | Firebase UID ที่เข้าแดชบอร์ดได้ คั่นด้วย comma (fallback) |
| `FIREBASE_DATABASE_URL` | (optional) | URL ของ Realtime Database — ใช้ DB asia-southeast1 (Singapore): `https://jaihan-assistant.asia-southeast1.firebasedatabase.app` เก็บ allowlist อีเมล/UID สำหรับสิทธิ์แดชบอร์ด |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings | ใช้ Firebase Auth แทน admin key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | เช่น `xxx.firebaseapp.com` | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | เช่น `jaihan-assistant` | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | เช่น `1:xxx:web:xxx` | |
| `TELEGRAM_BOT_TOKEN` | BotFather | **จำเป็นสำหรับ Telegram** (ช่องทางหลัก) |
| `ADMIN_TELEGRAM_USER_IDS` | หลังรันบอท พิมพ์ `myid` ใน Telegram | รายการ Telegram userId ของแอดมิน (คั่นด้วย comma) |
| `TELEGRAM_DASHBOARD_URL` | (optional) | URL แดชบอร์ด สำหรับปุ่ม Menu ใน Telegram |
| `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` | Google Cloud Console (Service Account → สร้าง key JSON) | แปลงไฟล์ JSON เป็น base64 ใส่ตัวแปรนี้ |
| `GOOGLE_SHEETS_ID` | URL ของ Google Sheet (ค่าหลัง `/d/`) | Spreadsheet ที่มีแท็บ `index` และ `slip` |
| `GOOGLE_SHEETS_ID_PERSONNEL` | (optional) | ชีตฐานข้อมูลกำลังพล (แท็บ รายชื่อกำลังพล, index, bank). ถ้าไม่ตั้ง ใช้ `GOOGLE_SHEETS_ID` |
| `GEMINI_API_KEY` | Google AI Studio | แชท + อ่านสลิปจากรูป + RAG คู่มือ/กำลังพล |
| `GEMINI_MODEL` | (optional) | เช่น `gemini-2.0-flash`, `gemini-2.5-flash-lite` |
| `RAG_KNOWLEDGE_PATH` | (optional) | path ไฟล์คู่มือเทียบ project root เช่น `content/knowledge.md`. ว่างหรือ `inline` = ใช้เนื้อใน code |

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

### ชีตฐานข้อมูลกำลังพล (สำหรับ RAG ถาม-ตอบ)

ใช้ซิงก์ไปยัง **Firestore** collection `personnel` (รายชื่อ + เบอร์ + ธนาคาร/เลขบัญชี):

- **แท็บ `รายชื่อกำลังพล`**: A=ยศ, B=ชื่อ, C=สกุล (เป็นรายชื่อหลัก)
- **แท็บ `index`**: B,C,D=ยศ,ชื่อ,สกุล, K=เบอร์โทร
- **แท็บ `bank`**: A,B,C=ยศ,ชื่อ,สกุล, D=ธนาคาร, E=เลขที่บัญชี

ตั้ง `GOOGLE_SHEETS_ID_PERSONNEL` (หรือใช้ `GOOGLE_SHEETS_ID` ถ้าเป็นชีตเดียวกัน) แล้วรันซิงก์ครั้งแรก:

```bash
npm run dev   # เปิดเซิร์ฟเวอร์ก่อน
npm run sync-personnel
```

หรือเรียก `POST /api/admin/sync-personnel` (header `x-admin-key`). รายละเอียด: [docs/RAG-AND-PERSONNEL.md](docs/RAG-AND-PERSONNEL.md)

## คำสั่งแอดมิน (ใน Telegram)

ใช้ได้เฉพาะ userId ที่อยู่ใน `ADMIN_TELEGRAM_USER_IDS`

| คำสั่ง | ความหมาย |
|--------|----------|
| `help` / `เมนู` | แสดงรายการคำสั่ง |
| `myid` | แสดง Telegram userId (ใช้ตอนตั้งค่าแอดมิน) |
| `sync` | ซิงก์และคำนวณสถานะชำระจาก slip → index แล้วอัปเดต M,N,O |
| `review` | แสดงรายการที่ N ว่าง (รอตรวจ) เป็น Carousel มีปุ่มกำหนด N |
| `invalid` | แสดงรายการที่ N = ข้อมูลไม่ถูกต้อง (รูปแบบเดียวกับ review แต่ไม่มีปุ่ม) |
| `summary` / `สรุป` / `สรุปวันนี้` | สรุปจำนวนทั้งหมด, ยอดชำระแล้ว/ค้างชำระ (คิดเป็นบาท), ลบข้อมูล, และแยกจำนวนตามสถานะ N |

- **ส่งข้อความอื่น (ไม่ใช่คำสั่งด้านบน)** → บอทใช้ AI ตอบ:
  - ถ้าถามเกี่ยวกับ**กำลังพล** (เบอร์, ธนาคาร, บัญชี, รายชื่อ) → ตอบจาก **Firestore** ฐานข้อมูลกำลังพล (ต้องรัน sync ก่อน)
  - ถ้าไม่ → ตอบจาก **คู่มือ** (`content/knowledge.md`) ถ้ามีส่วนที่เกี่ยวข้อง
  - ถ้าไม่มีในคู่มือ → แชททั่วไปด้วย Gemini
- ส่ง**รูปภาพ** → บอทถามว่าเป็นรูปอะไร → เลือก "รูปสลิปโอนเงิน" จะอ่านสลิปด้วย Gemini แล้วบันทึกลง slip + allocate; เลือก "อื่นๆ" = ไม่บันทึก

### ตัวอย่างคำสั่ง (ใน Telegram)

**คำสั่งแอดมินตรงๆ**

| พิมพ์ | ผลลัพธ์ |
|-------|----------|
| `help` หรือ `เมนู` | แสดงรายการคำสั่งทั้งหมด |
| `myid` | แสดง Telegram userId ของคุณ |
| `sync` | ซิงก์ slip → index อัปเดตสถานะชำระเงิน |
| `review` | แสดงรายการรอตรวจ (N ว่าง) พร้อมปุ่ม |
| `invalid` | แสดงรายการที่ N = ข้อมูลไม่ถูกต้อง |
| `summary` หรือ `สรุป` | สรุปจำนวนรายการ ชำระแล้ว/ค้างชำระ/ลบ |

**ถามจากคู่มือ (RAG)**

| พิมพ์ | ผลลัพธ์ |
|-------|----------|
| `ค่าบัตรผ่านเท่าไหร่` | ตอบจากคู่มือ (30 บาทต่อรายการ) |
| `ส่งสลิปยังไง` | ตอบขั้นตอนจากคู่มือ |
| `สถานะชำระเงินหมายความว่าไร` | อธิบาย ค้างชำระ / ชำระเงินแล้ว ฯลฯ |

**ถามจากฐานข้อมูลกำลังพล**

| พิมพ์ | ผลลัพธ์ |
|-------|----------|
| `เบอร์ พ.ท. จักรพงษ์` | แสดงเบอร์โทร (ถ้ามีใน Firestore) |
| `ธนาคาร นิรุต ใสหยด` | แสดงธนาคารและเลขบัญชี (ถ้ามี) |
| `รายชื่อกำลังพลมีใครบ้าง` | สรุปจากรายชื่อที่ดึงได้ (ตามคำถาม) |

**สคริปต์ / API**

```bash
# ซิงก์ฐานข้อมูลกำลังพล (Sheets → Firestore)
npm run sync-personnel

# เรียก sync ผ่าน API (หลัง deploy)
curl -X POST "https://<your-domain>/api/admin/sync-personnel" -H "x-admin-key: YOUR_ADMIN_API_KEY"
```

## Telegram (ช่องทางหลัก)

- **Webhook**: Telegram ส่งอัปเดตมายัง `POST https://<your-domain>/api/telegram/webhook` (ตั้งใน BotFather → Bot Settings → Menu Button หรือใช้ Long Polling ตามที่ deploy กำหนด)
- **คำสั่ง**: เหมือนคำสั่งแอดมินด้านบนทั้งหมด (help, sync, review, invalid, summary, ถามเบอร์/ธนาคาร/คู่มือ)
- **ปุ่ม Menu / แดชบอร์ด**: ตั้ง `TELEGRAM_DASHBOARD_URL` แล้วเรียก `POST .../api/telegram/setup-menu?key=YOUR_ADMIN_KEY` จะมีปุ่มเปิดแดชบอร์ดใน Telegram
- **ดู Telegram userId**: ส่ง `myid` หรือ `/myid` ในแชทกับบอท แล้วนำค่าไปใส่ใน `ADMIN_TELEGRAM_USER_IDS`

## การทดสอบ

```bash
npm run test        # รัน unit tests (Vitest)
npm run test:watch  # รันแบบ watch
```

มี unit tests สำหรับ:
- `lib/paymentAllocation.ts` (allocateSlipToIndex)
- `lib/rag.test.ts` (splitIntoChunks, scoreChunk, getRelevantChunks)
- `lib/personnelDb.test.ts` (personnelKey)

## รันในเครื่อง

```bash
npm run dev
```

เปิด http://localhost:3000

## แดชบอร์ด (Web App)

มีหน้าเว็บสรุปข้อมูลแบบแดชบอร์ด แทนการส่งคำสั่งในบอท:

- **URL**: `/dashboard`
- **ข้อมูล**: ทั้งหมด, รอตรวจ, ชำระแล้ว, ค้างชำระ, ลบ/ไม่ถูกต้อง, กราฟสถานะการชำระ, สถานะ N, Top 5 ค้างชำระ
- **การเข้าถึง**:
  - **Firebase Auth** (แนะนำ): ตั้ง `NEXT_PUBLIC_FIREBASE_*` และ `ADMIN_FIREBASE_EMAILS` หรือ `ADMIN_FIREBASE_UIDS` → เข้าสู่ระบบด้วยอีเมล/รหัสผ่าน หรือ Google
  - **Admin Key**: ถ้าไม่ใช้ Firebase ต้องส่ง key ใน URL `/dashboard?key=YOUR_KEY` หรือกรอกในฟอร์ม

จากหน้าหลักมีลิงก์ "เปิดแดชบอร์ดสรุปข้อมูล" ไปยัง `/dashboard`

### สิทธิ์แดชบอร์ดกับ Realtime Database (แนะนำ)

แทนการใส่รายการอีเมลใน env สามารถใช้ **Firebase Realtime Database** เก็บ allowlist และกำหนดสิทธิ์ได้ (เพิ่ม/ลบคนได้จาก Firebase Console โดยไม่ต้อง redeploy)

1. สร้าง Realtime Database ในโปรเจกต์ (Firebase Console → Build → Realtime Database) แล้วคัดลอก **Database URL**
2. ตั้ง env `FIREBASE_DATABASE_URL` = URL ดังกล่าว (และใส่ใน App Hosting secrets ถ้า deploy)
3. ใน Realtime Database สร้างโครงสร้างดังนี้ (เพิ่มจาก Firebase Console หรือ Rules ด้านล่าง):

```
dashboardAdmins/
  emails/
    user_at_gmail_dot_com: true      ← อีเมล user@gmail.com (แทนที่ . เป็น _dot_ และ @ เป็น _at_)
    admin_at_company_dot_com: true
  uids/
    <Firebase UID>: true            ← หรือใช้ UID โดยตรง
```

- **emails**: key = อีเมลที่ encode แล้ว (ตัวเล็ก, `.` → `_dot_`, `@` → `_at_`) เช่น `you@gmail.com` → `you_at_gmail_dot_com`
- **uids**: key = Firebase Auth UID ของผู้ใช้
- ค่าเป็น `true` หรือ object เช่น `{ "role": "admin" }` ก็ได้

ลำดับการตรวจสิทธิ์: ระบบจะเช็ค **Realtime Database ก่อน** (ถ้ามี `FIREBASE_DATABASE_URL`) ถ้าอีเมลหรือ UID อยู่ใน allowlist ใน DB จะให้เข้าได้ ถ้าไม่พบหรือไม่มี DB จะ fallback ไปใช้ `ADMIN_FIREBASE_EMAILS` / `ADMIN_FIREBASE_UIDS` จาก env

**บันทึกผู้ล็อกอินอัตโนมัติ + จัดการสิทธิ์**

เมื่อมีใครล็อกอินด้วย Google (หรืออีเมล/รหัสผ่าน) ที่หน้าแดชบอร์ด ระบบจะบันทึกข้อมูลลง Realtime Database อัตโนมัติที่ path `users/{uid}` (email, displayName, photoURL, lastLoginAt) ดังนั้นคุณจะเห็นรายชื่อคนที่เคยล็อกอินใน Realtime Database → แท็บ **Data**

วิธีจัดการสิทธิ์:
1. เปิด Firebase Console → Realtime Database → แท็บ **Data**
2. ดูรายชื่อภายใต้ `users/` (แต่ละ key คือ UID มี email, lastLoginAt ฯลฯ)
3. ต้องการให้คนนั้นเข้าแดชบอร์ดได้ → ไปที่ `dashboardAdmins/uids/` กด **+** ใส่ **Name** = UID ของคนนั้น (คัดลอกจาก `users/`) **Value** = `true`
4. หรือใช้อีเมล: ไปที่ `dashboardAdmins/emails/` เพิ่ม key เป็นอีเมลที่ encode (เช่น `you_at_gmail_dot_com`) ค่า `true`

ไม่ต้อง redeploy แค่แก้ใน Console แล้วคนที่ถูกเพิ่มจะเข้าแดชบอร์ดได้ทันที

**กฎความปลอดภัย Realtime Database (ตัวอย่าง)** — ให้เฉพาะ server (Admin SDK) อ่านได้ หรือถ้าให้ client อ่านได้ต้องจำกัด path:

```json
{
  "rules": {
    "dashboardAdmins": {
      ".read": "false",
      ".write": "false"
    },
    "users": {
      ".read": "false",
      ".write": "false"
    }
  }
}
```

(Server ใช้ Admin SDK ไม่ถูกบังคับโดย rules ดังนั้น API ยังอ่าน/เขียนได้)

### ตั้งค่า Menu / ปุ่มแดชบอร์ด ใน Telegram

ตั้งค่า `TELEGRAM_DASHBOARD_URL` (เช่น `https://xxx.hosted.app/dashboard`) แล้วเรียก API เพื่อตั้งปุ่ม Menu:

```bash
curl -X POST "https://<your-domain>/api/telegram/setup-menu?key=YOUR_ADMIN_KEY"
```

หลังตั้งค่า ใน Telegram จะมีปุ่ม **Menu** เปิดแดชบอร์ด และคำสั่ง `/dashboard` พร้อมปุ่ม "📊 เปิดแดชบอร์ด" ใน /help

## Webhook

อัปเดตจาก Telegram ส่งมายัง `POST https://<your-domain>/api/telegram/webhook` (ตั้งใน BotFather หรือตามที่ hosting ใช้)

## Deploy บน Firebase App Hosting

1. Push โค้ดขึ้น GitHub
2. Firebase Console → **Build → App Hosting** → Create backend
3. เชื่อม GitHub (root = `/`, branch = `main`)
4. ตั้งค่า **secrets** ให้ตรงกับ `apphosting.yaml` (ค่าลับไม่เก็บใน repo):

| Secret name | ค่าที่ใส่ |
|-------------|-----------|
| `firebaseDatabaseUrl` | (optional) URL Realtime Database ถ้าใช้ allowlist จาก DB |
| `geminiApiKey` | Google Gemini API key |
| `adminApiKey` | คีย์สำหรับ Admin API (header `x-admin-key`) |
| `googleServiceAccountKeyBase64` | เนื้อหา JSON ของ Service Account key แปลงเป็น base64 (ใช้กับ Sheets + Firestore) |
| `googleSheetsId` | Spreadsheet ID (ค่าหลัง `/d/` ใน URL ของ Sheet) |
| (optional) `googleSheetsIdPersonnel` | ชีตฐานข้อมูลกำลังพล (รายชื่อ+index+bank) ถ้าไม่ตั้ง ใช้ `googleSheetsId` |
| (optional) `ragKnowledgePath` | path ไฟล์คู่มือ เช่น `content/knowledge.md` |

ตั้ง secrets ด้วย Firebase CLI:

```bash
firebase login
firebase use <PROJECT_ID>

firebase apphosting:secrets:set firebaseDatabaseUrl
firebase apphosting:secrets:set geminiApiKey
firebase apphosting:secrets:set adminApiKey
firebase apphosting:secrets:set adminTelegramUserIds
firebase apphosting:secrets:set telegramBotToken
firebase apphosting:secrets:set googleServiceAccountKeyBase64
firebase apphosting:secrets:set googleSheetsId
```

5. Trigger rollout โดย push เข้า `main` หรือกด Deploy ใน Firebase Console

### Deploy ไป Firebase Hosting (ใช้ config เดียวกัน → ได้ jaihan-assistant.web.app)

ใช้ **config ชุดเดียว** กับโปรเจกต์นี้ (Realtime Database, Auth, env เดิม) แต่ deploy ผ่าน Firebase Hosting เพื่อให้ได้ **jaihan-assistant.web.app** และ **jaihan-assistant.firebaseapp.com**:

1. คัดลอก `.env.local` เป็น `.env.jaihan-assistant` (หรือสร้างแล้วใส่ค่าตามตารางตัวแปร)
2. รัน `firebase experiments:enable webframeworks` (ครั้งเดียว)
3. รัน `firebase init hosting` ถ้ายังไม่เคย (เลือกใช้ web framework + Next.js)
4. รัน `firebase deploy` หรือ `firebase deploy --only hosting`

รายละเอียดเต็ม: [docs/FIREBASE-HOSTING-DEPLOY.md](docs/FIREBASE-HOSTING-DEPLOY.md)

### ทางเลือกอื่นสำหรับ .web.app

- **URL ปัจจุบัน**: App Hosting ให้ URL แบบ `https://jaihan-assistant--jaihan-assistant.asia-southeast1.hosted.app`
- **ใช้ Custom domain กับ App Hosting**: Firebase Console → App Hosting → Settings → Add custom domain (เช่น `dashboard.yourdomain.com`)

หลังตั้ง domain ใหม่แล้ว อย่าลืมอัปเดต `TELEGRAM_DASHBOARD_URL` ให้ชี้ไปที่ URL ที่ใช้จริง

## สิ่งที่จำเป็น

- Node.js 20+
- **Telegram Bot**: สร้างบอทจาก BotFather → ได้ `TELEGRAM_BOT_TOKEN` และตั้ง `ADMIN_TELEGRAM_USER_IDS`
- Google Gemini API Key
- Google Cloud Service Account (เปิดใช้ Google Sheets API) + Spreadsheet ที่มีแท็บ `index`, `slip`
- (ถ้าใช้ถาม-ตอบกำลังพล) **Firestore** เปิดใช้ในโปรเจกต์ + รัน `npm run sync-personnel` อย่างน้อยครั้งหนึ่ง

## หมายเหตุการทำงาน

- **Rate limiting**: Webhook จำกัด 120 request ต่อ IP ต่อนาที (in-memory)
- **Retry**: การเรียก Telegram, Gemini, Google Sheets จะ retry อัตโนมัติเมื่อเกิด error ชั่วคราว (5xx, 429, network) สูงสุด 3 ครั้ง พร้อม exponential backoff
- **Logging**: ใช้ structured JSON log (level, message, userId, eventType, error) เพื่อให้ค้นใน Cloud Logging ง่าย
- **Default model**: `GEMINI_MODEL` ค่า default ใน config คือ `gemini-2.5-flash-lite` (สอดคล้องกับ apphosting.yaml)
