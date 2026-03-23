# Firebase Realtime Database – IAM และ Security Rules

## 1. Security Rules (กฎ Realtime Database)

ใน Firebase Console → Realtime Database → เลือก DB `jaihan-assistant` (asia-southeast1) → แท็บ **Rules** ถ้ากฎเป็น `".read": false, ".write": false` ทั้งหมด จะล็อกการเข้าถึงจาก client; **การเข้าจาก backend ใช้ Admin SDK จึงยังอ่าน/เขียนได้อยู่**

ถ้าต้องการปลดล็อกและตั้งกฎให้ปลอดภัย (เผื่อใช้จาก client ภายหลัง):

1. กด **Dismiss** ที่แบนเนอร์ "Default security rules are locked" (หรือ Learn more แล้วทำตามขั้นตอนปลดล็อก)
2. ใช้กฎจากไฟล์ในโปรเจกต์: **`firebase-realtime-db-rules.json`**  
   - คัดลอกเนื้อหาในไฟล์ไปวางใน Rules editor แล้วกด **Publish**

กฎนี้จะ:

- ปิด read/write ทั้งต้นทาง (`.read: false`, `.write: false`)
- อนุญาตเฉพาะ path `dashboardPreferences/{uid}/review` โดยให้เฉพาะผู้ใช้ที่ล็อกอิน (Firebase Auth) อ่าน/เขียนได้เฉพาะของตัวเอง (`auth.uid == $uid`)

path อื่น (เช่น `dashboardAdmins`, `users`) ใช้เฉพาะจาก backend (Admin SDK) ไม่เปิดให้ client ดังนั้นไม่ต้องเพิ่ม rule ให้ path เหล่านั้น

---

## 2. ให้ Service Account เข้า Realtime Database ได้ (IAM)

ถ้าเทอร์มินัลขึ้น warning:

```text
Provided authentication credentials for the app named "realtime-db" are invalid.
Make sure the "credential" property provided to initializeApp() is authorized to access the specified "databaseURL" and is from the correct project.
```

แปลว่า **service account ที่ใช้ยังไม่มีสิทธิ์เข้า Realtime Database** ต้องเพิ่มบทบาทใน Google Cloud IAM

## ขั้นตอน

1. **ดูอีเมลของ service account**
   - เปิด `.env.local` → ตัวแปร `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64`
   - decode base64 เป็น JSON (หรือดูใน Firebase Console → Project settings → Service accounts)
   - ใน JSON มีฟิลด์ `client_email` เช่น  
     `linebot-sheets-reader@jaihan-assistant.iam.gserviceaccount.com`

2. **เปิด IAM**
   - ไปที่ [Google Cloud Console → IAM](https://console.cloud.google.com/iam-admin/iam?project=jaihan-assistant)  
   - หรือ Firebase Console → Project settings → Users and permissions → เลือกโปรเจกต์

3. **เพิ่มบทบาทให้ service account**
   - กด **Grant access** (หรือแก้ principal ที่เป็นอีเมลด้านบน)
   - **Principal:** ใส่ `client_email` จากข้อ 1
   - **Role:** เลือก **Firebase Realtime Database Admin**  
     (หรือถ้าไม่มีในรายการ ให้เลือก **Cloud Editor** ชั่วคราว หรือเพิ่ม role `roles/firebasedatabase.admin` ผ่าน gcloud)
   - Save

4. **รอ 1–2 นาที** แล้วรีสตาร์ท dev server แล้วลองล็อกอินแดชบอร์ดอีกครั้ง

## ทางเลือก (ถ้าหา Role ไม่เจอ)

ใน Google Cloud Console → IAM → หา principal ที่เป็นอีเมล service account → กดแก้ (ดินสอ) → Add another role → ค้นหา **Firebase** หรือ **Realtime Database** แล้วเลือกบทบาทที่เกี่ยวกับ Realtime Database / Firebase Admin

หรือใช้ gcloud (ต้องติดตั้ง Google Cloud SDK):

```bash
# แทนที่ SERVICE_ACCOUNT_EMAIL ด้วย client_email จาก JSON
gcloud projects add-iam-policy-binding jaihan-assistant \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/firebasedatabase.admin"
```
