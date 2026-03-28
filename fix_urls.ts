import { config } from "dotenv";
config();
import * as admin from "firebase-admin";

const svcBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
if (svcBase64) {
  const jsonBuf = Buffer.from(svcBase64, "base64");
  const creds = JSON.parse(jsonBuf.toString("utf-8"));
  admin.initializeApp({
    credential: admin.credential.cert(creds),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  });
} else {
  console.error("Missing service account base64");
  process.exit(1);
}

async function fix() {
  const db = admin.database();
  const ref = db.ref("cameras");
  const snapshot = await ref.once("value");
  const data = snapshot.val();
  let count = 0;
  for (const cid of Object.keys(data)) {
    const cam = data[cid];
    if (cam.lastCheckedImage && cam.lastCheckedImage.includes("%25")) {
      const fixed = cam.lastCheckedImage.replace(/%25/g, "%");
      await db.ref(`cameras/${cid}`).update({ lastCheckedImage: fixed });
      count++;
      console.log(`Fixed ${cid}`);
    }
  }
  console.log("Fixed", count, "URLs in RTDB");
}

fix()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
