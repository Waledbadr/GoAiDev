import fs from 'fs';

const raw = fs.readFileSync('data/cpc-d1-database.json', 'utf8');
const db = JSON.parse(raw);
const workers = db.workers || [];

const idPrefixes = {};
const companies = {};
const roles = {};

workers.forEach(w => {
  const pfx = (w.id || '').split('_')[0] || 'none';
  idPrefixes[pfx] = (idPrefixes[pfx] || 0) + 1;

  const comp = w.company || 'Unknown';
  companies[comp] = (companies[comp] || 0) + 1;

  const role = w.role || 'Unknown';
  roles[role] = (roles[role] || 0) + 1;
});

console.log('ID Prefixes:', idPrefixes);
console.log('\nTop Companies:', Object.entries(companies).sort((a,b)=>b[1]-a[1]).slice(0, 15));
console.log('\nRoles:', roles);

// Check sample of workers across different slices
console.log('\nWorkers at index 0-5:', workers.slice(0, 5));
console.log('\nWorkers at index 4090-4095:', workers.slice(4090, 4095));
console.log('\nWorkers at index 10000-10005:', workers.slice(10000, 10005));
console.log('\nWorkers at index 25000-25005:', workers.slice(25000, 25005));
