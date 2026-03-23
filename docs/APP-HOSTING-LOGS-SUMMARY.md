# สรุป log จาก App Hosting (ตรวจเมื่อ 8 ก.พ. 2026)

## สิ่งที่เห็นจาก log

### 1. Request ที่สำเร็จ
- **GET /api/dashboard** ถูกเรียก และ **verifyFirebaseToken ได้ user** (ตรวจสิทธิ์ผ่าน)
- **passSheets** อ่าน Sheet ได้ปกติ เช่น อ่านได้ **370 แถว** จาก `index!A2:O` ใช้เวลา ~430–570 ms
- แสดงว่า **การแชร์ Sheet ให้ Service Account ใช้ได้แล้ว** และการอ่าน Google Sheets บน App Hosting ทำงานได้

### 2. ERROR ที่เห็น = 504 Gateway Timeout
- Log ที่ severity ERROR ส่วนใหญ่เป็น **HTTP 504** จาก Cloud Run
- **latency = 300 วินาที** (5 นาที) → request ใช้เวลานานเกินไป Cloud Run จึงตัดและส่ง 504
- กระทบทั้ง **GET /api/dashboard** และ **POST /api/auth/record-user**
- **สาเหตุ:** ไม่ใช่ error จาก Sheet โดยตรง แต่เป็น **request ช้าเกินไป** (cold start หรือโหลดหนัก) จนเกินเวลาที่ Cloud Run กำหนด (300s)

### 3. บาง request ได้ 401
- มี log แบบ "ตรวจสอบสิทธิ์: ไม่ผ่าน (ส่ง 401)" = ไม่มี token หรือ token หมดอายุ/ไม่ถูกต้อง (เป็นไปได้ตามปกติ)

---

## สรุป
- **โหลดข้อมูลจาก Sheet ได้แล้ว** (มี log ที่อ่านได้ 370 แถว)
- ปัญหาที่เหลือคือ **request บางครั้งช้ามาก** จน client timeout (90–120s) หรือ gateway timeout (504 ที่ 300s)
- แนะนำ: กด "ลองใหม่" เมื่อโหลดไม่ทัน หรือตั้ง **minInstances: 1** ใน App Hosting ถ้าต้องการลด cold start (มีค่าใช้จ่ายเพิ่ม)
