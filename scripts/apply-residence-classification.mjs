import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve('data', 'cpc-d1-database.json');

if (!fs.existsSync(DB_FILE)) {
  console.log('Database file not found:', DB_FILE);
  process.exit(1);
}

console.log('Reading database...');
const raw = fs.readFileSync(DB_FILE, 'utf8');
const data = JSON.parse(raw);

// 1. Setup/Update Residences
const activeResidenceIds = new Set([
  'L4oapIYo87lkQANWsgiD', // Al-Remal
  'L3wLRKW34H2dM2tQaBfI', // AlZaher
  '4znleAk6l3E1eb1kAEXK', // Um Al-Salam
  'C8LpwaPOdkBDpzYvxDmA', // AlAziziah
  'SMTiuEOKEPoBpAzxEikd', // Al Juhaimi
  '3C1ZgRS2sr2VFMYGdzIN', // ReaSea (Umluj)
  'uoDgwomUfst2DnyRZGQi', // Jeddah Iwaa
  '693QIhFYz1xDe3OOO9Ft', // Qassim SBG
  'vjxzVoOleoXJK2OjVZWy', // Madinah SBG
  'rMRf9xOfBZqUw8GKPMMM', // AlMalaz
]);

const archivedResidenceIds = new Set([
  '6w8r1vh1h8xjpOsVULV5', // Old Wood Factory
  'KA43UwlETuLC7bWffony', // Gypsum
  'Axbap5tRt6FJZjVpTjCJ', // Palestine
  'DkivDvDBirmX4HIHU3cW', // Test Complex
  'GR3i7DOtAFLazN46D7cB', // Test 2
  'gpKfg1LK8UBxPIhHiuPa', // Althomama
]);

let residences = data.residences || [];

// Ensure Al-Remal 2 exists as an archived residence
let remal2 = residences.find(r => r.id === 'res_remal_2' || r.name === 'Al-Remal 2' || r.name === 'الرمال 2');
if (!remal2) {
  remal2 = {
    id: 'res_remal_2',
    name: 'Al-Remal 2',
    nameAr: 'الرمال 2',
    city: 'Riyadh',
    status: 'Archived',
    disabled: true,
    isHistorical: true,
    buildings: [
      { id: 'bldg_remal_2_c2', name: 'C-2', floors: [] }
    ],
    facilities: [],
    managerId: 'system'
  };
  residences.push(remal2);
} else {
  remal2.status = 'Archived';
  remal2.disabled = true;
  remal2.isHistorical = true;
}

// Update all residences
const resNameMap = new Map();
residences.forEach(r => {
  if (activeResidenceIds.has(r.id)) {
    r.status = 'Active';
    r.disabled = false;
    r.isHistorical = false;
  } else if (archivedResidenceIds.has(r.id) || r.id === 'res_remal_2') {
    r.status = 'Archived';
    r.disabled = true;
    r.isHistorical = true;
  }
  if (r.id && r.name) {
    resNameMap.set(r.id, r.name);
  }
});
resNameMap.set('res_remal_2', 'Al-Remal 2');

data.residences = residences;

// 2. Update accommodation_history & accommodationHistory
let remal2Moved = 0;
let historyNamesFixed = 0;

['accommodation_history', 'accommodationHistory'].forEach(colName => {
  if (Array.isArray(data[colName])) {
    data[colName].forEach(h => {
      // If building is C-2, or room contains C-2, or notes mention الرمال 2
      const isRemal2 =
        h.buildingName === 'C-2' ||
        (h.roomId && (h.roomId.includes('_C-2_') || h.roomId.includes('rm_L4oapIYo87lkQANWsgiD_2_'))) ||
        (h.notes && /الرمال\s*2/i.test(h.notes));

      if (isRemal2 && (h.residenceId === 'L4oapIYo87lkQANWsgiD' || !h.residenceId)) {
        h.residenceId = 'res_remal_2';
        h.residenceName = 'Al-Remal 2';
        remal2Moved++;
      } else if (h.residenceId && resNameMap.has(h.residenceId)) {
        if (!h.residenceName || h.residenceName === 'NO_NAME') {
          h.residenceName = resNameMap.get(h.residenceId);
          historyNamesFixed++;
        }
      }
    });
  }
});

console.log(`Updated residences statuses.`);
console.log(`Reassigned ${remal2Moved} history records to Al-Remal 2 (Archived).`);
console.log(`Fixed ${historyNamesFixed} missing history residence names.`);

fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('Successfully saved to', DB_FILE);
