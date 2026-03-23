# RAG (ถาม-ตอบจากคู่มือ) และฐานข้อมูลกำลังพล

เอกสารนี้สรุปการตั้งค่าและข้อควรรู้สำหรับ production

---

## 1. RAG คู่มือ (ถาม-ตอบจากเอกสาร)

### แหล่งที่มาคู่มือ

- **ค่าเริ่มต้น:** โปรเจกต์อ่านจากไฟล์ **`content/knowledge.md`** (เทียบกับ project root)
- แก้ไขคู่มือได้โดยแก้ไฟล์นี้ แล้ว deploy หรือ restart — **ไม่ต้องแก้ code**
- เนื้อหาจะถูก **cache ในหน่วยความจำ** หลังโหลดครั้งแรก (restart จึงโหลดใหม่)

### ตัวแปร environment

| ตัวแปร | ความหมาย |
|--------|----------|
| **RAG_KNOWLEDGE_PATH** | path ไฟล์เทียบกับ project root เช่น `content/knowledge.md` |
| | ถ้าว่าง = ใช้ `content/knowledge.md` |
| | ถ้าเป็น `inline` = ใช้เนื้อที่ฝังใน code (`lib/ragKnowledge.ts`) |

### โครงสร้างไฟล์คู่มือ

ใช้หัวข้อ **`## ชื่อหัวข้อ`** เพื่อแบ่งส่วน แต่ละส่วนจะถูกใช้เป็น "chunk" ในการค้น keyword แล้วส่งให้ Gemini

```markdown
## บัตรผ่านและค่าบริการ
ข้อความในส่วนนี้...

## วิธีส่งสลิป
ข้อความในส่วนนี้...
```

### การทดสอบ

- รันเทส: `npm run test -- --run lib/rag.test.ts`
- ฟังก์ชันที่เทส: `splitIntoChunks`, `scoreChunk`, `getRelevantChunks`

---

## 2. ฐานข้อมูลกำลังพล (Firestore)

### สิ่งที่ต้องทำก่อนใช้

1. **เปิดใช้ Firestore** ในโปรเจกต์ Firebase (Console → Firestore Database → Create database)
2. **ซิงก์ข้อมูลครั้งแรก:** รัน `npm run sync-personnel` (หรือเรียก `POST /api/admin/sync-personnel` พร้อม header `x-admin-key`)
3. ตั้ง **GOOGLE_SHEETS_ID** หรือ **GOOGLE_SHEETS_ID_PERSONNEL** ให้ชี้ไปที่ชีตที่มีแท็บ "รายชื่อกำลังพล", "index", "bank"
4. แชร์ชีตให้ Service Account (อีเมลจาก `client_email` ใน key)

### โครงสร้างแท็บในชีต

- **รายชื่อกำลังพล:** A=ยศ, B=ชื่อ, C=สกุล
- **index:** B=ยศ, C=ชื่อ, D=สกุล, K=เบอร์โทร
- **bank:** A=ยศ, B=ชื่อ, C=สกุล, D=ธนาคาร, E=เลขที่บัญชี

ถ้าโครงไม่ตรง แก้ใน `lib/personnelSheets.ts`

### การทดสอบ

- รันเทส: `npm run test -- --run lib/personnelDb.test.ts`
- ฟังก์ชันที่เทส: `personnelKey`

---

## 3. การจัดการข้อผิดพลาดและข้อจำกัด (Production)

- **จำกัดความยาวคำถาม:** สูงสุด 1,000 ตัวอักษร เกินจะตอบว่า "ข้อความยาวเกิน... กรุณาสั้นลง"
- **เมื่อ RAG/Gemini ผิดพลาด:** บอทจะตอบ "ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว..." และ log ผ่าน `logWebhookError`
- **Personnel ยังไม่มีข้อมูล:** ถ้า Firestore ยังไม่เคย sync หรือ collection ว่าง บอทจะ fallback ไปใช้ RAG คู่มือหรือแชททั่วไป

---

## 4. สรุป env ที่เกี่ยวข้อง

| ตัวแปร | ใช้กับ |
|--------|--------|
| RAG_KNOWLEDGE_PATH | RAG คู่มือ (path ไฟล์หรือ `inline`) |
| GOOGLE_SHEETS_ID | ชีตหลัก / ชีตกำลังพล (ถ้าไม่ตั้ง PERSONNEL) |
| GOOGLE_SHEETS_ID_PERSONNEL | ชีตฐานข้อมูลกำลังพลโดยเฉพาะ |
| GEMINI_API_KEY | ทุกฟีเจอร์ที่ใช้ Gemini (แชท, RAG, สลิป, กำลังพล) |
| GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 | อ่าน Sheets + เขียน Firestore |
