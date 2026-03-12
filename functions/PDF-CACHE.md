# PDF Cache System - Cloud Functions

ระบบ cache รูปภาพและ pre-generate PDF เพื่อลดเวลาในการสร้าง PDF

## 🎯 ปัญหาที่แก้ไข

**ปัจจุบัน:**
- สร้าง PDF ใช้เวลานาน (30-60 วินาที)
- ต้องโหลดรูปทุกครั้งที่สร้าง PDF
- ใช้ localStorage (จำกัด 5-10 MB)
- Cache หายเมื่อเคลียร์ browser

**หลังใช้ Cloud Functions:**
- PDF ถูกสร้างล่วงหน้าอัตโนมัติ
- รูปภาพถูก cache ใน Storage
- Metadata เก็บใน Realtime Database
- ลดเวลาสร้าง PDF เหลือ 2-5 วินาที

## 📦 Functions ที่สร้าง

### 1. **onCameraImageUpload** (Storage Trigger)
- **Trigger**: เมื่อมีการอัปโหลดรูปใน `camera-checks/`
- **ทำงาน**:
  - อัปเดต metadata ใน Realtime Database
  - Mark PDF เป็น outdated
  - Schedule PDF regeneration

### 2. **checkPdfRegeneration** (Scheduled - ทุก 1 นาที)
- **ทำงาน**:
  - ตรวจสอบว่ามี PDF ที่ต้อง regenerate
  - Debounce 5 วินาที (รอให้อัปโหลดรูปเสร็จทั้งหมด)
  - เรียก `generatePdfReport()`

### 3. **generatePdf** (HTTP)
- **URL**: `https://asia-southeast1-jaihan-assistant.cloudfunctions.net/generatePdf`
- **Method**: GET/POST
- **ทำงาน**: สร้าง PDF แบบ manual

### 4. **optimizeImage** (HTTP)
- **URL**: `https://asia-southeast1-jaihan-assistant.cloudfunctions.net/optimizeImage`
- **Method**: POST
- **Body**: `{ "imageUrl": "..." }`
- **ทำงาน**: Optimize รูปภาพ (resize, compress)

### 5. **getPdfMetadata** (HTTP)
- **URL**: `https://asia-southeast1-jaihan-assistant.cloudfunctions.net/getPdfMetadata`
- **Method**: GET
- **ทำงาน**: ดึง metadata ของ PDF ล่าสุด

## 🔄 Flow การทำงาน

### การอัปโหลดรูปใหม่

```
1. User อัปโหลดรูป → Storage (camera-checks/{cameraId}/latest.jpg)
2. onCameraImageUpload trigger
3. อัปเดต Realtime Database:
   - cameras/{cameraId}/lastCheckedImage
   - cameras/{cameraId}/lastCheckedAt
   - cctvReport/outdated = true
4. Schedule PDF regeneration
5. checkPdfRegeneration (รันทุก 1 นาที)
6. รอ 5 วินาที (debounce)
7. สร้าง PDF ใหม่
8. อัปโหลด PDF → Storage (cctv-reports/latest-{timestamp}.pdf)
9. อัปเดต cctvReport/url
```

### การดาวน์โหลด PDF

```
1. Client เรียก getPdfMetadata
2. ตรวจสอบ outdated flag
3. ถ้า outdated = false → ใช้ URL เดิม
4. ถ้า outdated = true → รอ regeneration หรือเรียก generatePdf
```

## 🗄️ Database Structure

```
Realtime Database:
├── cameras/
│   └── {cameraId}/
│       ├── name
│       ├── type
│       ├── lastCheckedImage (URL)
│       ├── lastCheckedImagePath
│       ├── lastCheckedAt
│       └── imageProcessed
├── cctvReport/
│   ├── url (PDF URL)
│   ├── outdated (boolean)
│   ├── lastGenerated
│   └── metadata/
│       ├── generatedAt
│       ├── cameraCount
│       └── cameras[]
└── pdfGeneration/
    └── scheduled/
        ├── scheduledAt
        ├── status (pending/generating/completed/failed)
        └── completedAt
```

## 🚀 การใช้งาน

### 1. Deploy Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### 2. เรียกใช้จาก Client

