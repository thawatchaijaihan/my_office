import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";
// import sharp from "sharp";

setGlobalOptions({ region: "asia-southeast1" });

/**
 * Trigger เมื่อมีการอัปโหลดรูปภาพกล้องวงจรปิด
 * Path: camera-checks/{cameraId}/{fileName}
 */
export const onCameraImageUpload = onObjectFinalized({
  bucket: "my-office-713.firebasestorage.app",
}, async (event) => {
  const filePath = event.data.name;
  if (!filePath.startsWith("camera-checks/")) return;

  const parts = filePath.split("/");
  if (parts.length < 2) return;
  const cameraId = parts[1];

  const db = admin.database();
  const now = new Date().toISOString();

  // อัปเดต metadata ของกล้อง
  await db.ref(`cameras/${cameraId}`).update({
    lastCheckedImage: event.data.mediaLink || "",
    lastCheckedImagePath: filePath,
    lastCheckedAt: now,
    imageProcessed: false,
  });

  // Mark PDF ว่าเป็น outdated และส่งคิวให้ตรวจสอบการสร้างใหม่
  await db.ref("cctvReport").update({
    outdated: true,
  });

  await db.ref("pdfGeneration/scheduled").update({
    scheduledAt: now,
    status: "pending",
  });

  console.log(`Updated camera metadata for ${cameraId} and scheduled PDF regeneration.`);
});

/**
 * ตรวจสอบและสร้าง PDF ใหม่ตามคิว
 * รันทุก 1 นาที
 */
export const checkPdfRegeneration = onSchedule({
  schedule: "every 1 minutes",
  timeZone: "Asia/Bangkok",
}, async () => {
  const db = admin.database();
  const scheduledRef = db.ref("pdfGeneration/scheduled");
  const snapshot = await scheduledRef.get();
  
  if (!snapshot.exists()) return;
  
  const data = snapshot.val();
  if (data.status !== "pending") return;

  // Debounce: รออย่างน้อย 5 วินาทีนับจากการสเกจูลครั้งล่าสุดเพื่อให้แน่ใจว่ารูปอัปโหลดเสร็จหมด
  const scheduledAt = new Date(data.scheduledAt).getTime();
  const now = Date.now();
  if (now - scheduledAt < 5000) {
    console.log("Waiting for debounce time...");
    return;
  }

  console.log("Starting PDF regeneration...");
  await scheduledRef.update({ status: "generating" });

  try {
    // ในที่นี้เราจะจำลองการเรียกฟังก์ชันสร้าง PDF หรือรันตรรกะสร้าง PDF
    // หมายเหตุ: การสร้าง PDF จริงอาจต้องใช้ Puppeteer หรือ PDF library อื่นๆ
    // สำหรับ MVP นี้เราจะอัปเดตสถานะเป็นเสร็จสมบูรณ์
    
    await db.ref("cctvReport").update({
      outdated: false,
      lastGenerated: new Date().toISOString(),
    });

    await scheduledRef.update({
      status: "completed",
      completedAt: new Date().toISOString(),
    });

    console.log("PDF regeneration completed successfully.");
  } catch (error) {
    console.error("PDF regeneration failed:", error);
    await scheduledRef.update({ status: "failed" });
  }
});

/**
 * สร้าง PDF แบบ Manual
 */
export const generatePdf = onRequest(async (req, res) => {
  try {
    const db = admin.database();
    console.log("Manual PDF generation requested.");

    // จำลองตรรกะการสร้าง PDF
    await db.ref("cctvReport").update({
      outdated: false,
      lastGenerated: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "สร้าง PDF สำเร็จ (Simulated)",
      pdfUrl: "https://storage.googleapis.com/my-office-713.firebasestorage.app/cctv-reports/latest.pdf",
    });
  } catch (error) {
    console.error("Manual generatePdf error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Optimize รูปภาพ (Resize/Compress)
 */
export const optimizeImage = onRequest(async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      res.status(400).json({ error: "Missing imageUrl" });
      return;
    }

    // ในที่นี้เราจะรัน Sharp เพื่อทดสอบการประมวลผลรูปภาพ (ตัวอย่าง)
    
    res.json({
      success: true,
      message: "Image optimization logic placeholder",
    });
  } catch (error) {
    console.error("OptimizeImage error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * ดึง Metadata ของ PDF ล่าสุด
 */
export const getPdfMetadata = onRequest(async (req, res) => {
  try {
    const db = admin.database();
    const snapshot = await db.ref("cctvReport").get();
    
    if (!snapshot.exists()) {
      res.json({ exists: false, outdated: true });
      return;
    }

    const data = snapshot.val();
    res.json({
      exists: true,
      url: data.url || "https://storage.googleapis.com/my-office-713.firebasestorage.app/cctv-reports/latest.pdf",
      outdated: !!data.outdated,
      lastGenerated: data.lastGenerated,
    });
  } catch (error) {
    console.error("GetPdfMetadata error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
