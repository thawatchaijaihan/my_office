# แก้ปัญหา โหลดข้อมูลจาก Google Sheet ไม่ได้

## 1. แชร์ Sheet กับ Service Account (สาเหตุที่เจอบ่อย)

Bot/แดชบอร์ดใช้ **Service Account** ในการเข้าถึง Google Sheet ดังนั้น Sheet ต้อง **แชร์ให้อีเมลของ Service Account** ด้วย

### ขั้นตอน

1. **หาอีเมลของ Service Account**
   - เปิดไฟล์ JSON ของ Service Account (เช่น `jaihan-assistant-90c28d13e839.json`)
   - ดูฟิลด์ **`client_email`** (รูปแบบประมาณ `xxx@jaihan-assistant.iam.gserviceaccount.com`)

2. **แชร์ Google Sheet**
   - เปิด Google Sheet ที่ใช้กับบอท
   - กด **แชร์ (Share)**
   - ในช่อง "เพิ่มผู้ใช้และกลุ่ม" ใส่ **อีเมลจาก `client_email`**
   - ตั้งสิทธิ์เป็น **ผู้ดู (Viewer)** หรือ **ผู้แก้ไข (Editor)** ถ้าบอทต้องเขียนข้อมูล (slip, อัปเดต index)
   - กด **ส่ง**

3. รอสักครู่แล้วลองโหลดแดชบอร์ดหรือใช้บอทอีกครั้ง

---

## 2. ตรวจ GOOGLE_SHEETS_ID

- **GOOGLE_SHEETS_ID** = ค่าที่อยู่หลัง `/d/` ใน URL ของ Google Sheet  
  ตัวอย่าง URL: `https://docs.google.com/spreadsheets/d/1abc...xyz/edit`  
  → **GOOGLE_SHEETS_ID** = `1abc...xyz`

- ตรวจใน `.env.local` หรือใน Firebase App Hosting secret **googleSheetsId** ว่าค่าตรงกับ Sheet ที่แชร์ให้ Service Account แล้ว

---

## 3. ตรวจแท็บ index / slip และ GID (ถ้าใช้)

- Sheet ต้องมีแท็บชื่อ **index** และ **slip** (หรือใช้ GID กำหนด)

- ถ้าใน env ตั้ง **INDEX_SHEET_GID** / **SLIP_SHEET_GID** ไว้ ต้องตรงกับ Sheet จริง  
  - ดู GID ได้จาก URL ของแท็บ (ส่วน `gid=เลข`) หรือจาก API

- ถ้า**ไม่ตั้ง GID** ระบบจะใช้ชื่อแท็บ **index** และ **slip** ตามลำดับ

---

## 4. ดู log เซิร์ฟเวอร์

เมื่อโหลดไม่สำเร็จ ดู log (เทอร์มินัลที่รัน `npm run dev` หรือ Firebase App Hosting → Logs) จะมีข้อความประมาณ:

- `GOOGLE_SHEETS_ID is not set` → ยังไม่ตั้งตัวแปร
- `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is not set` / `Invalid base64` → ยังไม่ตั้ง key หรือ format ผิด
- `403` / `The caller does not have permission` → **ยังไม่ได้แชร์ Sheet ให้ Service Account** (ทำข้อ 1)
- `404` / `Unable to parse range` → Sheet ID ผิด หรือชื่อแท็บ/range ผิด
- `Sheet with gid=... not found` → GID ไม่ตรงกับแท็บใน Sheet

---

## 5. บน App Hosting โหลดไม่ได้ แต่ run dev ได้

- ตรวจว่า secret **googleSheetsId** บน App Hosting = ค่า **GOOGLE_SHEETS_ID** (ค่าหลัง `/d/` ใน URL ของ Google Sheet)  
  ตั้ง/แก้: `firebase apphosting:secrets:set googleSheetsId` แล้วใส่ Spreadsheet ID
- ตรวจ **googleServiceAccountKeyBase64** ว่าเป็น base64 ของ JSON ตัวที่แชร์ Sheet ให้แล้ว (อีเมล `firebase-app-hosting-compute@jaihan-assistant.iam.gserviceaccount.com`)
- บนแดชบอร์ด (hosted): หลังโหลดเกิน 6 วินาที จะมีปุ่ม **"ตรวจสอบการเชื่อมต่อ Sheet"** กดเพื่อดูผลว่าเชื่อมต่อได้หรือ error อะไร

## 6. สรุปเช็คลิสต์

- [ ] แชร์ Google Sheet ให้อีเมลใน `client_email` ของไฟล์ JSON (หรือของ secret ที่ใช้บน App Hosting)
- [ ] ตั้ง GOOGLE_SHEETS_ID / secret **googleSheetsId** ให้ตรงกับ Sheet นั้น
- [ ] ถ้าใช้ GID ตรวจ INDEX_SHEET_GID / SLIP_SHEET_GID ว่าตรงกับแท็บจริง
- [ ] บน App Hosting: secret **googleServiceAccountKeyBase64** ใส่ base64 ของ JSON ตัวที่แชร์ Sheet ให้แล้ว
