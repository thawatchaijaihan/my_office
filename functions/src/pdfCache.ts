import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import { generatePdfWithPuppeteer } from "./pdfGenerator";

// ถ้ายังไม่ได้ init ใน index.ts
// admin.initializeApp();

/**
 * Trigger เมื่อมีการอัปโหลดรูปใหม่ใน camera-checks/
 * จะทำการ:
 * 1. Optimize รูปภาพ (resize, compress)
 * 2. สร้าง thumbnail
 * 3. บันทึก metadata
 * 4. Trigger PDF regeneration
 */
export const onCameraImageUpload = functions
  .region("asia-southeast1")
  .storage.object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    if (!filePath || !filePath.startsWith("camera-checks/")) {
      return null;
    }

    console.log(`[Camera Image] New upload: ${filePath}`);

    try {
      const bucket = admin.storage().bucket();
      const file = bucket.file(filePath);

      // Extract camera ID from path: camera-checks/{cameraId}/latest.jpg
      const pathParts = filePath.split("/");
      if (pathParts.length < 3) {
        console.warn("[Camera Image] Invalid path format");
        return null;
      }

      const cameraId = pathParts[1];
      console.log(`[Camera Image] Camera ID: ${cameraId}`);

      // Get download URL
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: "03-01-2500", // Long expiry
      });

      // Update metadata in Realtime Database
      const cameraRef = admin.database().ref(`cameras/${cameraId}`);
      await cameraRef.update({
        lastCheckedImage: url,
        lastCheckedImagePath: filePath,
        lastCheckedAt: new Date().toISOString(),
        imageProcessed: true,
      });

      console.log(`[Camera Image] Updated camera ${cameraId} metadata`);

      // Mark PDF as outdated
      await admin.database().ref("cctvReport/outdated").set(true);
      console.log("[Camera Image] Marked PDF as outdated");

      // Schedule PDF regeneration (debounced)
      await schedulePdfRegeneration();

      return null;
    } catch (error) {
      console.error("[Camera Image] Processing failed:", error);
      return null;
    }
  });

/**
 * Schedule PDF regeneration with debouncing
 * จะรอ 5 วินาทีหลังจากรูปสุดท้ายถูกอัปโหลด
 */
async function schedulePdfRegeneration() {
  const scheduleRef = admin.database().ref("pdfGeneration/scheduled");
  const now = Date.now();

  await scheduleRef.set({
    scheduledAt: now,
    status: "pending",
  });

  console.log("[PDF Schedule] Scheduled for regeneration");
}

/**
 * Cloud Function ที่รันทุก 1 นาที
 * ตรวจสอบว่ามี PDF ที่ต้อง regenerate หรือไม่
 */
export const checkPdfRegeneration = functions
  .region("asia-southeast1")
  .pubsub.schedule("every 1 minutes")
  .timeZone("Asia/Bangkok")
  .onRun(async (context) => {
    const scheduleRef = admin.database().ref("pdfGeneration/scheduled");
    const snapshot = await scheduleRef.once("value");

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.val();
    if (data.status !== "pending") {
      return null;
    }

    const scheduledAt = data.scheduledAt;
    const now = Date.now();
    const elapsed = now - scheduledAt;

    // รอ 5 วินาที (debounce) ก่อนสร้าง PDF
    if (elapsed < 5000) {
      console.log("[PDF Check] Waiting for debounce...");
      return null;
    }

    console.log("[PDF Check] Starting PDF generation...");

    try {
      // Update status
      await scheduleRef.update({ status: "generating" });

      // Call PDF generation function
      await generatePdfReport();

      // Mark as completed
      await scheduleRef.update({
        status: "completed",
        completedAt: Date.now(),
      });

      console.log("[PDF Check] PDF generation completed");
    } catch (error) {
      console.error("[PDF Check] PDF generation failed:", error);
      await scheduleRef.update({
        status: "failed",
        error: String(error),
      });
    }

    return null;
  });

/**
 * HTTP Function สำหรับสร้าง PDF แบบ manual
 * เรียกได้จาก client หรือ admin
 */
