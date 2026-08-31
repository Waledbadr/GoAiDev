import fs from 'fs';

const raw = fs.readFileSync('data/cpc-d1-database.json', 'utf8');
const data = JSON.parse(raw);
console.log('--- cpc-d1-database.json collections ---');
for (const [k, v] of Object.entries(data)) {
  console.log(`${k}: ${Array.isArray(v) ? v.length : typeof v}`);
}
