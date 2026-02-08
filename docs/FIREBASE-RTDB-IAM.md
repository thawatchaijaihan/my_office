# ให้ Service Account เข้า Realtime Database ได้

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
