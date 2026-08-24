import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config({ path: ".env.local" });
dotenv.config();

function initAdmin() {
  if (admin.apps.length > 0) return admin.app();
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (privateKey && privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  const [resSnap, compSnap, v2Snap] = await Promise.all([
    db.collection("residences").get(),
    db.collection("companies").get(),
    db.collection("contractsV2").get(),
  ]);

  const residences = resSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name,
    address: d.data().address,
    location: d.data().location,
  }));

  const companies = compSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name,
    code: d.data().code,
  }));

  const existingContracts = v2Snap.docs.map((d) => ({
    id: d.id,
    title: d.data().title,
    contractNumber: d.data().contractNumber,
    partyName: d.data().partyName,
    contractType: d.data().contractType,
    contractCategory: d.data().contractCategory,
    status: d.data().status,
  }));

  const output = {
    residences,
    companies,
    existingContracts,
  };

  fs.writeFileSync(
    "C:/Users/abdal/.gemini/antigravity-ide/brain/f72677f6-4b65-4c5d-8793-16f6a6a33896/scratch/system_entities.json",
    JSON.stringify(output, null, 2),
    "utf-8"
  );

  console.log(`Fetched ${residences.length} residences, ${companies.length} companies, ${existingContracts.length} contractsV2.`);
}

main().catch(console.error);
