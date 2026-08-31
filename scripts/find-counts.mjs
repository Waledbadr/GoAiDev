import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config();

function initAdmin() {
  if (admin.apps.length > 0) return admin.app();
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (privateKey && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (clientEmail && privateKey) {
    return admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    return admin.initializeApp({ projectId });
  }
}

async function find30188() {
  initAdmin();
  const db = admin.firestore();

  console.log('--- Checking Firestore Collections ---');
  const collections = await db.listCollections();
  for (const col of collections) {
    try {
      const countSnap = await col.count().get();
      console.log(`Firestore [${col.id}]: ${countSnap.data().count}`);
    } catch (e) {
      console.log(`Firestore [${col.id}]: error ${e.message}`);
    }
  }

  console.log('\n--- Checking Local JSON Files in data/ ---');
  if (fs.existsSync('data')) {
    const files = fs.readdirSync('data');
    for (const f of files) {
      const p = path.join('data', f);
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          console.log(`File [${f}]: array with ${data.length} items`);
        } else if (typeof data === 'object') {
          console.log(`File [${f}]: keys ->`, Object.keys(data).map(k => `${k}: ${Array.isArray(data[k]) ? data[k].length : typeof data[k]}`).join(', '));
        }
      } catch (e) {
        console.log(`File [${f}]: read error ${e.message}`);
      }
    }
  }
}

find30188().catch(console.error);
