import os
import json
import urllib.request
import urllib.parse
import mimetypes

# โฟลเดอร์ที่เกิดจากการรันคำสั่งดาวน์โหลดรูปภาพ
DOWNLOAD_FOLDER = "cctv_images"

# การตั้งค่า Firebase ของโปรเจกต์ใหม่ my-office-713
STORAGE_BUCKET = "my-office-713.firebasestorage.app"
DATABASE_URL = "https://my-office-713-default-rtdb.asia-southeast1.firebasedatabase.app"

def upload_images():
    print(f"กำลังเริ่มกระบวนการอัปโหลดรูปภาพทั้งหมดเข้าโปรเจกต์ใหม่...")
    
    # ดึงข้อมูลกล้องทั้งหมดเพื่อหา camera_id จากชื่อกล้อง
    try:
        req = urllib.request.Request(f"{DATABASE_URL}/cameras.json")
        response = urllib.request.urlopen(req)
        db_cameras = json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"ไม่สามารถติดต่อฐานข้อมูลได้ (คุณอาจลืมปิดสิทธิ์ .write: true ควรอัปเดต .read และ .write เป็น true ชั่วคราว)\n Error: {e}")
        return

    # สร้าง Dictionary หา id ด้วย name
    name_to_id = {}
    for cid, cdata in db_cameras.items():
        name_to_id[cdata.get('name', cid)] = cid

    if not os.path.exists(DOWNLOAD_FOLDER):
        print(f"ไม่พบโฟลเดอร์ {DOWNLOAD_FOLDER} ให้ข้าม")
        return

    uploaded = 0
    failed = 0

    for root, _, files in os.walk(DOWNLOAD_FOLDER):
        for filename in files:
            if not filename.endswith(".jpg"):
                continue

            # ชื่อกล้อง (ตัด .jpg)
            camera_name = os.path.splitext(filename)[0]
            camera_id = name_to_id.get(camera_name)

            if not camera_id:
                print(f"[ข้าม] ไม่พบกล้องชื่อ '{camera_name}' ในระบบฐานข้อมูล")
                failed += 1
                continue

            file_path = os.path.join(root, filename)
            
            # เส้นทางบน Storage
            # รูปแบบ: camera-checks / {camera_id} / {filename}
            # กฎของ Storage ใน office_project ระบุให้เขียนทับ camera-checks ได้อิสระ
            storage_path = f"camera-checks/{camera_id}/{urllib.parse.quote(filename)}"
            upload_url = f"https://firebasestorage.googleapis.com/v0/b/{STORAGE_BUCKET}/o?name={storage_path}"
            
            # 1. อัปโหลดขึ้น Storage
            try:
                with open(file_path, "rb") as f:
                    file_data = f.read()

                req = urllib.request.Request(upload_url, data=file_data, method="POST")
                req.add_header('Content-Type', 'image/jpeg')
                
                resp = urllib.request.urlopen(req)
                resp_data = json.loads(resp.read().decode('utf-8'))
                download_token = resp_data.get("downloadTokens")
                
                # 2. นำ URL ปลายทางไปอัปเดต Database
                # URL ต้องเข้ารหัสอีกครั้งตามรูปแบบ Storage Download URL (เปลี่ยนเฉพาะ / เป็น %2F เพราะไฟล์เข้า quote() ไปแล้ว)
                safe_storage_path = storage_path.replace('/', '%2F')
                new_image_url = f"https://firebasestorage.googleapis.com/v0/b/{STORAGE_BUCKET}/o/{safe_storage_path}?alt=media&token={download_token}"
                
                # ทำการ PATCH ข้อมูลเข้า RTDB
                patch_url = f"{DATABASE_URL}/cameras/{camera_id}.json"
                patch_data = json.dumps({"lastCheckedImage": new_image_url, "lastCheckedImagePath": storage_path}).encode('utf-8')
                
                patch_req = urllib.request.Request(patch_url, data=patch_data, method="PATCH")
                patch_req.add_header('Content-Type', 'application/json')
                
                urllib.request.urlopen(patch_req)
                
                print(f"[อัปโหลดและผูก URL สำเร็จ] กล้อง: {camera_name}")
                uploaded += 1
                
            except Exception as e:
                print(f"[ล้มเหลว] กล้อง: {camera_name} - Error: {e}")
                failed += 1

    print("-" * 30)
    print("อัปโหลดเสร็จสมบูรณ์!")
    print(f"อัปโหลดสำเร็จ: {uploaded} รูป")
    print(f"ล้มเหลว/ข้าม: {failed} รูป")
    
if __name__ == "__main__":
    upload_images()