```typescript
// ตรวจสอบ PDF metadata
const response = await fetch(
  'https://asia-southeast1-jaihan-assistant.cloudfunctions.net/getPdfMetadata'
);
const data = await response.json();

if (data.outdated) {
  // PDF กำลังถูกสร้าง รอสักครู่
  console.log('PDF is being regenerated...');
} else {
  // ใช้ PDF ที่มีอยู่
  window.open(data.url);
}
```

```typescript
// สร้าง PDF แบบ manual
const response = await fetch(
  'https://asia-southeast1-jaihan-assistant.cloudfunctions.net/generatePdf',
  { method: 'POST' }
);
const data = await response.json();
console.log('PDF URL:', data.pdfUrl);
```

### 3. อัปเดต Client Code

แก้ไข `usePdfReport.ts`:

```typescript
// เพิ่มการเช็ค metadata ก่อนสร้าง PDF
const checkPdfStatus = async () => {
  const response = await fetch(
    'https://asia-southeast1-jaihan-assistant.cloudfunctions.net/getPdfMetadata'
  );
  const data = await response.json();
  
  if (!data.outdated && data.url) {
    // ใช้ PDF ที่มีอยู่
    return data.url;
  }
  
  // ต้องสร้างใหม่
  return null;
};
```

## ⚡ Performance

**ก่อนใช้ Cloud Functions:**
- เวลาสร้าง PDF: 30-60 วินาที
- โหลดรูป: 20-40 วินาที
- สร้าง PDF: 10-20 วินาที

**หลังใช้ Cloud Functions:**
- เวลาดาวน์โหลด PDF: 2-5 วินาที
- PDF ถูกสร้างล่วงหน้าอัตโนมัติ
- ไม่ต้องรอโหลดรูป

## 💰 ค่าใช้จ่าย

**Free Tier (Spark Plan):**
- Cloud Functions: 2M invocations/month
- Storage: 5 GB
- Realtime Database: 1 GB storage, 10 GB/month download

**ประมาณการ:**
- อัปโหลดรูป 100 ครั้ง/วัน = 3,000 invocations/month
- สร้าง PDF 10 ครั้ง/วัน = 300 invocations/month
- **รวม: ~3,300 invocations/month (ฟรี)**

## 🔧 การปรับแต่ง

### เปลี่ยน Debounce Time

แก้ไขใน `pdfCache.ts`:

```typescript
// รอ 5 วินาที (ปัจจุบัน)
if (elapsed < 5000) {

// เปลี่ยนเป็น 10 วินาที
if (elapsed < 10000) {
```

### เปลี่ยน Schedule Frequency

```typescript
// ทุก 1 นาที (ปัจจุบัน)
.pubsub.schedule("every 1 minutes")

// ทุก 5 นาที
.pubsub.schedule("every 5 minutes")

// ทุก 30 วินาที
.pubsub.schedule("every 30 seconds")
```

## 🐛 Troubleshooting

### PDF ไม่ถูกสร้างอัตโนมัติ

1. ตรวจสอบ logs: `firebase functions:log --only checkPdfRegeneration`
2. ตรวจสอบ `pdfGeneration/scheduled` ใน Realtime Database
3. เรียก `generatePdf` แบบ manual

### รูปภาพไม่โหลด

1. ตรวจสอบ Storage Rules
2. ตรวจสอบ CORS settings
3. ใช้ `optimizeImage` function

### Function timeout

1. เพิ่ม timeout: `functions.runWith({ timeoutSeconds: 540 })`
2. เพิ่ม memory: `functions.runWith({ memory: "1GB" })`

## 📝 TODO

- [ ] ใช้ Puppeteer สำหรับสร้าง PDF จริง (ต้อง 2nd gen functions)
- [ ] เพิ่ม image optimization ด้วย Sharp
- [ ] เพิ่ม retry mechanism
- [ ] เพิ่ม notification เมื่อ PDF พร้อม
- [ ] เพิ่ม versioning สำหรับ PDF
- [ ] เพิ่ม compression สำหรับ PDF

## 🔗 Links

- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [Storage Triggers](https://firebase.google.com/docs/functions/gcp-storage-events)
- [Scheduled Functions](https://firebase.google.com/docs/functions/schedule-functions)
