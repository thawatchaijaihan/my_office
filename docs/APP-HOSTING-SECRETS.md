# สร้าง Secrets สำหรับ Firebase App Hosting

## firebaseDatabaseUrl (Realtime Database)

ใช้สำหรับตัวแปร `FIREBASE_DATABASE_URL` ให้แดชบอร์ดตรวจสิทธิ์จาก Realtime Database (allowlist อีเมล/UID)

### 1. หา URL ของ Realtime Database

- เปิด [Firebase Console](https://console.firebase.google.com/) → โปรเจกต์ **jaihan-assistant**
- Build → **Realtime Database** → เลือก instance **jaihan-assistant** (Singapore / asia-southeast1) → ดู URL ด้านบน (เช่น `https://jaihan-assistant.asia-southeast1.firebasedatabase.app`)

### 2. สร้าง secret และให้สิทธิ์ App Hosting

ในโฟลเดอร์โปรเจกต์ รัน (แทนที่ `YOUR_RTDB_URL` ด้วย URL จริง):

**PowerShell (Windows):**
```powershell
# สร้าง secret (ใส่ URL ของ Realtime Database)
"YOUR_RTDB_URL" | firebase apphosting:secrets:set firebaseDatabaseUrl

# ให้ App Hosting (backend) อ่าน secret ได้ (แทนที่ jaihan-assistant ด้วยชื่อ backend จริง)
firebase apphosting:secrets:grantaccess firebaseDatabaseUrl --backend jaihan-assistant
```

**Bash (macOS/Linux):**
```bash
echo -n "YOUR_RTDB_URL" | firebase apphosting:secrets:set firebaseDatabaseUrl
firebase apphosting:secrets:grantaccess firebaseDatabaseUrl --backend jaihan-assistant
```

### 3. ใช้ secret ใน build

ใน `apphosting.yaml` ใช้ `secret: firebaseDatabaseUrl` สำหรับ `FIREBASE_DATABASE_URL` อยู่แล้ว — หลังสร้าง secret และ grant access แล้ว push โค้ดจะ deploy ได้โดยดึง URL จาก secret

**ค่า URL ที่ใช้กับโปรเจกต์นี้ (DB asia-southeast1):**
```text
https://jaihan-assistant.asia-southeast1.firebasedatabase.app
```

### 4. ถ้าแดชบอร์ดขึ้น 500 / โหลดไม่ขึ้น

- ตรวจว่า **set secret `firebaseDatabaseUrl` แล้ว** และ grant access ให้ backend (ถ้าไม่ set แดชบอร์ดจะใช้ fallback จาก env; ถ้า env ก็ไม่มีอาจมีผลกับ auth)
- Service account ที่ใช้ (ใน `googleServiceAccountKeyBase64`) ต้องมีสิทธิ์ **Firebase Realtime Database Admin** ในโปรเจกต์ — ดู [docs/FIREBASE-RTDB-IAM.md](FIREBASE-RTDB-IAM.md)
- ใน Realtime Database ตัว **jaihan-assistant** (asia-southeast1) ต้องมี path `dashboardAdmins/emails` หรือ `dashboardAdmins/uids` ถ้าใช้ allowlist จาก DB (หรือตั้ง `ADMIN_FIREBASE_EMAILS` / `ADMIN_FIREBASE_UIDS` ใน env เป็น fallback)
- ดู Cloud Build / App Hosting logs เพื่อดูข้อความ error จริงจาก server

---

## googleServiceAccountKeyBase64 — ใช้ key ตรงกับไฟล์ JSON ในเครื่อง

App Hosting ใช้ **secret ชื่อ `googleServiceAccountKeyBase64`** (= ตัวแปร `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64`)  
ค่าที่ต้องใส่คือ **เนื้อหาทั้งหมดของไฟล์ Service Account JSON แปลงเป็น base64** (เช่น ไฟล์ `jaihan-assistant-90c28d13e839.json`)

- **จะตรงกับไฟล์นี้หรือไม่** ขึ้นกับว่าเวลาที่ set secret คุณใส่ base64 ของไฟล์นี้หรือเปล่า  
- ถ้าต้องการให้ App Hosting ใช้ key **ตรงกับไฟล์นี้** ให้ set secret ใหม่จากไฟล์นี้:

**PowerShell (Windows):**
```powershell
# แปลงไฟล์ JSON เป็น base64 แล้ว set เป็น secret (แทนที่ path ให้ตรงกับไฟล์คุณ)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("jaihan-assistant-90c28d13e839.json")) | firebase apphosting:secrets:set googleServiceAccountKeyBase64
```

**Bash (macOS/Linux):**
```bash
base64 -i jaihan-assistant-90c28d13e839.json | tr -d '\n' | firebase apphosting:secrets:set googleServiceAccountKeyBase64
```

จากนั้น **redeploy** (push โค้ดหรือกด Deploy ใน Console) เพื่อให้ backend ใช้ค่า secret ใหม่

---

## Secrets อื่นที่ใช้ในโปรเจกต์นี้

| Secret name | ใช้กับตัวแปร |
|-------------|----------------|
| geminiApiKey | GEMINI_API_KEY |
| adminApiKey | ADMIN_API_KEY |
| googleServiceAccountKeyBase64 | GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 (เนื้อหา JSON ทั้งไฟล์ แปลงเป็น base64) |
| googleSheetsId | GOOGLE_SHEETS_ID |
| adminTelegramUserIds | ADMIN_TELEGRAM_USER_IDS |
| telegramBotToken | TELEGRAM_BOT_TOKEN |
| firebaseDatabaseUrl | FIREBASE_DATABASE_URL (optional) |
