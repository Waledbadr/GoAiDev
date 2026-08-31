import admin from 'firebase-admin';
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
    return admin.initializeApp({ projectId });
  }
}

async function analyzeWorkers() {
  console.log('🔍 Connecting to Firestore to analyze workers and duplicates...');
  initAdmin();
  const db = admin.firestore();

  // Get total count
  const countSnap = await db.collection('workers').count().get();
  const totalCount = countSnap.data().count;
  console.log(`Total worker docs in Firestore: ${totalCount}`);

  // Fetch in batches / sample or fetch all docs (doc IDs and keys)
  const snap = await db.collection('workers').select('name', 'employeeId', 'idNumber', 'nationaliy', 'company', 'role').get();
  console.log(`Fetched ${snap.docs.length} worker docs.`);

  const byIdNumber = new Map();
  const byEmpIdAndCompany = new Map();
  const byNameAndCompany = new Map();
  const uniqueKeyMap = new Map();

  let missingAllKeys = 0;

  snap.docs.forEach(docSnap => {
    const d = docSnap.data();
    const docId = docSnap.id;
    const name = (d.name || '').trim().toLowerCase();
    const empId = (d.employeeId || '').trim();
    const idNum = (d.idNumber || '').trim();
    const company = (d.company || '').trim().toLowerCase();

    // Determine primary deduplication key
    let dedupKey = '';
    if (idNum && idNum.length >= 6) {
      dedupKey = `ID:${idNum}`;
      byIdNumber.set(idNum, (byIdNumber.get(idNum) || 0) + 1);
    } else if (empId) {
      dedupKey = `EMP:${company}:${empId}`;
      const empKey = `${company}:${empId}`;
      byEmpIdAndCompany.set(empKey, (byEmpIdAndCompany.get(empKey) || 0) + 1);
    } else if (name) {
      dedupKey = `NAME:${company}:${name}`;
      const nameKey = `${company}:${name}`;
      byNameAndCompany.set(nameKey, (byNameAndCompany.get(nameKey) || 0) + 1);
    } else {
      missingAllKeys++;
      dedupKey = `DOC:${docId}`;
    }

    if (!uniqueKeyMap.has(dedupKey)) {
      uniqueKeyMap.set(dedupKey, []);
    }
    uniqueKeyMap.get(dedupKey).push(docId);
  });

  console.log(`\n--- Analysis Results ---`);
  console.log(`Total Documents: ${snap.docs.length}`);
  console.log(`Unique Workers (by key): ${uniqueKeyMap.size}`);
  console.log(`Duplicate Documents to clean up: ${snap.docs.length - uniqueKeyMap.size}`);
  console.log(`Missing all identifiers: ${missingAllKeys}`);

  let duplicatesCount = 0;
  for (const [key, docIds] of uniqueKeyMap.entries()) {
    if (docIds.length > 1) {
      duplicatesCount++;
    }
  }
  console.log(`Number of worker groups with duplicates: ${duplicatesCount}`);
}

analyzeWorkers().catch(console.error);
