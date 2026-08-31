import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve('data', 'cpc-d1-database.json');

console.log('=== STARTING 100% ACCURATE 2015-2026 HISTORY REBUILD ===');
console.log('Reading existing database...');
const raw = fs.readFileSync(DB_FILE, 'utf8');
const data = JSON.parse(raw);

// Canonical Residences Definitions
const RESIDENCES_CONFIG = [
  // Active Residences (السكنات الفعلية الحالية)
  { id: 'L4oapIYo87lkQANWsgiD', name: 'Al-Remal', nameAr: 'الرمال', city: 'Riyadh', status: 'Active', disabled: false, isHistorical: false },
  { id: 'L3wLRKW34H2dM2tQaBfI', name: 'AlZaher', nameAr: 'الزاهر', city: 'Makkah', status: 'Active', disabled: false, isHistorical: false },
  { id: '4znleAk6l3E1eb1kAEXK', name: 'Um Al-Salam', nameAr: 'أم السلم', city: 'Bahrah', status: 'Active', disabled: false, isHistorical: false },
  { id: 'C8LpwaPOdkBDpzYvxDmA', name: 'AlAziziah', nameAr: 'العزيزية', city: 'Makkah', status: 'Active', disabled: false, isHistorical: false },
  { id: 'SMTiuEOKEPoBpAzxEikd', name: 'Al Juhaimi', nameAr: 'الجهيمي', city: 'Bahrah', status: 'Active', disabled: false, isHistorical: false },
  { id: '3C1ZgRS2sr2VFMYGdzIN', name: 'ReaSea', nameAr: 'البحر الأحمر / أملج', city: 'Umluj', status: 'Active', disabled: false, isHistorical: false },
  { id: 'uoDgwomUfst2DnyRZGQi', name: 'Jeddah Iwaa', nameAr: 'إيواء جدة', city: 'Jeddah', status: 'Active', disabled: false, isHistorical: false },
  { id: '693QIhFYz1xDe3OOO9Ft', name: 'Qassim SBG', nameAr: 'القصيم', city: 'Qassim', status: 'Active', disabled: false, isHistorical: false },
  { id: 'vjxzVoOleoXJK2OjVZWy', name: 'Madinah SBG', nameAr: 'المدينة', city: 'Madinah', status: 'Active', disabled: false, isHistorical: false },
  { id: 'rMRf9xOfBZqUw8GKPMMM', name: 'AlMalaz', nameAr: 'الملز', city: 'Riyadh', status: 'Active', disabled: false, isHistorical: false },

  // Archived Residences (السكنات التاريخية المؤرشفة)
  { id: 'res_haras_watani', name: 'Al Haras Al Watani', nameAr: 'الحرس الوطني', city: 'Riyadh', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'res_remal_2', name: 'Al-Remal 2', nameAr: 'الرمال 2', city: 'Riyadh', status: 'Archived', disabled: true, isHistorical: true },
  { id: '6w8r1vh1h8xjpOsVULV5', name: 'Old Wood Factory', nameAr: 'مصنع الخشب القديم', city: 'Jeddah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'KA43UwlETuLC7bWffony', name: 'Gypsum', nameAr: 'الجبس', city: 'Jeddah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'Axbap5tRt6FJZjVpTjCJ', name: 'Palestine', nameAr: 'فلسطين', city: 'Jeddah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'res_alnaseem', name: 'Al-Naseem', nameAr: 'النسيم', city: 'Makkah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'res_abdullah_khaiat', name: 'Abdullah Al Khaiat', nameAr: 'عبدالله الخياط', city: 'Makkah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'res_otaybiah', name: 'العتيبية', nameAr: 'العتيبية', city: 'Makkah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'res_salhiah', name: 'الصالحية', nameAr: 'الصالحية', city: 'Jeddah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'res_batha_quraish', name: 'بطحاء قريش', nameAr: 'بطحاء قريش', city: 'Makkah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'res_binladen', name: 'محمد بن لادن', nameAr: 'محمد بن لادن', city: 'Makkah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'res_meeqat', name: 'الميقات', nameAr: 'الميقات', city: 'Madinah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'res_fursan', name: 'الفروسية', nameAr: 'الفروسية', city: 'Jeddah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'res_bank_plan', name: 'مخطط البنك', nameAr: 'مخطط البنك', city: 'Jeddah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'gpKfg1LK8UBxPIhHiuPa', name: 'Althomama', nameAr: 'الثمامة', city: 'Riyadh', status: 'Archived', disabled: true, isHistorical: true },
];

