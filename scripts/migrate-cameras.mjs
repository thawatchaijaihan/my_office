import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const serviceAccount = JSON.parse(
  Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 || '', 'base64').toString()
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const cameras = JSON.parse(readFileSync('cameras_backup_new.json', 'utf8'));

admin.database().ref('cameras').set(cameras)
  .then(() => {
    console.log('✓ ย้ายข้อมูลกล้องสำเร็จ:', Object.keys(cameras).length, 'กล้อง');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Error:', error);
    process.exit(1);
  });
