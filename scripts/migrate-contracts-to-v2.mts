/**
 * Migrate the legacy `contracts` collection into `contractsV2`.
 *
 * The legacy model carries a single monthly rate and one residence; the V2
 * model carries a typed contract with the rate in its agreed unit. Accommodation
 * is billed per person per day, so the monthly figure is converted back to the
 * daily rate it always represented (see NOMINAL_DAYS_PER_MONTH).
 *
 * Documents keep their legacy id, so an invoice referencing `contractId` lines
 * up across both collections during the parallel-run period, and re-running the
 * migration overwrites rather than duplicates.
 *
 * DRY RUN BY DEFAULT — prints the plan and writes nothing. Pass --apply to write.
 *
 *   npm run migrate:contracts             # dry run
 *   npm run migrate:contracts -- --apply  # write
 */
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { planContractMigration } from "../src/lib/contract-migration";

try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });
  dotenv.config();
} catch {}

const APPLY = process.argv.includes("--apply");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error("Missing Firebase config. Populate .env.local before running.");
  process.exit(1);
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (email && password) {
  await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as ${email}`);
} else {
  console.warn("ADMIN_EMAIL / ADMIN_PASSWORD not set — relying on open read rules.");
}

// The legacy contract shape, the 'all' sentinel, the rate conversion and the
// safety checks all live in src/lib/contract-migration.ts alongside the planner.

const [legacySnap, companiesSnap, residencesSnap, v2Snap] = await Promise.all([
  getDocs(collection(db, "contracts")),
  getDocs(collection(db, "companies")),
  getDocs(collection(db, "residences")),
  getDocs(collection(db, "contractsV2")),
]);

const companies = new Map(companiesSnap.docs.map((d) => [d.id, d.data() as { name?: string }]));
const residenceNames = new Map(residencesSnap.docs.map((d) => [d.id, (d.data() as { name?: string }).name]));
const allResidenceIds = residencesSnap.docs.map((d) => d.id);
const alreadyMigrated = new Set(v2Snap.docs.map((d) => d.id));

console.log(
  `\nFound ${legacySnap.size} legacy contracts, ${companies.size} companies, ` +
    `${allResidenceIds.length} residences, ${v2Snap.size} existing contractsV2.\n`
);

// The plan itself lives in a shared pure module, so this script and the in-app
// migration preview cannot drift apart: what the preview shows is what a script
// run would write.
const plan = planContractMigration({
  legacyContracts: legacySnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as never,
  companyNames: new Map(companiesSnap.docs.map((d) => [d.id, (d.data() as { name?: string }).name ?? d.id])),
  residenceNames: new Map(residencesSnap.docs.map((d) => [d.id, (d.data() as { name?: string }).name ?? d.id])),
  allResidenceIds,
  existingV2Ids: alreadyMigrated,
});

const planned = plan.items.map((item) => ({ id: item.contractId, payload: item.payload }));
const problems = plan.skips.map((skip) => `${skip.contractId} (${skip.companyName}): ${skip.detailEn}`);

console.log("Planned migrations:\n");
for (const { id, payload } of planned) {
  const flag = alreadyMigrated.has(id) ? "OVERWRITE" : "NEW      ";
  console.log(
    `  ${flag} ${id}  ${String(payload.partyName).slice(0, 30).padEnd(30)} ` +
      `${Number(payload.billingRate).toFixed(2)} SAR/day  ` +
      `${(payload.linkedResidences as string[]).length} residence(s)`
  );
}

if (problems.length) {
  console.log(`\nSkipped ${problems.length}:\n`);
  for (const problem of problems) console.log(`  - ${problem}`);
}

console.log(`\n${planned.length} to write, ${problems.length} skipped.`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to commit.\n");
  process.exit(0);
}

// Firestore caps a batch at 500 operations.
let written = 0;
for (let i = 0; i < planned.length; i += 400) {
  const chunk = planned.slice(i, i + 400);
  const batch = writeBatch(db);
  for (const { id, payload } of chunk) {
    batch.set(doc(db, "contractsV2", id), payload, { merge: true });
  }
  await batch.commit();
  written += chunk.length;
  console.log(`Committed ${written}/${planned.length}`);
}

console.log(`\nDone. ${written} contracts written to contractsV2.\n`);
process.exit(0);
