import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve('data', 'cpc-d1-database.json');

console.log('Loading database...');
const raw = fs.readFileSync(DB_FILE, 'utf8');
const data = JSON.parse(raw);

const resMap = {
  palestine: { id: 'Axbap5tRt6FJZjVpTjCJ', name: 'Palestine' },
  old_wood: { id: '6w8r1vh1h8xjpOsVULV5', name: 'Old Wood Factory' },
  gypsum: { id: 'KA43UwlETuLC7bWffony', name: 'Gypsum' },
  reasea: { id: '3C1ZgRS2sr2VFMYGdzIN', name: 'ReaSea' },
  iwaa: { id: 'uoDgwomUfst2DnyRZGQi', name: 'Jeddah Iwaa' },
  zaher: { id: 'L3wLRKW34H2dM2tQaBfI', name: 'AlZaher' },
  aziziah: { id: 'C8LpwaPOdkBDpzYvxDmA', name: 'AlAziziah' },
  salam: { id: '4znleAk6l3E1eb1kAEXK', name: 'Um Al-Salam' },
  juhaimi: { id: 'SMTiuEOKEPoBpAzxEikd', name: 'Al Juhaimi' },
  qassim: { id: '693QIhFYz1xDe3OOO9Ft', name: 'Qassim SBG' },
  madinah: { id: 'vjxzVoOleoXJK2OjVZWy', name: 'Madinah SBG' },
  malaz: { id: 'rMRf9xOfBZqUw8GKPMMM', name: 'AlMalaz' },
  remal2: { id: 'res_remal_2', name: 'Al-Remal 2' },
  remal: { id: 'L4oapIYo87lkQANWsgiD', name: 'Al-Remal' },
};

function detectTargetResidence(note) {
  if (!note) return null;
  const n = note.toLowerCase();

  // 1. Palestine / فلسطين
  if (/فلسطين/i.test(n)) return resMap.palestine;

  // 2. Old Wood Factory / منجرة / مصنع الخشب
  if (/منجرة|منجره|خشب/i.test(n)) return resMap.old_wood;

  // 3. Gypsum / جبس
  if (/جبس|gypsum/i.test(n)) return resMap.gypsum;

  // 4. ReaSea / أملج / شرما
  if (/املج|أملج|شرما|redsea|reasea/i.test(n)) return resMap.reasea;

  // 5. Jeddah Iwaa / جدة / جدة المطار / إيواء
  if (/جدة المطار|جده المطار|إيواء جدة|ايواء جدة|إيواء|ايواء|iwaa|جدة|جده/i.test(n)) return resMap.iwaa;

  // 6. AlZaher / مكة المكرمة / الزاهر
  if (/مكة|مكه|zaher|الزاهر/i.test(n)) return resMap.zaher;

  // 7. AlAziziah / العزيزية
  if (/عزيزية|عزيزيه|aziziah/i.test(n)) return resMap.aziziah;

  // 8. Um Al-Salam / بحرة / أم السلم
  if (/بحرة|بحره|أم السلم|ام السلم/i.test(n)) return resMap.salam;

  // 9. Al Juhaimi / الجحيمي
  if (/جحيمي|جهيمي|juhaimi/i.test(n)) return resMap.juhaimi;

  // 10. Qassim / القصيم
  if (/قصيم|qassim/i.test(n)) return resMap.qassim;

  // 11. Madinah / المدينة
  if (/مدينة|مدينه|madinah/i.test(n)) return resMap.madinah;

  // 12. AlMalaz / الملز
  if (/ملز|malaz/i.test(n)) return resMap.malaz;

  // 13. Remal 2 / الرمال 2
  if (/الرمال\s*2|remal\s*2/i.test(n)) return resMap.remal2;

  // 14. Riyadh / Al-Remal / الحرس
  if (/الرياض|رياض|حرس|الحرس|الرمال/i.test(n)) return resMap.remal;

  return null;
}

let correctedHistory = 0;

['accommodation_history', 'accommodationHistory'].forEach(colName => {
  if (Array.isArray(data[colName])) {
    data[colName].forEach(h => {
      const detected = detectTargetResidence(h.notes || h.reason);
      if (detected) {
        // If current residence was default Al-Remal or missing and detected something specific
        if (!h.residenceName || h.residenceName === 'NO_NAME' || h.residenceName === 'Al-Remal' || !h.residenceId) {
          if (detected.name !== h.residenceName || detected.id !== h.residenceId) {
            h.residenceId = detected.id;
            h.residenceName = detected.name;
            correctedHistory++;
          }
        }
      }
    });
  }
});

console.log(`Successfully corrected ${correctedHistory} historical accommodation records to their true residences!`);

fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('Saved to', DB_FILE);
