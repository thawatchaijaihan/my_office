# Deploy ไป Firebase Hosting (jaihan-assistant.web.app)

ใช้โปรเจกต์และ config **เดียวกับ** โปรเจกต์นี้ (Realtime Database, Auth, env เดิม) แค่เพิ่มชุด deploy ไป Hosting เพื่อให้ได้ URL แบบ **jaihan-assistant.web.app** และ **jaihan-assistant.firebaseapp.com**

## สิ่งที่ใช้ร่วมกัน (ไม่ต้องสร้างใหม่)

- **Firebase project**: `jaihan-assistant` (จาก `.firebaserc`)
- **Realtime Database**: ใช้ DB asia-southeast1 (Singapore) — URL `https://jaihan-assistant.asia-southeast1.firebasedatabase.app` ใช้สำหรับ `users/` และ `dashboardAdmins/`
- **Authentication**: Google / อีเมล-รหัสผ่าน เดิม
- **Environment config**: ใช้ค่าชุดเดียวกับที่ใช้อยู่ (ดูด้านล่าง)

## ขั้นตอน deploy

### 1. ใช้ config ชุดเดียวกัน

เวลา deploy ผ่าน Firebase CLI โปรเจกต์ `jaihan-assistant` จะโหลด env จากไฟล์ **`.env.jaihan-assistant`** (ถ้ามี)

**วิธีที่ 1 – คัดลอกจาก .env.local (แนะนำ)**

```bash
# Windows (PowerShell)
Copy-Item .env.local .env.jaihan-assistant

# หรือ macOS/Linux
cp .env.local .env.jaihan-assistant
```

จากนั้นแก้เฉพาะค่าที่ต้องการ (เช่น `TELEGRAM_DASHBOARD_URL` ให้ชี้ไปที่ `https://jaihan-assistant.web.app/dashboard` ถ้าใช้ Hosting เป็นหลัก)

**วิธีที่ 2 – สร้างใหม่**

สร้างไฟล์ `.env.jaihan-assistant` แล้วใส่ตัวแปรเดียวกับใน README (ตารางตัวแปร environment) ให้ครบ เช่น:

- `TELEGRAM_BOT_TOKEN`, `ADMIN_TELEGRAM_USER_IDS`
- `GEMINI_API_KEY`, `GEMINI_MODEL`
- `ADMIN_API_KEY`
- `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64`
- `INDEX_SHEET_GID`, `SLIP_SHEET_GID`
- `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_DATABASE_URL` (URL ของ Realtime Database)
- อื่นๆ ตามที่แอปใช้

### 2. เปิดใช้ Web Frameworks (ครั้งเดียว)

```bash
firebase experiments:enable webframeworks
```

### 3. ตั้งค่า Hosting (ถ้ายังไม่เคย)

ถ้ายังไม่เคย `firebase init hosting`:

```bash
firebase init hosting
```

- เลือก **Use a web framework? (experimental)** → Yes  
- เลือก **Next.js**  
- ตั้ง **Public directory** เป็น `.` หรือตามที่ CLI แนะนำ  

ถ้ามี `firebase.json` อยู่แล้ว (มี `hosting.source`) ข้ามขั้นตอนนี้ได้

### 4. Deploy

```bash
firebase deploy
```

หรือ deploy เฉพาะ Hosting:

```bash
firebase deploy --only hosting
```

หลัง deploy สำเร็จ เปิดได้ที่:

- **https://jaihan-assistant.web.app**
- **https://jaihan-assistant.firebaseapp.com**

## หมายเหตุ

- **Billing**: ถ้าแอปใช้ SSR (รวม API routes) ต้องเปิด Billing (Blaze) เพราะใช้ Cloud Functions
- **Database / Auth**: ใช้ Realtime Database และ Auth ของโปรเจกต์ `jaihan-assistant` เหมือนเดิม ไม่ต้องสร้าง Database ชุดใหม่
- **App Hosting กับ Hosting**: ถ้าใช้ทั้ง App Hosting (ได้ `*.hosted.app`) และ Hosting (ได้ `.web.app`) จะมีสองชุด deploy; config แนะนำให้ใช้ env ชุดเดียวกัน (ผ่าน `.env.jaihan-assistant` สำหรับ Hosting)
