import admin from "firebase-admin";
import dotenv from "dotenv";

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

  const docId = "TLciJYTBd9AnUsDxZGCH";
  console.log(`Attaching PDF document to contract ${docId}...`);

  const attachmentPath = "/contracts/rcpco-alrimal-2026.pdf";
  const attachmentFileName = "عقد ايجار سكن افراد - الرمال - شركة رواد المجمعات السكنية 2026 rev2.pdf";

  await db.collection("contractsV2").doc(docId).update({
    attachments: [attachmentPath],
    attachmentUrl: attachmentPath,
    attachmentName: attachmentFileName,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  console.log("✅ PDF Attachment successfully linked to contract in Firestore!");
}

main().catch(console.error);