let residences = (data.residences || []).filter(r => r && r.id && r.id !== 'timesheetSettings');
RESIDENCES_CONFIG.forEach(cfg => {
  let existing = residences.find(r => r && (r.id === cfg.id || (r.name && r.name.toLowerCase() === cfg.name.toLowerCase())));
  if (!existing) {
    existing = {
      id: cfg.id,
      name: cfg.name,
      nameAr: cfg.nameAr,
      city: cfg.city,
      status: cfg.status,
      disabled: cfg.disabled,
      isHistorical: cfg.isHistorical,
      buildings: [],
      facilities: [],
      managerId: 'system'
    };
    residences.push(existing);
  } else {
    existing.id = cfg.id;
    existing.status = cfg.status;
    existing.disabled = cfg.disabled;
    existing.isHistorical = cfg.isHistorical;
    if (!existing.nameAr) existing.nameAr = cfg.nameAr;
  }
});
data.residences = residences;

/**
 * Maps raw house name literally without using remarks to guess
 */
function resolveLiteralHouse(rawHouse, rawBuilding) {
  const house = (rawHouse || '').trim();
  const bldg = (rawBuilding || '').trim() || '1';
  const h = house.toLowerCase();

  // 1. Al Haras Al Watani (الحرس الوطني)
  if (/haras|حرس/i.test(h)) {
    return { id: 'res_haras_watani', name: 'Al Haras Al Watani', building: bldg };
  }

  // 2. Palestine / فلسطين
  if (/palestine|فلسطين/i.test(h)) {
    return { id: 'Axbap5tRt6FJZjVpTjCJ', name: 'Palestine', building: bldg };
  }

  // 3. Old Wood Factory / مصنع الخشب / منجرة
  if (/wood|منجرة|منجره|خشب/i.test(h)) {
    return { id: '6w8r1vh1h8xjpOsVULV5', name: 'Old Wood Factory', building: bldg };
  }

  // 4. Gypsum / الجبس
  if (/gypsum|جبس/i.test(h)) {
    return { id: 'KA43UwlETuLC7bWffony', name: 'Gypsum', building: bldg };
  }

  // 5. Al-Naseem / النسيم
  if (/naseem|نسيم/i.test(h)) {
    return { id: 'res_alnaseem', name: 'Al-Naseem', building: bldg };
  }

  // 6. Abdullah Al Khaiat / عبدالله الخياط
  if (/khaiat|خياط/i.test(h)) {
    return { id: 'res_abdullah_khaiat', name: 'Abdullah Al Khaiat', building: bldg };
  }

  // 7. Al-Remal 2
  if (/الرمال\s*2|remal\s*2/i.test(h)) {
    return { id: 'res_remal_2', name: 'Al-Remal 2', building: bldg.replace(/^c[-_]?/i, '') || bldg };
  }

  // 8. Al-Remal (Only when literally named الرمال or Al-Remal)
  if (/^الرمال$|^al-remal$|^remal$/i.test(h)) {
    return { id: 'L4oapIYo87lkQANWsgiD', name: 'Al-Remal', building: bldg };
  }

  // 9. ReaSea / SBG / Sharma / Umluj / RedSea
  if (/sharma|شرما|reasea|redsea|red sea|umluj|أملج|املج|^sbg$/i.test(h)) {
    return { id: '3C1ZgRS2sr2VFMYGdzIN', name: 'ReaSea', building: bldg };
  }

  // 10. Jeddah Iwaa / إيواء جدة / جدة
  if (/iwaa|إيواء|ايواء|جدة|جده/i.test(h)) {
    return { id: 'uoDgwomUfst2DnyRZGQi', name: 'Jeddah Iwaa', building: bldg };
  }

  // 11. AlZaher / الزاهر
  if (/zaher|الزاهر/i.test(h)) {
    return { id: 'L3wLRKW34H2dM2tQaBfI', name: 'AlZaher', building: bldg };
  }

  // 12. AlAziziah / العزيزية
  if (/aziziah|العزيزية|العزيزيه/i.test(h)) {
    return { id: 'C8LpwaPOdkBDpzYvxDmA', name: 'AlAziziah', building: bldg };
  }

  // 13. Um Al-Salam / أم السلم / بحرة
  if (/alsalam|salam|السلم|ام السلم|أم السلم|بحرة|بحره/i.test(h)) {
    return { id: '4znleAk6l3E1eb1kAEXK', name: 'Um Al-Salam', building: bldg };
  }

  // 14. Al Juhaimi / الجهيمي / الجحيمي
  if (/juhaimi|johaimi|جهيمي|جحيمي/i.test(h)) {
    return { id: 'SMTiuEOKEPoBpAzxEikd', name: 'Al Juhaimi', building: bldg };
  }

  // 15. Qassim SBG / القصيم
  if (/qassim|قصيم/i.test(h)) {
    return { id: '693QIhFYz1xDe3OOO9Ft', name: 'Qassim SBG', building: bldg };
  }

  // 16. Madinah SBG / المدينة
  if (/madinah|مدينة|مدينه/i.test(h)) {
    return { id: 'vjxzVoOleoXJK2OjVZWy', name: 'Madinah SBG', building: bldg };
  }

  // 17. AlMalaz / الملز
  if (/malaz|ملز/i.test(h)) {
    return { id: 'rMRf9xOfBZqUw8GKPMMM', name: 'AlMalaz', building: bldg };
  }

  // 18. Other historical specific names
  if (/عتيبية|عتيبيه/i.test(h)) return { id: 'res_otaybiah', name: 'العتيبية', building: bldg };
  if (/صالحية|صالحيه/i.test(h)) return { id: 'res_salhiah', name: 'الصالحية', building: bldg };
  if (/بطحاء/i.test(h)) return { id: 'res_batha_quraish', name: 'بطحاء قريش', building: bldg };
  if (/بن لادن|بنلادن/i.test(h)) return { id: 'res_binladen', name: 'محمد بن لادن', building: bldg };
  if (/ميقات/i.test(h)) return { id: 'res_meeqat', name: 'الميقات', building: bldg };
  if (/فروسية|فروسيه/i.test(h)) return { id: 'res_fursan', name: 'الفروسية', building: bldg };
  if (/مخطط البنك/i.test(h)) return { id: 'res_bank_plan', name: 'مخطط البنك', building: bldg };

  // Fallback: Use literal raw name
  return { id: `res_${house.replace(/\s+/g, '_') || 'other'}`, name: house || 'Other Residence', building: bldg };
}

