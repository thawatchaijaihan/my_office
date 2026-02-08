# สร้าง Secrets สำหรับ Firebase App Hosting

## firebaseDatabaseUrl (Realtime Database)

ใช้สำหรับตัวแปร `FIREBASE_DATABASE_URL` ให้แดชบอร์ดตรวจสิทธิ์จาก Realtime Database (allowlist อีเมล/UID)

### 1. หา URL ของ Realtime Database

- เปิด [Firebase Console](https://console.firebase.google.com/) → โปรเจกต์ **jaihan-assistant**
- Build → **Realtime Database** → ดู URL ด้านบน (เช่น `https://jaihan-assistant-default-rtdb.asia-southeast1.firebasedatabase.app`)

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

---

## Secrets อื่นที่ใช้ในโปรเจกต์นี้

| Secret name | ใช้กับตัวแปร |
|-------------|----------------|
| lineChannelSecret | LINE_CHANNEL_SECRET |
| lineChannelAccessToken | LINE_CHANNEL_ACCESS_TOKEN |
| geminiApiKey | GEMINI_API_KEY |
| adminApiKey | ADMIN_API_KEY |
| adminLineUserIds | ADMIN_LINE_USER_IDS |
| googleServiceAccountKeyBase64 | GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 |
| googleSheetsId | GOOGLE_SHEETS_ID |
| adminTelegramUserIds | ADMIN_TELEGRAM_USER_IDS |
| telegramBotToken | TELEGRAM_BOT_TOKEN |
| firebaseDatabaseUrl | FIREBASE_DATABASE_URL (optional) |
