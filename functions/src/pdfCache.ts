import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import cors from "cors";
import sharp from "sharp";
import { generatePdfWithPuppeteer } from "./pdfGenerator";

// Initialize admin if not done elsewhere
if (admin.apps.length === 0) {
  admin.initializeApp({
    databaseURL: "https://jaihan-assistant.asia-southeast1.firebasedatabase.app",
    storageBucket: "jaihan-assistant.firebasestorage.app"
  });
}

const corsHandler = cors({ origin: true });

/**
 * Trigger เมื่อมีการอัปโหลดรูปใหม่ใน camera-checks/
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

      const pathParts = filePath.split("/");
      if (pathParts.length < 3) {
        console.warn("[Camera Image] Invalid path format");
        return null;
      }

      const cameraId = pathParts[1];
      console.log(`[Camera Image] Camera ID: ${cameraId}`);

      const [url] = await file.getSignedUrl({
        action: "read",
        expires: "03-01-2500",
      });

      const cameraRef = admin.database().ref(`cameras/${cameraId}`);
      await cameraRef.update({
        lastCheckedImage: url,
        lastCheckedImagePath: filePath,
        lastCheckedAt: new Date().toISOString(),
        imageProcessed: true,
      });

      console.log(`[Camera Image] Updated camera ${cameraId} metadata`);

      await admin.database().ref("cctvReport/outdated").set(true);
      console.log("[Camera Image] Marked PDF as outdated");

      await schedulePdfRegeneration();

      return null;
    } catch (error) {
      console.error("[Camera Image] Processing failed:", error);
      return null;
    }
  });

/**
 * Schedule PDF regeneration with debouncing
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
 * Cloud Function ที่รันทุก 1 นาที เพื่อตรวจสอบการสร้าง PDF
 */
export const checkPdfRegeneration = functions
  .runWith({
    timeoutSeconds: 300,
    memory: "2GB",
  })
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

    if (elapsed < 5000) {
      console.log("[PDF Check] Waiting for debounce...");
      return null;
    }

    console.log("[PDF Check] Starting PDF generation...");

    try {
      await scheduleRef.update({ status: "generating" });
      await generatePdfReport();
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
 */
export const generatePdf = functions
  .runWith({
    timeoutSeconds: 300,
    memory: "2GB",
  })
  .region("asia-southeast1")
  .https.onRequest((req, res) => {
    return corsHandler(req, res, async () => {
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
  });

/**
 * Core function สำหรับสร้าง PDF
 */
async function generatePdfReport(): Promise<string> {
  console.log("[PDF Generation] Fetching cameras...");

  const camerasSnapshot = await admin.database().ref("cameras").once("value");
  const cameras = camerasSnapshot.val();

  if (!cameras) {
    throw new Error("No cameras found");
  }

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

  console.log("[PDF Generation] Generating PDF with Puppeteer...");
  const pdfBuffer = await generatePdfWithPuppeteer(camerasWithImages);

  const bucket = admin.storage().bucket();
  console.log(`[PDF Generation] Using bucket: ${bucket.name}`);
  const pdfPath = `cctv-reports/latest-${Date.now()}.pdf`;
  const file = bucket.file(pdfPath);

  console.log("[PDF Generation] Uploading to Storage...");
  await file.save(pdfBuffer, {
    metadata: {
      contentType: "application/pdf",
    },
  });

  console.log("[PDF Generation] Making file public...");
  await file.makePublic();
  
  // Construct a more reliable public URL
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${pdfPath}`;
  console.log("[PDF Generation] PDF Public URL:", publicUrl);

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
    url: publicUrl,
    metadata: pdfMetadata,
    outdated: false,
    lastGenerated: new Date().toISOString(),
  });

  console.log("[PDF Generation] Completed");

  return publicUrl;
}

/**
 * HTTP Function สำหรับ optimize รูปภาพ
 */
export const optimizeImage = functions
  .runWith({
    memory: "1GB",
    timeoutSeconds: 120,
  })
  .region("asia-southeast1")
  .https.onRequest((req, res) => {
    return corsHandler(req, res, async () => {
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

        const response = await axios.get(imageUrl, {
          responseType: "arraybuffer",
        });

        const imageBuffer = Buffer.from(response.data);

        // Optimize with Sharp
        const optimized = await sharp(imageBuffer)
          .resize(800, 600, { fit: "inside" })
          .jpeg({ quality: 80 })
          .toBuffer();

        const base64 = optimized.toString("base64");

        res.json({
          success: true,
          base64: `data:image/jpeg;base64,${base64}`,
          originalSize: imageBuffer.length,
          optimizedSize: optimized.length,
        });
      } catch (error) {
        console.error("[Optimize Image] Error:", error);
        res.status(500).json({
          success: false,
          error: String(error),
        });
      }
    });
  });

/**
 * Get cached PDF metadata
 */
export const getPdfMetadata = functions
  .runWith({
    memory: "1GB",
    timeoutSeconds: 60,
  })
  .region("asia-southeast1")
  .https.onRequest((req, res) => {
    return corsHandler(req, res, async () => {
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
  });
