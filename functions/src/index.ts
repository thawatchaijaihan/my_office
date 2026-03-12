import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

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
