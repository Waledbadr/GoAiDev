import fs from 'fs';

const raw = fs.readFileSync('data/cpc-d1-database.json', 'utf8');
const db = JSON.parse(raw);
const workers = db.workers || [];
const occupants = db.occupants || [];

console.log(`Total workers in D1: ${workers.length}`);
console.log(`Total occupants in D1: ${occupants.length}`);

// Sample of workers
console.log('\nSample worker 1:', workers[0]);
console.log('Sample worker 2:', workers[1]);
console.log('Sample worker 100:', workers[100]);

const byId = new Map();
const byEmpId = new Map();
const byIdNumber = new Map();
const byKey = new Map();

let withoutEmpOrIdNum = 0;

workers.forEach((w, idx) => {
  const empId = String(w.employeeId || '').trim();
  const idNum = String(w.idNumber || '').trim();
  const name = String(w.name || '').trim().toLowerCase();
  const company = String(w.company || w.sponsor || '').trim().toLowerCase();

  let key = '';
  if (idNum && idNum.length >= 6) {
    key = `ID:${idNum}`;
  } else if (empId) {
    key = `EMP:${company}:${empId}`;
  } else if (name) {
    key = `NAME:${company}:${name}`;
  } else {
    withoutEmpOrIdNum++;
    key = `INDEX:${idx}:${w.id}`;
  }

  if (!byKey.has(key)) {
    byKey.set(key, []);
  }
  byKey.get(key).push(w);
});

console.log('\n--- D1 Workers Deduplication Analysis ---');
console.log(`Total Records: ${workers.length}`);
console.log(`Unique Real Workers: ${byKey.size}`);
console.log(`Duplicate entries to remove: ${workers.length - byKey.size}`);
console.log(`Workers without valid ID/EmpID: ${withoutEmpOrIdNum}`);

// Top duplicated keys
const dupes = Array.from(byKey.entries())
  .filter(([_, list]) => list.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

console.log(`\nFound ${dupes.length} groups of duplicated workers.`);
console.log('Top 10 duplicated worker records:');
dupes.slice(0, 10).forEach(([k, list]) => {
  console.log(`Key: ${k} -> Duplicated ${list.length} times. Sample Name: "${list[0].name}" IDs: ${list.slice(0, 3).map(x => x.id).join(', ')}...`);
});
