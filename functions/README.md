# Cloud Functions - Storage Cleanup

Cloud Functions สำหรับลบไฟล์เก่าใน Firebase Storage อัตโนมัติ

## 📋 Functions ที่มี

### 1. `cleanupOldStorageFiles` (Scheduled)
- **รันอัตโนมัติ**: ทุกวันที่ 1 ของเดือน เวลา 02:00 น. (เวลาไทย)
- **ทำงาน**: ลบไฟล์ที่เก่ากว่า 30 วันใน `camera-checks/` และ `cctv-reports/`
- **Schedule**: `0 2 1 * *` (Cron format)

### 2. `testCleanupStorage` (HTTP)
- **URL**: `https://asia-southeast1-jaihan-assistant.cloudfunctions.net/testCleanupStorage`
- **Method**: GET/POST
- **Header**: `x-admin-key: YOUR_ADMIN_API_KEY`
- **ทำงาน**: ทดสอบการลบไฟล์ (เรียกได้ทุกเมื่อ)

## 🚀 การติดตั้ง

### 1. ติดตั้ง dependencies

```bash
cd functions
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Deploy ไป Firebase

```bash
# Deploy ทั้งหมด
firebase deploy --only functions

# หรือ deploy เฉพาะ function
firebase deploy --only functions:cleanupOldStorageFiles
firebase deploy --only functions:testCleanupStorage
```

## 🧪 การทดสอบ

### ทดสอบ Local (Emulator)

```bash
cd functions
npm run serve
```

### ทดสอบผ่าน HTTP Function

```bash
curl -X POST "https://asia-southeast1-jaihan-assistant.cloudfunctions.net/testCleanupStorage" \
  -H "x-admin-key: YOUR_ADMIN_API_KEY"
```

## 📊 ดู Logs

```bash
# ดู logs ทั้งหมด
firebase functions:log

# ดู logs เฉพาะ function
firebase functions:log --only cleanupOldStorageFiles
```

หรือดูใน Firebase Console:
- Functions → Logs → เลือก function

## ⚙️ การตั้งค่า

### เปลี่ยนระยะเวลาลบไฟล์

แก้ไขใน `functions/src/index.ts`:

```typescript
// ลบไฟล์เก่ากว่า 30 วัน (ปัจจุบัน)
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

// เปลี่ยนเป็น 60 วัน
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 60);

// เปลี่ยนเป็น 7 วัน
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 7);
```

### เปลี่ยน Schedule

แก้ไข cron expression:

```typescript
// ทุกวันที่ 1 เวลา 02:00 (ปัจจุบัน)
.pubsub.schedule("0 2 1 * *")

// ทุกวันอาทิตย์ เวลา 03:00
.pubsub.schedule("0 3 * * 0")

// ทุกวัน เวลา 01:00
.pubsub.schedule("0 1 * * *")

// ทุก 6 ชั่วโมง
.pubsub.schedule("0 */6 * * *")
```

**Cron Format**: `นาที ชั่วโมง วันที่ เดือน วันในสัปดาห์`

## 💰 ค่าใช้จ่าย

**Spark Plan (Free):**
- Cloud Functions: 2M invocations/month
- Scheduled functions: รันฟรี

**Blaze Plan (Pay as you go):**
- $0.40 per million invocations
- รันเดือนละครั้ง = ฟรี

## 🔒 Security

- HTTP Function ต้องส่ง `x-admin-key` header
- Scheduled Function รันอัตโนมัติ (ไม่ต้องตรวจสอบสิทธิ์)
- ใช้ Firebase Admin SDK (มีสิทธิ์เต็ม)

## 📝 หมายเหตุ

- Function จะลบเฉพาะไฟล์ที่ **สร้างมากกว่า 30 วัน** (ไม่ใช่แก้ไข)
- ไฟล์ที่ลบแล้วกู้คืนไม่ได้
- ควรทดสอบด้วย `testCleanupStorage` ก่อน deploy
- ดู logs เป็นประจำเพื่อตรวจสอบการทำงาน

## 🐛 Troubleshooting

### Function ไม่ทำงาน

1. ตรวจสอบ logs: `firebase functions:log`
2. ตรวจสอบว่า deploy สำเร็จ
3. ตรวจสอบ IAM permissions ของ Service Account

### Permission Denied

ตรวจสอบว่า Service Account มีสิทธิ์:
- Firebase Console → Project Settings → Service Accounts
- ต้องมี role: `Firebase Admin SDK Administrator Service Agent`

### ไฟล์ไม่ถูกลบ

1. ตรวจสอบว่าไฟล์เก่ากว่า 30 วันจริง
2. ตรวจสอบ path ของไฟล์ (`camera-checks/` หรือ `cctv-reports/`)
3. ดู logs เพื่อดู error message
