import os
import json
import urllib.request
import base64
import re

# การตั้งค่า Firebase URL ของคุณ (เราตั้งกฎให้อ่านเป็นสาธารณะแล้ว จึงดึง .json ได้เลย)
FIREBASE_DB_URL = "https://my-office-713-default-rtdb.asia-southeast1.firebasedatabase.app/cameras.json"
DOWNLOAD_FOLDER = "cctv_images"

def clean_filename(filename):
    """ลบอักขระพิเศษที่ห้ามใช้ในการตั้งชื่อไฟล์"""
    return re.sub(r'[\\/*?:"<>|]', "", filename).strip()

def download_images():
    print(f"กำลังดึงข้อมูลกล้องวงจรปิดจากฐานข้อมูล...")
    try:
        response = urllib.request.urlopen(FIREBASE_DB_URL)
        data = json.loads(response.read().decode('utf-8'))
        
        if not data:
            print("ไม่พบข้อมูลกล้องใดๆ ในฐานข้อมูล")
            return
            
        total_cameras = len(data)
        downloaded = 0
        skipped = 0
        
        print(f"พบกล้องทั้งหมด {total_cameras} ตัว")
        
        for cam_id, cam_info in data.items():
            cam_type = cam_info.get("type", "อื่นๆ")
            cam_name = cam_info.get("name", cam_id)
            image_src = cam_info.get("lastCheckedImage")
            
            # ลบอักขระพิเศษออกจากชื่อหมวดหมู่และชื่อไฟล์
            safe_type = clean_filename(cam_type)
            safe_name = clean_filename(cam_name)
            
            # สร้างโฟลเดอร์ตามประเภทของกล้อง
            folder_path = os.path.join(DOWNLOAD_FOLDER, safe_type)
            if not os.path.exists(folder_path):
                os.makedirs(folder_path)
            
            # ตรวจสอบว่ามีรูปภาพหรือไม่
            if not image_src:
                skipped += 1
                continue
                
            file_path = os.path.join(folder_path, f"{safe_name}.jpg")
            
            try:
                # กรณีรูปภาพเป็น Base64 (ฝังอยู่ใน Database)
                if image_src.startswith("data:image"):
                    base64_data = image_src.split(",")[1]
                    image_binary = base64.b64decode(base64_data)
                    with open(file_path, "wb") as f:
                        f.write(image_binary)
                    print(f"[สำเร็จ] โหลดภาพจาก Base64: {safe_type} / {safe_name}.jpg")
                    downloaded += 1
                
                # กรณีรูปภาพเป็นแบบ URL (รูปที่อัปโหลดไป Firebase Storage)
                elif image_src.startswith("http"):
                    req = urllib.request.Request(image_src, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req) as img_resp, open(file_path, 'wb') as f:
                        f.write(img_resp.read())
                    print(f"[สำเร็จ] โหลดภาพจาก URL: {safe_type} / {safe_name}.jpg")
                    downloaded += 1
                else:
                    print(f"[ข้าม] ไม่รู้จักรูปแบบรูปภาพ: {safe_type} / {safe_name}")
                    skipped += 1
                    
            except Exception as e:
                print(f"[ผิดพลาด] ไม่สามารถโหลดรูปรถของ {safe_name} ได้: {e}")
                
        print("-" * 30)
        print("สรุปผลการดาวน์โหลด:")
        print(f"กล้องทั้งหมด: {total_cameras} ตัว")
        print(f"ดาวน์โหลดสำเร็จ: {downloaded} รูป")
        print(f"กล้องที่ไม่มีรูป/ข้าม: {skipped} ตัว")
        print(f"รูปทั้งหมดถูกบันทึกไว้ที่โฟลเดอร์: {os.path.abspath(DOWNLOAD_FOLDER)}")

    except Exception as e:
        print(f"เกิดข้อผิดพลาดในการดึงข้อมูลจาก Database: {e}")

if __name__ == "__main__":
    download_images()
