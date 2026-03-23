import admin from 'firebase-admin';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config({ path: '.env.local' });

// Initialize source (gate-pass-713)
const sourceServiceAccount = JSON.parse(
  readFileSync('C:/Users/thawa/Desktop/jaihan-assistant/gate-pass/jaihan-assistant-90c28d13e839.json', 'utf8')
);

const sourceApp = admin.initializeApp({
  credential: admin.credential.cert(sourceServiceAccount),
  storageBucket: 'gate-pass-713.firebasestorage.app'
}, 'source');

// Initialize destination (jaihan-assistant)
const destServiceAccount = JSON.parse(
  Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 || '', 'base64').toString()
);

const destApp = admin.initializeApp({
  credential: admin.credential.cert(destServiceAccount),
  storageBucket: 'jaihan-assistant.firebasestorage.app',
  databaseURL: process.env.FIREBASE_DATABASE_URL
}, 'dest');

const sourceStorage = sourceApp.storage().bucket();
const destStorage = destApp.storage().bucket();
const database = destApp.database();

async function migrateCameraImages() {
  console.log('🔄 เริ่มย้ายรูปภาพกล้อง...\n');

  // Get all cameras from database
  const snapshot = await database.ref('cameras').once('value');
  const cameras = snapshot.val();

  if (!cameras) {
    console.log('❌ ไม่พบข้อมูลกล้อง');
    return;
  }

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const [cameraId, camera] of Object.entries(cameras)) {
    if (!camera.lastCheckedImagePath) {
      skippedCount++;
      continue;
    }

    try {
      const sourcePath = camera.lastCheckedImagePath;
      console.log(`📸 กล้อง ${camera.name} (${cameraId})`);
      console.log(`   ดาวน์โหลด: ${sourcePath}`);

      // Download from source
      const [fileBuffer] = await sourceStorage.file(sourcePath).download();

      // Upload to destination
      const destFile = destStorage.file(sourcePath);
      await destFile.save(fileBuffer, {
        metadata: {
          contentType: 'image/jpeg',
        },
      });

      // Make public
      await destFile.makePublic();

      // Get new URL
      const newUrl = `https://firebasestorage.googleapis.com/v0/b/jaihan-assistant.firebasestorage.app/o/${encodeURIComponent(sourcePath)}?alt=media`;

      // Update database
      await database.ref(`cameras/${cameraId}`).update({
        lastCheckedImage: newUrl
      });

      console.log(`   ✓ อัปโหลดสำเร็จ\n`);
      migratedCount++;

    } catch (error) {
      console.error(`   ✗ Error: ${error.message}\n`);
      errorCount++;
    }
  }

  console.log('\n📊 สรุปผลการย้าย:');
  console.log(`   ✓ ย้ายสำเร็จ: ${migratedCount} รูป`);
  console.log(`   ⊘ ข้าม (ไม่มีรูป): ${skippedCount} กล้อง`);
  console.log(`   ✗ ผิดพลาด: ${errorCount} รูป`);
  
  process.exit(0);
}

migrateCameraImages().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
