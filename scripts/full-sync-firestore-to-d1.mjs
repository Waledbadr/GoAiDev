import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

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

function cleanDocData(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(cleanDocData);
  }
  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v.toDate === 'function') {
      clean[k] = v.toDate().toISOString();
    } else if (v && typeof v === 'object' && !(v instanceof Date)) {
      clean[k] = cleanDocData(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

const KNOWN_COLLECTIONS = [
  'workers',
  'residences',
  'companies',
  'contracts',
  'contractsV2',
  'invoices',
  'contractInvoices',
  'contractAlerts',
  'transactions',
  'income_expenses',
  'timesheets',
  'attendance',
  'attendanceRecords',
  'leaves',
  'timesheetLeaves',
  'transfers',
  'timesheetTransfers',
  'exceptions',
  'timesheetExceptions',
  'housingEmployees',
  'inventory',
  'inventory_items',
  'inventoryTransactions',
  'stockTransfers',
  'inventoryAudits',
  'mrvs',
  'mivs',
  'mrvRequests',
  'orders',
  'serviceOrders',
  'service_orders',
  'users',
  'system_settings',
  'maintenanceRequests',
  'maintenance_requests',
  'feedback',
  'assignments',
  'transferRequests',
  'notifications',
  'fcmTokens'
];

async function syncAllFirestoreToD1() {
  console.log('🚀 Initializing Firebase Admin SDK for complete data migration...');
  initAdmin();
  const db = admin.firestore();

  // 1. Discover all root collections dynamically
  let discoveredCollections = [];
  try {
    const cols = await db.listCollections();
    discoveredCollections = cols.map(c => c.id);
    console.log(`📡 Dynamically discovered ${discoveredCollections.length} collections from Firestore:`, discoveredCollections.join(', '));
  } catch (err) {
    console.warn('⚠️ Could not list collections dynamically, using known collection list:', err.message);
  }

  const allCollectionNames = Array.from(new Set([...discoveredCollections, ...KNOWN_COLLECTIONS]));
  console.log(`📋 Total collections to inspect: ${allCollectionNames.length}`);

  const allData = {};
  let totalDocs = 0;

  for (const colName of allCollectionNames) {
    try {
      const snap = await db.collection(colName).get();
      if (snap.empty) {
        // Only log if discovered or non-empty
        if (discoveredCollections.includes(colName)) {
          console.log(`- [${colName}]: 0 docs`);
        }
        continue;
      }

      const docs = snap.docs.map(doc => {
        const d = cleanDocData(doc.data());
        return { id: doc.id, ...d };
      });

      allData[colName] = docs;
      totalDocs += docs.length;
      console.log(`✅ [${colName}]: Exported ${docs.length} documents.`);
    } catch (err) {
      console.warn(`⚠️ [${colName}]: Error fetching (${err.message}).`);
    }
  }

  // 2. Fetch Subcollections
  console.log('\n🔍 Scanning for subcollections (residences/rooms/beds, feedback/updates)...');
  const roomsList = [];
  const bedsList = [];
  if (allData.residences && allData.residences.length > 0) {
    for (const res of allData.residences) {
      try {
        const roomsSnap = await db.collection('residences').doc(res.id).collection('rooms').get();
        for (const rDoc of roomsSnap.docs) {
          const rData = { id: rDoc.id, residenceId: res.id, ...cleanDocData(rDoc.data()) };
          roomsList.push(rData);

          try {
            const bedsSnap = await db.collection('residences').doc(res.id).collection('rooms').doc(rDoc.id).collection('beds').get();
            for (const bDoc of bedsSnap.docs) {
              bedsList.push({ id: bDoc.id, residenceId: res.id, roomId: rDoc.id, ...cleanDocData(bDoc.data()) });
            }
          } catch {}
        }
      } catch {}
    }
  }

  if (roomsList.length > 0) {
    allData['rooms'] = roomsList;
    totalDocs += roomsList.length;
    console.log(`✅ [rooms]: Exported ${roomsList.length} subcollection documents.`);
  }

  if (bedsList.length > 0) {
    allData['beds'] = bedsList;
    totalDocs += bedsList.length;
    console.log(`✅ [beds]: Exported ${bedsList.length} subcollection documents.`);
  }

  console.log(`\n==========================================`);
  console.log(`🎉 Total Documents Exported: ${totalDocs}`);
  console.log(`==========================================\n`);

  // 3. Save to Local D1 database JSON (used by Next.js API & local runtime)
  const localDbPath = path.resolve('data', 'cpc-d1-database.json');
  fs.mkdirSync(path.dirname(localDbPath), { recursive: true });
  fs.writeFileSync(localDbPath, JSON.stringify(allData, null, 2), 'utf8');
  console.log(`💾 Saved updated local D1 database: ${localDbPath}`);

  // 4. Generate SQL batches for Remote Cloudflare D1
  const outputDir = path.resolve('data_exports');
  fs.mkdirSync(outputDir, { recursive: true });

  const batchFiles = [];
  let currentSql = `-- Cloudflare D1 Full Batch Sync\n`;
  currentSql += `CREATE TABLE IF NOT EXISTS firestore_documents (\n`;
  currentSql += `  collection_name TEXT NOT NULL,\n`;
  currentSql += `  document_id TEXT NOT NULL,\n`;
  currentSql += `  data JSON NOT NULL,\n`;
  currentSql += `  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n`;
  currentSql += `  PRIMARY KEY (collection_name, document_id)\n`;
  currentSql += `);\n\n`;

  let currentStmtCount = 0;
  let batchIndex = 1;
  const STATEMENTS_PER_BATCH = 400; // Keep within D1 batch execute limits

  for (const [colName, docs] of Object.entries(allData)) {
    for (const doc of docs) {
      const docId = String(doc.id || `doc_${Date.now()}`);
      const jsonStr = JSON.stringify(doc).replace(/'/g, "''");
      const safeCol = colName.replace(/'/g, "''");
      const safeId = docId.replace(/'/g, "''");

      currentSql += `INSERT OR REPLACE INTO firestore_documents (collection_name, document_id, data) VALUES ('${safeCol}', '${safeId}', '${jsonStr}');\n`;
      currentStmtCount++;

      if (currentStmtCount >= STATEMENTS_PER_BATCH) {
        const batchFileName = `d1-migration-batch-${batchIndex}.sql`;
        const batchFilePath = path.join(outputDir, batchFileName);
        fs.writeFileSync(batchFilePath, currentSql, 'utf8');
        batchFiles.push(batchFilePath);
        console.log(`📦 Created SQL batch ${batchIndex} (${currentStmtCount} rows): ${batchFileName}`);
        
        batchIndex++;
        currentStmtCount = 0;
        currentSql = `-- Cloudflare D1 Batch ${batchIndex}\n`;
      }
    }
  }

  if (currentStmtCount > 0) {
    const batchFileName = `d1-migration-batch-${batchIndex}.sql`;
    const batchFilePath = path.join(outputDir, batchFileName);
    fs.writeFileSync(batchFilePath, currentSql, 'utf8');
    batchFiles.push(batchFilePath);
    console.log(`📦 Created SQL batch ${batchIndex} (${currentStmtCount} rows): ${batchFileName}`);
  }

  // 5. Execute Remote D1 sync using Wrangler
  console.log(`\n⚡ Syncing ${batchFiles.length} batch files to Remote Cloudflare D1 (estatecare)...`);
  let successCount = 0;
  for (let i = 0; i < batchFiles.length; i++) {
    const bPath = batchFiles[i];
    console.log(`⏳ Executing batch ${i + 1}/${batchFiles.length}...`);
    try {
      execSync(`npx wrangler d1 execute estatecare --remote --file="${bPath}" --yes`, {
        stdio: 'pipe',
        encoding: 'utf8'
      });
      successCount++;
      console.log(`✅ Batch ${i + 1}/${batchFiles.length} applied successfully to Cloudflare D1.`);
    } catch (execErr) {
      console.warn(`⚠️ Batch ${i + 1} remote execution note: ${execErr.message}`);
    }
  }

  console.log(`\n🎉 Full Sync Finished: ${successCount}/${batchFiles.length} batches sent to Cloudflare D1.`);
  console.log(`📊 Local D1 Database (data/cpc-d1-database.json) is fully up-to-date with ${totalDocs} documents across ${Object.keys(allData).length} collections.`);
}

syncAllFirestoreToD1().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
