import fs from 'fs';

const raw = fs.readFileSync('data/cpc-d1-database.json', 'utf8');
const db = JSON.parse(raw);
const workers = db.workers || [];
const occupants = db.occupants || [];

const activeWorkers = workers.filter(w => w.status === 'Active' || !w.status);
const inactiveWorkers = workers.filter(w => w.status === 'Inactive');

console.log(`Total workers in D1: ${workers.length}`);
console.log(`Active workers: ${activeWorkers.length}`);
console.log(`Inactive workers: ${inactiveWorkers.length}`);

// Check occupants
const activeOccupants = occupants.filter(o => !o.until);
const historicOccupants = occupants.filter(o => !!o.until);
console.log(`Total occupants: ${occupants.length}`);
console.log(`Active occupants (until == null): ${activeOccupants.length}`);
console.log(`Historic occupants (until != null): ${historicOccupants.length}`);

// Check overlap of active occupants with workers
const occupantWorkerIds = new Set(occupants.map(o => o.workerId).filter(Boolean));
console.log(`Distinct workerIds referenced by occupants: ${occupantWorkerIds.size}`);

// Check Firestore workers count vs D1
console.log(`Workers in original active list (Firestore): 4093`);
