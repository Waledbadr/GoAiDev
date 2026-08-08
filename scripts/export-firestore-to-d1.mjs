import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';
import path from 'path';

// Load environment from .env.local / .env
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
  dotenv.config();
} catch (e) {}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

console.log('Target Project ID:', firebaseConfig.projectId);

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

// Check command line arguments for email and password
const args = process.argv.slice(2);
const adminEmail = args[0] || process.env.ADMIN_EMAIL || 'm.alabdali@sacodeco.net';
const adminPass = args[1] || process.env.ADMIN_PASSWORD;

if (adminEmail && adminPass) {
  try {
    console.log(`Attempting login as: ${adminEmail}...`);
    await signInWithEmailAndPassword(auth, adminEmail, adminPass);
    console.log(`✅ Successfully signed in as ${adminEmail}`);
  } catch (err) {
    console.warn(`⚠️ Admin email login failed (${err.message}). Falling back to anonymous...`);
    try { await signInAnonymously(auth); } catch(e) {}
  }
} else {
  console.log('No admin password provided. Signing in anonymously...');
  try {
    await signInAnonymously(auth);
    console.log('Signed in anonymously.');
  } catch (err) {
    console.warn('Anonymous sign-in warning:', err.message);
  }
}

const TOP_COLLECTIONS = [
  'workers',
  'residences',
  'companies',
  'contracts',
  'invoices',
  'transactions',
  'income_expenses',
  'timesheets',
  'attendance',
  'leaves',
  'inventory_items',
  'orders',
  'service_orders',
  'users',
  'system_settings',
  'maintenance_requests',
  'feedback',
  'assignments',
  'transfers'
];

async function exportFirestoreData() {
  console.log('\n=== Exporting Firestore Data ===');
  const allData = {};
  let totalDocsCount = 0;

  // 1. Top collections
  for (const collName of TOP_COLLECTIONS) {
    try {
      const snapshot = await getDocs(collection(db, collName));
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      allData[collName] = docs;
      totalDocsCount += docs.length;
      console.log(`- '${collName}': ${docs.length} docs`);
    } catch (err) {
      console.warn(`- '${collName}': ${err.message}`);
      allData[collName] = [];
    }
  }

  // 2. Subcollections for Residences: rooms & beds
  const roomsList = [];
  const bedsList = [];
  if (allData.residences && allData.residences.length > 0) {
    console.log('\nFetching subcollections for residences...');
    for (const res of allData.residences) {
      try {
        const roomsSnap = await getDocs(collection(db, 'residences', res.id, 'rooms'));
        for (const roomDoc of roomsSnap.docs) {
          const roomData = { id: roomDoc.id, residenceId: res.id, ...roomDoc.data() };
          roomsList.push(roomData);

          // Fetch beds inside room
          try {
            const bedsSnap = await getDocs(collection(db, 'residences', res.id, 'rooms', roomDoc.id, 'beds'));
            for (const bedDoc of bedsSnap.docs) {
              bedsList.push({ id: bedDoc.id, residenceId: res.id, roomId: roomDoc.id, ...bedDoc.data() });
            }
          } catch (e) {}
        }
      } catch (err) {
        console.warn(`- Error fetching rooms for residence ${res.id}: ${err.message}`);
      }
    }
    allData['rooms'] = roomsList;
    allData['beds'] = bedsList;
    totalDocsCount += roomsList.length + bedsList.length;
    console.log(`- 'rooms' (subcollection): ${roomsList.length} docs`);
    console.log(`- 'beds' (subcollection): ${bedsList.length} docs`);
  }

  console.log(`\n==========================================`);
  console.log(`Total Exported Documents: ${totalDocsCount}`);
  console.log(`==========================================\n`);

  const outputDir = path.resolve('data_exports');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. JSON Export
  const jsonPath = path.join(outputDir, 'firestore-dump.json');
  fs.writeFileSync(jsonPath, JSON.stringify(allData, null, 2), 'utf8');
  console.log(`✅ Saved JSON dump to: ${jsonPath}`);

  // 2. SQL D1 Export Script
  let sqlScript = `-- Cloudflare D1 Full Export from Firestore\n`;
  sqlScript += `-- Exported on: ${new Date().toISOString()}\n\n`;

  sqlScript += `CREATE TABLE IF NOT EXISTS firestore_documents (\n`;
  sqlScript += `  collection_name TEXT NOT NULL,\n`;
  sqlScript += `  document_id TEXT NOT NULL,\n`;
  sqlScript += `  data JSON NOT NULL,\n`;
  sqlScript += `  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n`;
  sqlScript += `  PRIMARY KEY (collection_name, document_id)\n`;
  sqlScript += `);\n\n`;

  for (const [collName, docs] of Object.entries(allData)) {
    if (!docs || docs.length === 0) continue;
    sqlScript += `-- Collection: ${collName} (${docs.length} records)\n`;
    for (const docObj of docs) {
      const docId = docObj.id;
      const cleanDoc = { ...docObj };
      delete cleanDoc.id;
      const jsonStr = JSON.stringify(cleanDoc).replace(/'/g, "''");
      const escapedDocId = String(docId).replace(/'/g, "''");
      const escapedColl = String(collName).replace(/'/g, "''");
      sqlScript += `INSERT OR REPLACE INTO firestore_documents (collection_name, document_id, data) VALUES ('${escapedColl}', '${escapedDocId}', '${jsonStr}');\n`;
    }
    sqlScript += `\n`;
  }

  const sqlPath = path.join(outputDir, 'firestore-export-d1.sql');
  fs.writeFileSync(sqlPath, sqlScript, 'utf8');
  console.log(`✅ Saved Cloudflare D1 SQL script to: ${sqlPath}`);
}

exportFirestoreData().then(() => process.exit(0)).catch(err => {
  console.error('Export error:', err);
  process.exit(1);
});
