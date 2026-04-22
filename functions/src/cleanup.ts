import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";

// Set global options for all functions in this file
setGlobalOptions({ region: "asia-southeast1" });

/**
 * Cloud Function ที่รันทุกวันที่ 1 ของเดือน เวลา 02:00 น.
 * ลบไฟล์ใน Storage ที่เก่ากว่า 30 วัน
 */
export const cleanupOldStorageFiles = onSchedule({
  schedule: "0 2 1 * *",
  timeZone: "Asia/Bangkok",
}, async () => {
  const bucket = admin.storage().bucket();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let deletedCount = 0;
  let errorCount = 0;

  try {
    const [cameraFiles] = await bucket.getFiles({
      prefix: "camera-checks/",
    });

    for (const file of cameraFiles) {
      try {
        const [metadata] = await file.getMetadata();
        if (!metadata.timeCreated) continue;
        const createdDate = new Date(metadata.timeCreated as string);

        if (createdDate < thirtyDaysAgo) {
          await file.delete();
          deletedCount++;
          console.log(`Deleted old file: ${file.name}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error deleting file ${file.name}:`, error);
      }
    }

    const [reportFiles] = await bucket.getFiles({
      prefix: "cctv-reports/",
    });

    for (const file of reportFiles) {
      try {
        const [metadata] = await file.getMetadata();
        if (!metadata.timeCreated) continue;
        const createdDate = new Date(metadata.timeCreated as string);

        if (createdDate < thirtyDaysAgo) {
          await file.delete();
          deletedCount++;
          console.log(`Deleted old report: ${file.name}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error deleting report ${file.name}:`, error);
      }
    }

    console.log(
      `Cleanup completed. Deleted: ${deletedCount}, Errors: ${errorCount}`
    );
  } catch (error) {
    console.error("Cleanup function error:", error);
    throw error;
  }
});

/**
 * HTTP Function สำหรับทดสอบการลบไฟล์
 */
export const testCleanupStorage = onRequest(async (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_API_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const bucket = admin.storage().bucket();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let deletedCount = 0;
  let errorCount = 0;
  const deletedFiles: string[] = [];

  try {
    const [allFiles] = await bucket.getFiles({
      prefix: "camera-checks/",
    });

    for (const file of allFiles) {
      try {
        const [metadata] = await file.getMetadata();
        if (!metadata.timeCreated) continue;
        const createdDate = new Date(metadata.timeCreated as string);

        if (createdDate < thirtyDaysAgo) {
          await file.delete();
          deletedCount++;
          deletedFiles.push(file.name);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error deleting ${file.name}:`, error);
      }
    }

    res.json({
      success: true,
      deletedCount,
      errorCount,
      deletedFiles,
      message: "ลบไฟล์เก่ากว่า 30 วันสำเร็จ",
    });
  } catch (error) {
    console.error("Test cleanup error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: String(error),
    });
  }
});