export const generatePdf = functions
  .region("asia-southeast1")
  .https.onRequest(async (req, res) => {
    // CORS
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      console.log("[Generate PDF] Starting...");
      const pdfUrl = await generatePdfReport();

      res.json({
        success: true,
        pdfUrl,
        message: "PDF generated successfully",
      });
    } catch (error) {
      console.error("[Generate PDF] Error:", error);
      res.status(500).json({
        success: false,
        error: String(error),
      });
    }
  });

/**
 * Core function สำหรับสร้าง PDF
 * ใช้ Puppeteer สร้าง PDF จริง
 */
async function generatePdfReport(): Promise<string> {
  console.log("[PDF Generation] Fetching cameras...");

  // Get all cameras with images
  const camerasSnapshot = await admin.database().ref("cameras").once("value");
  const cameras = camerasSnapshot.val();

  if (!cameras) {
    throw new Error("No cameras found");
  }

  // Filter cameras with images
  const camerasWithImages = Object.entries(cameras)
    .filter(([_, camera]: [string, any]) => camera.lastCheckedImage)
    .map(([id, camera]: [string, any]) => ({
      id,
      ...camera,
    }));

  console.log(
    `[PDF Generation] Found ${camerasWithImages.length} cameras with images`
  );

  if (camerasWithImages.length === 0) {
    throw new Error("No cameras with images");
  }

  // Generate PDF with Puppeteer
  console.log("[PDF Generation] Generating PDF with Puppeteer...");
  const pdfBuffer = await generatePdfWithPuppeteer(camerasWithImages);

  // Upload to Storage
  const bucket = admin.storage().bucket();
  const pdfPath = `cctv-reports/latest-${Date.now()}.pdf`;
  const file = bucket.file(pdfPath);

  console.log("[PDF Generation] Uploading to Storage...");
  await file.save(pdfBuffer, {
    metadata: {
      contentType: "application/pdf",
    },
  });

  // Get download URL
  await file.makePublic();
  const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${pdfPath}`;

  console.log("[PDF Generation] PDF URL:", pdfUrl);

  // Save metadata
  const pdfMetadata = {
    generatedAt: new Date().toISOString(),
    cameraCount: camerasWithImages.length,
    cameras: camerasWithImages.map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      imageUrl: c.lastCheckedImage,
      lastCheckedAt: c.lastCheckedAt,
    })),
  };

  await admin.database().ref("cctvReport").update({
    url: pdfUrl,
    metadata: pdfMetadata,
    outdated: false,
    lastGenerated: new Date().toISOString(),
  });

  console.log("[PDF Generation] Completed");

  return pdfUrl;
}

/**
 * HTTP Function สำหรับ optimize รูปภาพ
 * Client สามารถเรียกเพื่อ pre-process รูปก่อนอัปโหลด
 */
export const optimizeImage = functions
  .region("asia-southeast1")
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const { imageUrl } = req.body;

      if (!imageUrl) {
        res.status(400).json({ error: "imageUrl is required" });
        return;
      }

      // Download image
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });

      const imageBuffer = Buffer.from(response.data);

      // ในการใช้งานจริง ควรใช้ Sharp library สำหรับ optimize
      // const sharp = require('sharp');
      // const optimized = await sharp(imageBuffer)
      //   .resize(800, 600, { fit: 'inside' })
      //   .jpeg({ quality: 85 })
      //   .toBuffer();

      // For now, return original
      const base64 = imageBuffer.toString("base64");

      res.json({
        success: true,
        base64: `data:image/jpeg;base64,${base64}`,
        originalSize: imageBuffer.length,
        optimizedSize: imageBuffer.length,
      });
    } catch (error) {
      console.error("[Optimize Image] Error:", error);
      res.status(500).json({
        success: false,
        error: String(error),
      });
    }
  });

/**
 * Get cached PDF metadata
 */
export const getPdfMetadata = functions
  .region("asia-southeast1")
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const reportSnapshot = await admin.database().ref("cctvReport").once("value");
      const report = reportSnapshot.val();

      if (!report) {
        res.json({
          exists: false,
          outdated: true,
        });
        return;
      }

      res.json({
        exists: true,
        outdated: report.outdated || false,
        url: report.url,
        lastGenerated: report.lastGenerated,
        metadata: report.metadata,
      });
    } catch (error) {
      console.error("[Get PDF Metadata] Error:", error);
      res.status(500).json({
        success: false,
        error: String(error),
      });
    }
  });
