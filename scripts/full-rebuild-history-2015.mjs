import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve('data', 'cpc-d1-database.json');

// Canonical Residence Definitions
const RESIDENCES_CONFIG = [
  // Active Residences
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

  // Archived Residences
  { id: 'res_remal_2', name: 'Al-Remal 2', nameAr: 'الرمال 2', city: 'Riyadh', status: 'Archived', disabled: true, isHistorical: true },
  { id: '6w8r1vh1h8xjpOsVULV5', name: 'Old Wood Factory', nameAr: 'مصنع الخشب القديم', city: 'Jeddah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'KA43UwlETuLC7bWffony', name: 'Gypsum', nameAr: 'الجبس', city: 'Jeddah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'Axbap5tRt6FJZjVpTjCJ', name: 'Palestine', nameAr: 'فلسطين', city: 'Jeddah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'res_alnaseem', name: 'Al-Naseem', nameAr: 'النسيم', city: 'Makkah', status: 'Archived', disabled: true, isHistorical: true },
  { id: 'gpKfg1LK8UBxPIhHiuPa', name: 'Althomama', nameAr: 'الثمامة', city: 'Riyadh', status: 'Archived', disabled: true, isHistorical: true },
];

function resolveResidence(rawHouse, rawBuilding, remarks) {
  const house = (rawHouse || '').trim();
  const bldg = (rawBuilding || '').trim() || '1';
  const rem = (remarks || '').trim();

  // Combine house and remarks for best match
  const combined = `${house} ${rem}`.toLowerCase();

  // 1. Palestine
  if (/فلسطين|palestine/i.test(combined) && !/تحويل الى فلسطين/i.test(house)) {
    return { resId: 'Axbap5tRt6FJZjVpTjCJ', resName: 'Palestine', building: bldg, isArchived: true };
  }

  // 2. Old Wood Factory
  if (/منجرة|منجره|wood|خشب/i.test(combined) && !/تحويل الى منجرة/i.test(house)) {
    return { resId: '6w8r1vh1h8xjpOsVULV5', resName: 'Old Wood Factory', building: bldg, isArchived: true };
  }

  // 3. Gypsum
  if (/جبس|gypsum/i.test(combined)) {
    return { resId: 'KA43UwlETuLC7bWffony', resName: 'Gypsum', building: bldg, isArchived: true };
  }

  // 4. Al-Naseem
  if (/نسيم|naseem/i.test(combined)) {
    return { resId: 'res_alnaseem', resName: 'Al-Naseem', building: bldg, isArchived: true };
  }

  // 5. Al-Remal 2
  if (/الرمال\s*2|remal\s*2/i.test(house) || (/الرمال/i.test(house) && /c[-_]?2/i.test(bldg))) {
    return { resId: 'res_remal_2', resName: 'Al-Remal 2', building: bldg.replace(/^c[-_]?/i, '') || bldg, isArchived: true };
  }

  // 6. Al-Remal 1
  if (/الرمال|remal|رياض|الرياض|حرس|الحرس/i.test(combined)) {
    return { resId: 'L4oapIYo87lkQANWsgiD', resName: 'Al-Remal', building: bldg, isArchived: false };
  }

  // 7. ReaSea / Umluj / Sharma / SBG
  if (/املج|أملج|شرما|sharma|redsea|reasea|umluj|^sbg$/i.test(combined)) {
    return { resId: '3C1ZgRS2sr2VFMYGdzIN', name: 'ReaSea', resName: 'ReaSea', building: bldg, isArchived: false };
  }

  // 8. Jeddah Iwaa / جدة
  if (/جدة|جده|إيواء|ايواء|iwaa|مطار/i.test(combined)) {
    return { resId: 'uoDgwomUfst2DnyRZGQi', resName: 'Jeddah Iwaa', building: bldg, isArchived: false };
  }

  // 9. AlZaher / مكة
  if (/مكة|مكه|zaher|الزاهر/i.test(combined)) {
    return { resId: 'L3wLRKW34H2dM2tQaBfI', resName: 'AlZaher', building: bldg, isArchived: false };
  }

  // 10. AlAziziah
  if (/عزيزية|عزيزيه|aziziah/i.test(combined)) {
    return { resId: 'C8LpwaPOdkBDpzYvxDmA', resName: 'AlAziziah', building: bldg, isArchived: false };
  }

  // 11. Um Al-Salam / بحرة
  if (/بحرة|بحره|أم السلم|ام السلم|alsalam|salam/i.test(combined)) {
    return { resId: '4znleAk6l3E1eb1kAEXK', resName: 'Um Al-Salam', building: bldg, isArchived: false };
  }

  // 12. Al Juhaimi
  if (/جحيمي|جهيمي|juhaimi/i.test(combined)) {
    return { resId: 'SMTiuEOKEPoBpAzxEikd', resName: 'Al Juhaimi', building: bldg, isArchived: false };
  }

  // 13. Qassim
  if (/قصيم|qassim/i.test(combined)) {
    return { resId: '693QIhFYz1xDe3OOO9Ft', resName: 'Qassim SBG', building: bldg, isArchived: false };
  }

  // 14. Madinah
  if (/مدينة|مدينه|madinah/i.test(combined)) {
    return { id: 'vjxzVoOleoXJK2OjVZWy', resId: 'vjxzVoOleoXJK2OjVZWy', resName: 'Madinah SBG', building: bldg, isArchived: false };
  }

  // 15. AlMalaz
  if (/ملز|malaz/i.test(combined)) {
    return { resId: 'rMRf9xOfBZqUw8GKPMMM', resName: 'AlMalaz', building: bldg, isArchived: false };
  }

  // Fallback
  return { resId: `res_${house || 'other'}`, resName: house || 'Other Residence', building: bldg, isArchived: true };
}

function parseDateToIso(dateStr) {
  if (!dateStr) return null;
  const d = dateStr.trim();
  // DD/MM/YYYY
  const m1 = d.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    const day = m1[1].padStart(2, '0');
    const month = m1[2].padStart(2, '0');
    const year = m1[3];
    return `${year}-${month}-${day}`;
  }
  // YYYY-MM-DD
  const m2 = d.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) {
    const year = m2[1];
    const month = m2[2].padStart(2, '0');
    const day = m2[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

function cleanRemark(raw) {
  if (!raw) return null;
  let text = raw.trim();
  text = text.replace(/^(ملاحظات|سبب الخروج|سبب التسكين|السبب|Notes?|Reason)\s*:\s*/i, '').trim();
  text = text.replace(/^["'«»“”\(]+|["'«»“”\)]+$/g, '').trim();
  if (!text || /^سجل\s+تسكين/i.test(text) || /^مزامنة\s+النظام/i.test(text) || /^Auto-archived/i.test(text) || text === 'Occupied') {
    return null;
  }
  return text;
}

async function fetchMonth(startStr, endStr) {
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

// Generate all months from Jan 2015 to Aug 2026
export function getAllMonthsList() {
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
        name: `${year}-${String(m).padStart(2, '0')}`,
        startDate: startStr,
        endDate: endStr,
      });
    }
  }
  return months;
}

console.log('Total months to process:', getAllMonthsList().length);
