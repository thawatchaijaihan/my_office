import * as admin from "firebase-admin";

admin.initializeApp({
  databaseURL: "https://jaihan-assistant.asia-southeast1.firebasedatabase.app",
  storageBucket: "jaihan-assistant.firebasestorage.app"
});

// Import cleanup functions
import { cleanupOldStorageFiles, testCleanupStorage } from "./cleanup";

// Import PDF cache functions
import {
  onCameraImageUpload,
  checkPdfRegeneration,
  generatePdf,
  optimizeImage,
  getPdfMetadata,
} from "./pdfCache";

// Export cleanup functions
export { cleanupOldStorageFiles, testCleanupStorage };

// Export PDF cache functions
export {
  onCameraImageUpload,
  checkPdfRegeneration,
  generatePdf,
  optimizeImage,
  getPdfMetadata,
};
