# แก้ปัญหา ล็อกอินไม่ได้

## 1. ขึ้นว่า auth/unauthorized-domain

**สาเหตุ:** โดเมนที่เปิดเว็บ (เช่น `localhost` หรือ URL ที่ deploy) ยังไม่อยู่ในรายการ Authorized domains ของ Firebase

**วิธีแก้:**
1. เปิด [Firebase Console](https://console.firebase.google.com/) → โปรเจกต์ **jaihan-assistant**
2. ไปที่ **Build** → **Authentication** → แท็บ **Settings**
3. เลื่อนไปส่วน **Authorized domains**
4. กด **Add domain** แล้วเพิ่ม:
   - รันในเครื่อง: `localhost`
   - Production: โดเมนจริง เช่น `jaihan-assistant--jaihan-assistant.asia-southeast1.hosted.app`
5. บันทึก แล้วลองล็อกอินอีกครั้ง

---

## 2. ล็อกอินด้วย Google ได้ แต่เข้าแดชบอร์ดแล้วขึ้น "ไม่มีสิทธิ์เข้าดูแดชบอร์ด"

**สาเหตุ:** อีเมลหรือ UID ของคุณยังไม่อยู่ใน allowlist

**วิธีแก้ (เลือกอย่างใดอย่างหนึ่ง):**

### ใช้ Realtime Database (แนะนำ)
1. เปิด Firebase Console → **Realtime Database** → แท็บ **Data**
2. ดูรายชื่อภายใต้ `users/` (คนที่เคยล็อกอินจะถูกบันทึกอัตโนมัติ)
3. คัดลอก **UID** ของคุณ แล้วไปที่ `dashboardAdmins/uids/` กด **+** ใส่ Name = UID, Value = `true`
4. หรือเพิ่มอีเมล: ไปที่ `dashboardAdmins/emails/` เพิ่ม key เป็นอีเมลที่ encode (เช่น `you_at_gmail_dot_com` สำหรับ you@gmail.com) ค่า `true`

### ใช้ตัวแปร env
ใน `.env.local` ตั้งค่า:
- `ADMIN_FIREBASE_EMAILS=your@gmail.com` (คั่นด้วย comma ถ้ามีหลายคน)
- หรือ `ADMIN_FIREBASE_UIDS=uidจากFirebase` (คั่นด้วย comma)

จากนั้นรีสตาร์ท dev server แล้วลองเข้าแดชบอร์ดอีกครั้ง

---

## 3. ป๊อปอัปล็อกอินไม่เปิด (popup blocked)

อนุญาตป๊อปอัปสำหรับไซต์นี้ในเบราว์เซอร์ แล้วกดล็อกอินอีกครั้ง