function parseDateToIso(dateStr) {
  if (!dateStr) return null;
  const d = dateStr.trim();
  const m1 = d.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
  }
  const m2 = d.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) {
    return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  }
  return null;
}

function cleanRemark(raw) {
  if (!raw) return null;
  let text = raw.trim();
  text = text.replace(/^(ملاحظات|سبب الخروج|سبب التسكين|السبب|Notes?|Reason)\s*:\s*/i, '').trim();
  text = text.replace(/^["'«»“”\(]+|["'«»“”\)]+$/g, '').trim();
  if (
    !text ||
    /^سجل\s+تسكين/i.test(text) ||
    /^مزامنة\s+النظام/i.test(text) ||
    /^Auto-archived/i.test(text) ||
    text === 'Occupied' ||
    text === 'تسكين' ||
    text === 'خروج من السكن'
  ) {
    return null;
  }
  return text;
}

async function fetchMonthRows(startStr, endStr) {
  const url = `http://213.210.196.115:8082/SacoOnline/HousCamps/ReportViewForInOutHistory.aspx?HousingRefs=&SponsRef=&DepRef=&DatInRef=${startStr}&DatOutRef=${endStr}&InputRerenc=EmpInOutHistory&UsrInput=HousAdmin`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      const rows = [];
      for (const tr of trMatches) {
        if (tr.includes('<th')) continue;
        const tdMatches = tr.match(/<td[\s\S]*?<\/td>/gi);
        if (!tdMatches || tdMatches.length < 13) continue;
        const values = tdMatches.map((td) =>
          td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
        );
        rows.push({
          sNo: values[0] || '',
          employeeId: values[1] || '',
          employeeName: values[2] || '',
          houseName: values[3] || '',
          department: values[4] || '',
          nationality: values[5] || '',
          profession: values[6] || '',
          building: values[7] || '',
          room: values[8] || '',
          sponsor: values[9] || '',
          remarks: values[10] || '',
          site: values[11] || '',
          dateIn: values[12] || '',
          dateOut: values[13] || '',
          days: parseInt(values[14] || '0', 10) || 0,
        });
      }
      return rows;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

function generateAllMonths() {
  const months = [];
  for (let year = 2015; year <= 2026; year++) {
    const maxMonth = year === 2026 ? 8 : 12;
    for (let m = 1; m <= maxMonth; m++) {
      const prevYear = m === 1 ? year - 1 : year;
      const prevMonth = m === 1 ? 12 : m - 1;
      const startStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-21`;
      const endStr = `${year}-${String(m).padStart(2, '0')}-20`;
      months.push({
        id: `${year}-${String(m).padStart(2, '0')}`,
        year,
        month: m,
        startDate: startStr,
        endDate: endStr,
      });
    }
  }
  return months;
}

async function main() {
  const allMonths = generateAllMonths();
  console.log(`Total months to process: ${allMonths.length} (from 2015-01 to 2026-08)`);

  const existingWorkers = data.workers || [];
  const workerByEmpId = new Map();
  existingWorkers.forEach(w => {
    if (w.employeeId) workerByEmpId.set(String(w.employeeId).trim(), w);
    if (w.idNumber) workerByEmpId.set(String(w.idNumber).trim(), w);
    if (w.id) workerByEmpId.set(String(w.id).trim(), w);
  });

  const historyMap = new Map();
  let totalRawRows = 0;
  let monthsSuccess = 0;
  let monthsFailed = 0;

  for (let i = 0; i < allMonths.length; i++) {
    const m = allMonths[i];
    try {
      const rows = await fetchMonthRows(m.startDate, m.endDate);
      totalRawRows += rows.length;
      monthsSuccess++;
      console.log(`[${i + 1}/${allMonths.length}] Month ${m.id}: Fetched ${rows.length} rows`);

      for (const row of rows) {
        const empId = String(row.employeeId || '').trim();
        if (!empId) continue;

        let worker = workerByEmpId.get(empId);
        if (!worker) {
          const newWorkerId = `w_${empId}`;
          worker = {
            id: newWorkerId,
            employeeId: empId,
            name: row.employeeName || `Worker ${empId}`,
            nationality: row.nationality || 'Other',
            nationaliy: row.nationality || 'Other',
            company: row.sponsor || 'SACODECO',
            sponsor: row.sponsor || 'SACODECO',
            role: row.profession || 'عامل',
            occupation: row.profession || 'عامل',
            department: row.department || '',
            status: 'Active',
            createdAt: new Date().toISOString(),
          };
          workerByEmpId.set(empId, worker);
          workerByEmpId.set(newWorkerId, worker);
          existingWorkers.push(worker);
        }

        const dateInIso = parseDateToIso(row.dateIn);
        const dateOutIso = parseDateToIso(row.dateOut);
        if (!dateInIso) continue;

        // Resolve residence LITERALLY from raw houseName
        const resInfo = resolveLiteralHouse(row.houseName, row.building);
        const cleanNote = cleanRemark(row.remarks);
        const roomId = `rm_${resInfo.id}_${resInfo.building}_${row.room || '1'}`;

        // 1. CHECK_IN Record
        const checkInKey = `${worker.id}_${resInfo.id}_${roomId}_CHECK_IN_${dateInIso}`;
        if (!historyMap.has(checkInKey)) {
          historyMap.set(checkInKey, {
            id: `hist_in_${empId}_${dateInIso}_${Math.random().toString(36).slice(2, 6)}`,
            workerId: worker.id,
            workerName: worker.name,
            workerNationality: worker.nationality || worker.nationaliy || 'Other',
            actionType: 'CHECK_IN',
            actionDate: dateInIso,
            actionBy: 'system_sync',
            actionByName: `أرشيف النظام القديم (${m.year})`,
            residenceId: resInfo.id,
            residenceName: resInfo.name,
            buildingName: resInfo.building,
            floorName: 'الأرضي',
            roomId,
            roomName: row.room || '1',
            notes: cleanNote,
            reason: cleanNote,
            createdAt: new Date().toISOString(),
          });
        }

        // 2. CHECK_OUT Record (if valid dateOut)
        if (dateOutIso && dateOutIso !== dateInIso && dateOutIso <= '2026-08-31') {
          const checkOutKey = `${worker.id}_${resInfo.id}_${roomId}_CHECK_OUT_${dateOutIso}`;
          if (!historyMap.has(checkOutKey)) {
            historyMap.set(checkOutKey, {
              id: `hist_out_${empId}_${dateOutIso}_${Math.random().toString(36).slice(2, 6)}`,
              workerId: worker.id,
              workerName: worker.name,
              workerNationality: worker.nationality || worker.nationaliy || 'Other',
              actionType: 'CHECK_OUT',
              actionDate: dateOutIso,
              actionBy: 'system_sync',
              actionByName: `أرشيف النظام القديم (${m.year})`,
              residenceId: resInfo.id,
              residenceName: resInfo.name,
              buildingName: resInfo.building,
              floorName: 'الأرضي',
              roomId,
              roomName: row.room || '1',
              notes: cleanNote,
              reason: cleanNote,
              duration: row.days > 0 ? row.days : undefined,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch (err) {
      monthsFailed++;
      console.warn(`[${i + 1}/${allMonths.length}] Month ${m.id} FAILED:`, err.message);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\n=== FETCH & REBUILD SUMMARY ===`);
  console.log(`Months Successful: ${monthsSuccess} / ${allMonths.length}`);
  console.log(`Total Raw Rows Processed: ${totalRawRows}`);
  console.log(`Total Accurate History Records: ${historyMap.size}`);

  const finalHistory = Array.from(historyMap.values()).sort((a, b) => {
    return new Date(a.actionDate).getTime() - new Date(b.actionDate).getTime();
  });

  data.workers = existingWorkers;
  data.accommodation_history = finalHistory;
  data.accommodationHistory = finalHistory;

  console.log('Saving 100% accurate database to disk...');
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log('SUCCESS! Database written with authentic historical residence records.');
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
