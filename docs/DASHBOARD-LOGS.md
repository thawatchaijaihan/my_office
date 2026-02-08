# ตรวจ log แดชบอร์ด — โหลดช้า / timeout เกิดจากอะไร

## จาก log ที่คุณส่งมา (เปิดจาก Telegram)

- **Timeout หลัง 60 วินาที** → ถ้า deploy ล่าสุดแล้วควรเป็น 90 วินาที ถ้ายังเห็น 60 = ใช้ build เก่าหรือ cache ลอง hard refresh / ลบ cache
- **3c. Timeout! เรียก abort()** และ **รวมใช้เวลา 60008 ms** → request ไป `/api/dashboard` ไม่กลับภายในเวลา = ฝั่งเซิร์ฟเวอร์ช้ามาก (cold start หรืออ่าน Sheets ช้า) ต้องดู log เซิร์ฟเวอร์ว่า step ไหนค้าง
- **record-user 500** → ปรับแล้ว: ถ้า Realtime DB ไม่พร้อมจะคืน 200 `{ ok: false }` แทน 503 และมี try/catch ไม่ให้ throw เป็น 500
- **pending-check 500 / review 504** → API เหล่านี้รอผลจากเซิร์ฟเวอร์เหมือนกัน ถ้า cold start หรือ Sheets ช้า จะ error ได้ แก้ที่ต้นทางคือให้ request แรก (cold start) จบให้ทัน หรือดู log เซิร์ฟเวอร์ว่า error อะไร
- **Cross-Origin-Opener-Policy (COOP)** → เป็น warning จาก Firebase/ป๊อปอัป ไม่กระทบการโหลดแดชบอร์ดใน WebView (ดูรายละเอียดหัวข้อ "COOP warnings" ด้านล่าง)

## ดู log ที่ไหน

| ที่ | ดูอย่างไร |
|-----|------------|
| **ฝั่งเบราว์เซอร์ (ลูกค้า)** | เปิด DevTools (F12) → แท็บ **Console** → เปิดแดชบอร์ดหรือกด "ลองใหม่" |
| **ฝั่งเซิร์ฟเวอร์ (API)** | เทอร์มินัลที่รัน `npm run dev` หรือ log ของ hosting (Firebase App Hosting → Rollout → Logs) |

---

## ลำดับ log ที่ควรเห็น (เมื่อโหลดสำเร็จ)

### 1. เบราว์เซอร์ (Console)

```
[Dashboard] 1. Component mounted on client
[Dashboard] 3. mounted = true → เริ่มโหลด API
[Dashboard] 3a. getAuthHeaders ใช้เวลา XX ms (มี Bearer)
[Dashboard] 3b. URL: /api/dashboard | Timeout หลัง 120 วินาที
[Dashboard] 3d. ส่ง fetch ไป /api/dashboard
[Dashboard] 4. ได้ response: 200 OK | รอ API XXXX ms | รวมตั้งแต่โหลด XXXX ms
[Dashboard] 5. Parse JSON สำเร็จ → มี summary.total = ...
[Dashboard] 6. finally → setLoading(false), รวมใช้เวลา XXXX ms
[Dashboard] render: แสดงแดชบอร์ด (ข้อมูลโหลดสำเร็จ, total: ...)
```

- **3a** ถ้า `getAuthHeaders ใช้เวลา` สูง = การดึง Firebase token ฝั่ง client ช้า
- **4** `รอ API X ms` = เวลาที่รอเซิร์ฟเวอร์ตอบ (ถ้าสูงมาก = ช้าที่เซิร์ฟเวอร์หรือเครือข่าย)
- ถ้า **โหลดช้า/ timeout** จะเห็น `3c. ⏱️ Timeout! เรียก abort()` แล้วตามด้วย `5a. ❌ Error: AbortError ...`  
  → ต้องไปดูฝั่งเซิร์ฟเวอร์ว่า step ไหนช้า

### 2. เซิร์ฟเวอร์ (เทอร์มินัล / Cloud Logging)

```
[Dashboard API] GET /api/dashboard ถูกเรียก +0ms
[Firebase Admin] init (default app) ใช้เวลา XX ms     ← เฉพาะครั้งแรก (cold start)
[Firebase Admin] init (realtime-db app) ใช้เวลา XX ms ← เฉพาะครั้งแรก ถ้าใช้ RTDB
[dashboardAuth] verifyFirebaseToken ใช้เวลา XX ms ได้ user / ไม่ผ่าน
[dashboardAuth] isEmailAllowedInDb ใช้เวลา XX ms, ผล: true/false
[dashboardAuth] isUidAllowedInDb ใช้เวลา XX ms, ผล: true/false
[dashboardAuth] ตรวจสิทธิ์รวม (token+email+uid): XX ms
[Dashboard API] ตรวจสอบสิทธิ์: ผ่าน ใช้เวลา XX ms +XXXms
```

จากนั้นเป็นหนึ่งในสองแบบ:

**กรณีมี cache (โหลดเร็ว):**
```
[Dashboard API] ใช้ cache (อายุ X วินาที) → ส่งข้อมูลทันที | รวม XXX ms (auth: Y ms, cache: hit) +XXXms
```

