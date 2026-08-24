import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const APPLY = process.argv.includes("--apply");
const CONTRACTS_FILE = "C:/Users/abdal/.gemini/antigravity-ide/brain/f72677f6-4b65-4c5d-8793-16f6a6a33896/scratch/deduplicated_contracts.json";

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

  if (!fs.existsSync(CONTRACTS_FILE)) {
    console.error(`Contracts file not found: ${CONTRACTS_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(CONTRACTS_FILE, "utf-8");
  const extractedContracts = JSON.parse(raw);

  console.log(`Loaded ${extractedContracts.length} extracted contracts from disk.`);

  // Get current residences from Firestore to ensure exact matching
  const resSnap = await db.collection("residences").get();
  const residencesMap = new Map<string, string>(); // name_substring -> docId
  resSnap.docs.forEach((d) => {
    const data = d.data();
    const name = (data.name || "").trim();
    if (name) {
      residencesMap.set(name, d.id);
    }
  });

  console.log(`Matched with ${resSnap.size} residences in Firestore.`);

  const nowIso = new Date().toISOString();
  const recordsToInsert: Array<{ id: string; data: any }> = [];

  for (const c of extractedContracts) {
    // Match linked residence
    const matchedResidenceIds: string[] = [];
    const matchedResidenceNames: string[] = [];

    for (const [rname, rid] of residencesMap.entries()) {
      const shortName = rname.replace("سكن", "").replace("مجمع", "").trim();
      const contractContext = `${c.title} ${c.partyName} ${c.notes || ""}`;
      if (contractContext.includes(shortName) || (c.linkedResidenceNames && c.linkedResidenceNames[0] && c.linkedResidenceNames[0].includes(shortName))) {
        matchedResidenceIds.push(rid);
        matchedResidenceNames.push(rname);
        break;
      }
    }

    const docId = `imported_${c.contractNumber.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase()}_${Math.random().toString(36).substring(2, 6)}`;

    const payload = {
      id: docId,
      contractNumber: c.contractNumber,
      title: c.title,
      contractCategory: c.contractCategory,
      contractType: c.contractType,
      partyType: c.partyType || "company",
      partyId: c.partyId || "imported_party",
      partyName: c.partyName,
      partyContact: "",
      partyPhone: "",
      partyEmail: "",
      linkedResidences: matchedResidenceIds.length > 0 ? matchedResidenceIds : (c.linkedResidences || []),
      linkedResidenceNames: matchedResidenceNames.length > 0 ? matchedResidenceNames : (c.linkedResidenceNames || []),
      startDate: c.startDate,
      endDate: c.endDate,
      isOpenEnded: c.isOpenEnded || false,
      billingType: c.billingType,
      billingRate: Number(c.billingRate) || 0,
      vatPercentage: Number(c.vatPercentage) || 15,
      vatAmount: Math.round((Number(c.billingRate) * 0.15) * 100) / 100,
      totalAmount: Math.round((Number(c.billingRate) * 1.15) * 100) / 100,
      billingUnit: c.billingUnit || "شهري",
      renewalType: c.renewalType || "manual",
      autoRenew: c.autoRenew || false,
      noticePeriodDays: c.noticePeriodDays || 30,
      renewalCount: 0,
      status: c.status || "Active",
      isAddendum: c.isAddendum || false,
      attachments: c.associatedFiles ? c.associatedFiles.map((f: string) => `/contracts/${f}`) : [],
      notes: c.notes || "",
      createdAt: nowIso,
      updatedAt: nowIso,
      importedAt: nowIso,
      source: "contract_files_import"
    };

    recordsToInsert.push({ id: docId, data: payload });
  }

  console.log(`\nPrepared ${recordsToInsert.length} contracts for import.`);

  if (!APPLY) {
    console.log("\n[DRY RUN MODE] No changes were written to Firestore.");
    console.log("Run with --apply to commit records to contractsV2.");
    
    // Sample print
    console.log("\nSample 3 records:");
    console.log(JSON.stringify(recordsToInsert.slice(0, 3), null, 2));
    return;
  }

  // Batch insert into Firestore (chunks of 400)
  let committed = 0;
  for (let i = 0; i < recordsToInsert.length; i += 400) {
    const chunk = recordsToInsert.slice(i, i + 400);
    const batch = db.batch();
    for (const item of chunk) {
      const ref = db.collection("contractsV2").doc(item.id);
      batch.set(ref, item.data, { merge: true });
    }
    await batch.commit();
    committed += chunk.length;
    console.log(`Committed ${committed}/${recordsToInsert.length} to contractsV2...`);
  }

  console.log(`\n🎉 Successfully imported ${committed} contracts into contractsV2!`);
}

main().catch(console.error);
