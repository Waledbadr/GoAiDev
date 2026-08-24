import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

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
    // Default application credentials fallback
    return admin.initializeApp({ projectId });
  }
}

async function exportAll() {
  console.log('🚀 Initializing Firebase Admin SDK for complete data export...');
  initAdmin();
  const db = admin.firestore();

  const collectionsToExport = [
    'contractsV2',
    'contractInvoices',
    'contractAlerts',
    'contracts',
    'invoices',
    'residences',
    'companies',
    'workers',
    'orders',
    'service_orders',
    'inventory_items',
    'transactions',
    'income_expenses',
    'timesheets',
    'attendance',
    'leaves',
    'users',
    'maintenance_requests',
    'system_settings',
    'feedback',
    'assignments',
    'transfers',
  ];

  const allData = {};
  let totalDocs = 0;

  for (const colName of collectionsToExport) {
    try {
      const snap = await db.collection(colName).get();
      const docs = snap.docs.map((doc) => {
        const d = doc.data();
        // Normalize Firestore Timestamps to ISO strings
        const clean = {};
        for (const [k, v] of Object.entries(d)) {
          if (v && typeof v.toDate === 'function') {
            clean[k] = v.toDate().toISOString();
          } else {
            clean[k] = v;
          }
        }
        return { id: doc.id, ...clean };
      });

      allData[colName] = docs;
      totalDocs += docs.length;
      console.log(`✅ [${colName}]: Exported ${docs.length} documents.`);
    } catch (err) {
      console.warn(`⚠️ [${colName}]: Could not export (${err.message}). Skipping.`);
      allData[colName] = [];
    }
  }

  // Also fetch residence subcollections: rooms & beds
  const roomsList = [];
  const bedsList = [];
  if (allData.residences && allData.residences.length > 0) {
    for (const res of allData.residences) {
      try {
        const roomsSnap = await db.collection('residences').doc(res.id).collection('rooms').get();
        for (const rDoc of roomsSnap.docs) {
          const rData = { id: rDoc.id, residenceId: res.id, ...rDoc.data() };
          roomsList.push(rData);

          try {
            const bedsSnap = await db.collection('residences').doc(res.id).collection('rooms').doc(rDoc.id).collection('beds').get();
            for (const bDoc of bedsSnap.docs) {
              bedsList.push({ id: bDoc.id, residenceId: res.id, roomId: rDoc.id, ...bDoc.data() });
            }
          } catch {}
        }
      } catch {}
    }
  }
  allData['rooms'] = roomsList;
  allData['beds'] = bedsList;
  totalDocs += roomsList.length + bedsList.length;
  console.log(`✅ [rooms]: Exported ${roomsList.length} subcollection docs.`);
  console.log(`✅ [beds]: Exported ${bedsList.length} subcollection docs.`);

  const outputDir = path.resolve('data_exports');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. JSON Dump
  const jsonPath = path.join(outputDir, 'firestore-dump-complete.json');
  fs.writeFileSync(jsonPath, JSON.stringify(allData, null, 2), 'utf8');
  console.log(`\n🎉 JSON Dump saved successfully to: ${jsonPath}`);

  // 2. Cloudflare D1 SQL Script
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
  console.log(`🎉 Cloudflare D1 SQL script saved successfully to: ${sqlPath}`);
  console.log(`\nTotal exported documents: ${totalDocs}`);
}

exportAll().catch(console.error);