**กรณีไม่มี cache (ต้องอ่าน Google Sheets):**
```
[Dashboard API] ไม่มี cache / cache หมดอายุ → เริ่มอ่าน Google Sheets +XXXms
[passSheets] readIndexRows เริ่ม
[passSheets] listSpreadsheetTabs เสร็จ ได้ N แท็บ ใช้เวลา XX ms   ← ถ้าใช้ gid (ครั้งแรก)
[passSheets] resolveSheetName เสร็จ แท็บ: index ใช้เวลา XX ms
[passSheets] readValues เริ่ม range: index!A2:O
[passSheets] readValues เสร็จ ได้ N แถว ใช้เวลา XX ms | readIndexRows รวม XX ms
[Dashboard API] readIndexRows() คืนมา N แถว
[Dashboard API] อ่าน Sheets เสร็จ | แยกรอบ: auth X ms, sheets Y ms | รวม Z ms, แถว: N +Zms
```

---

## สรุปว่า “ช้า” เกิดจากขั้นตอนไหน

ดูที่ **เวลาที่พิมพ์ใน log** (ตัวเลข ms และ `+Xms` ใน API):

| สาเหตุที่มักเจอ | log ที่ดู | อาการ |
|-----------------|-----------|--------|
| **Cold start** | `GET /api/dashboard ถูกเรียก +0ms` ถึงบรรทัดถัดไป หรือ `[Firebase Admin] init ... ใช้เวลา X ms` | ระยะห่างยาว = backend เพิ่งตื่น |
| **ดึง token ฝั่ง client ช้า** | เบราว์เซอร์: `3a. getAuthHeaders ใช้เวลา X ms` | X สูง = getIdToken() ช้า |
| **ตรวจสิทธิ์ช้า** | `[dashboardAuth] verifyFirebaseToken` / `isEmailAllowedInDb` / `isUidAllowedInDb` / `ตรวจสิทธิ์รวม` | ms สูง = Firebase หรือ Realtime DB ช้า |
| **ดึงชื่อแท็บ / อ่าน Sheets ช้า** | `[passSheets] listSpreadsheetTabs` และ `readValues เสร็จ ... ใช้เวลา` | ms สูง = Google Sheets API ช้า |
| **แยกรอบใน API** | `[Dashboard API] ... แยกรอบ: auth X ms, sheets Y ms \| รวม Z ms` | ดู X vs Y ว่าใครมาก |
| **Timeout ฝั่งเบราว์เซอร์** | เบราว์เซอร์: `3c. ⏱️ Timeout! เรียก abort()` | Request ยังไม่กลับภายในเวลาที่ตั้ง |

---

## COOP warnings (window.closed / window.close)

ใน Console อาจเห็น:

```
Cross-Origin-Opener-Policy policy would block the window.closed call.
Cross-Origin-Opener-Policy policy would block the window.close call.
```

- มาจาก **Firebase Auth** ตอนใช้ป๊อปอัปล็อกอิน (หรือตอนโหลดสคริปต์ที่เตรียมไว้)
- โปรเจกต์นี้ตั้งค่า COOP เป็น `same-origin-allow-popups` อยู่แล้ว (`next.config.mjs`) เพื่อให้ป๊อปอัปล็อกอินทำงานได้
- ใน Telegram WebView ถ้าล็อกอินไว้แล้ว (มี Bearer) จะไม่มีการเปิดป๊อปอัป → warning ไม่กระทบการโหลดแดชบอร์ด
- **ไม่ต้องแก้** — เป็นแค่ warning ไม่ใช่ error

---

## ถ้าเปิดจาก Telegram แล้วโหลดช้า

1. ดู **เทอร์มินัล / Cloud Logging** ว่ามี `GET /api/dashboard ถูกเรียก` เมื่อไหร่  
   - ถ้าหลังกดเปิดแดชบอร์ดนานมากถึงมี log = มีโอกาสเป็น **cold start** (instance ยังไม่รัน)
2. ดูเวลาของ `ตรวจสอบสิทธิ์ ... ใช้เวลา X ms` และ `อ่าน Sheets เสร็จ ใช้เวลา X ms`  
   - ตัวไหนมาก = จุดนั้นเป็นจุดช้า
3. ฝั่งเบราว์เซอร์: ถ้าเห็น `Timeout! เรียก abort()` = เซิร์ฟเวอร์ยังไม่ตอบภายในเวลา (ตอนนี้ 120 วินาทีเมื่อเปิดจาก Telegram)  
   - **กด "ลองใหม่"** — request รอบสองมักเร็วขึ้นเพราะ instance ร้อนแล้ว  
4. **ลด cold start (ถ้าพร้อมจ่ายค่าโฮสต์มากขึ้น):** ใน Firebase App Hosting ตั้ง `minInstances: 1` ใน `apphosting.yaml` หรือใน Console เพื่อให้มี instance รันค้างไว้ แรกโหลดจะไม่รอนาน (มีค่าใช้จ่ายเพิ่ม)
