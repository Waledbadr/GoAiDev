/**
 * Legacy Accommodation Sync Engine
 * Fetches, parses, matches, and synchronizes legacy housing data with GoAiDev accommodation data model.
 */

export interface LegacyEmployeeRow {
  sNo: string;
  employeeId: string; // C_Number
  employeeName: string;
  occupation: string;
  currentProject: string;
  department: string;
  houseName: string;
  building: string;
  room: string;
  iqamaNo: string;
  nationality: string;
  birthDate: string;
  dateIn: string;
  dateOut: string;
  remarks: string;
  company: string;
  site: string;
  sponsor: string;
}

export interface SyncResidenceMapping {
  legacyHouseName: string;
  targetResidenceName: string;
  targetBuildingName?: string;
  city?: string;
}

export const DEFAULT_LEGACY_REPORT_URL =
  'http://213.210.196.115:8082/SacoOnline/HousCamps/ReportEmployeesCurrentInHousingCamps.aspx?ComNoRefs=&HousingRefs=&BldgRef=&RoomRefs=&SponsRef=&DepRef=&NatnlyRef=&DatInRef=&DatOutRef=&InputRerenc=EmpInCamps&UsrInput=HousAdmin';

/**
 * Standard mapping dictionary based on user confirmation
 */
export function mapLegacyHouseToResidence(
  rawHouse: string,
  rawBuilding: string
): { residenceName: string; buildingName: string; city: string } {
  const house = (rawHouse || '').trim();
  const bldg = (rawBuilding || '').trim() || '1';

  // Normalize house name (clean encoding artifacts like )
  const cleanHouse = house.replace(/[^a-zA-Z0-9\u0600-\u06FF\s._-]/g, '').trim();

  // 1. Al-Remal / الرمال & الرمال2
  if (/الرمال|الرما|Remal/i.test(cleanHouse)) {
    const isRemal2 = /2/.test(cleanHouse);
    let buildingName = bldg;
    const cleanBldgLetter = bldg.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    if (isRemal2) {
      buildingName = cleanBldgLetter || bldg;
      return {
        residenceName: 'Al-Remal 2',
        buildingName,
        city: 'Riyadh',
      };
    } else {
      // For Remal 1, map single letters (A, B, C, D, G) to -1 format or keep single if unique (e.g. E, F, H, M, N)
      if (['A', 'B', 'C', 'D', 'G'].includes(cleanBldgLetter)) {
        buildingName = `${cleanBldgLetter}-1`;
      } else {
        buildingName = cleanBldgLetter || bldg;
      }
      return {
        residenceName: 'Al-Remal',
        buildingName,
        city: 'Riyadh',
      };
    }
  }

  // 2. AlZaher / الزاهر
  if (/Zaher|الزاهر/i.test(cleanHouse)) {
    return {
      residenceName: 'AlZaher',
      buildingName: bldg,
      city: 'Makkah',
    };
  }

  // 3. Um Alsalam / أم السلم
  if (/Alsalam|Salam|السلم|ام السلم/i.test(cleanHouse)) {
    // Normalize B1 / B-1, B2 / B-2, B3 / B-3, عماره / عمارة
    let normalizedBldg = bldg.trim();
    if (/^B[-_]?1$/i.test(normalizedBldg)) normalizedBldg = 'B-1';
    else if (/^B[-_]?2$/i.test(normalizedBldg)) normalizedBldg = 'B-2';
    else if (/^B[-_]?3$/i.test(normalizedBldg)) normalizedBldg = 'B-3';
    else if (/عمار/i.test(normalizedBldg)) normalizedBldg = 'عمارة';
    else if (/انتظار/i.test(normalizedBldg)) normalizedBldg = 'انتظار';

    return {
      residenceName: 'Um Al-Salam',
      buildingName: normalizedBldg,
      city: 'Bahrah',
    };
  }

  // 4. RedSea / SBG & ENG. Umluj
  if (/ENG\.\s*Umluj|Umluj|أملج/i.test(cleanHouse)) {
    return {
      residenceName: 'ReaSea',
      buildingName: `ENG-${bldg}`,
      city: 'Umluj',
    };
  }
  if (/^SBG$/i.test(cleanHouse) || /RedSea/i.test(cleanHouse)) {
    return {
      residenceName: 'ReaSea',
      buildingName: bldg,
      city: 'Umluj',
    };
  }

  // 5. Al Aziziah / العزيزية
  if (/Aziziah|العزيزية/i.test(cleanHouse)) {
    return {
      residenceName: 'AlAziziah',
      buildingName: bldg,
      city: 'Makkah',
    };
  }

  // 6. Al Johaimi 1, 2, 3 / الجحيمي
  if (/Johaimi|Juhaimi|الجحيمي/i.test(cleanHouse)) {
    let buildingNumber = bldg;
    if (/1/.test(cleanHouse)) buildingNumber = '1';
    else if (/2/.test(cleanHouse)) buildingNumber = '2';
    else if (/3/.test(cleanHouse)) buildingNumber = '3';

    return {
      residenceName: 'Al Juhaimi',
      buildingName: buildingNumber,
      city: 'Bahrah',
    };
  }

  // 7. Jeddah Iwaa / إيواء جدة
  if (/Iwaa|إيواء/i.test(cleanHouse)) {
    return {
      residenceName: 'Jeddah Iwaa',
      buildingName: bldg,
      city: 'Jeddah',
    };
  }

  // 8. Al Malaz / الملز
  if (/Malaz|الملز/i.test(cleanHouse)) {
    return {
      residenceName: 'AlMalaz',
      buildingName: bldg,
      city: 'Riyadh',
    };
  }

  // 9. Qassim SBG / القصيم
  if (/Qassim|القصيم/i.test(cleanHouse)) {
    return {
      residenceName: 'Qassim SBG',
      buildingName: bldg,
      city: 'Qassim',
    };
  }

  // 10. Madinah SBG / المدينة
  if (/Madinah|المدينة/i.test(cleanHouse)) {
    return {
      residenceName: 'Madinah SBG',
      buildingName: bldg,
      city: 'Madinah',
    };
  }

  // 11. Palestine / فلسطين
  if (/Palestine|فلسطين/i.test(cleanHouse)) {
    return {
      residenceName: 'Palestine',
      buildingName: bldg,
      city: 'Jeddah',
    };
  }

  // Fallback
  return {
    residenceName: cleanHouse || 'Other Residence',
    buildingName: bldg,
    city: 'Other',
  };
}

/**
 * Parses date string in DD/MM/YYYY or similar format to ISO string YYYY-MM-DD
 */
export function parseLegacyDateToIso(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) {
    return new Date().toISOString().split('T')[0];
  }
  const clean = dateStr.trim();
  const parts = clean.split(/[/.-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    // Handle 2-digit years
    if (year < 100) year += 2000;

    // Validate month & day bounds
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const yyyy = String(year);
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // If already standard ISO or fallback
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Fetches and parses the legacy HTML report into structured objects
 */
export async function fetchAndParseLegacyReport(customUrl?: string): Promise<LegacyEmployeeRow[]> {
  const url = customUrl || DEFAULT_LEGACY_REPORT_URL;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch legacy report: HTTP ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  return parseLegacyHtml(html);
}

/**
 * Parses raw HTML string from legacy report
 */
export function parseLegacyHtml(html: string): LegacyEmployeeRow[] {
  const rows: LegacyEmployeeRow[] = [];
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  for (const tr of trMatches) {
    if (tr.includes('<th')) continue;
    const tdMatches = tr.match(/<td[\s\S]*?<\/td>/gi);
    if (!tdMatches || tdMatches.length < 10) continue;

    const values = tdMatches.map((td) =>
      td
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim()
    );

    // Headers mapping:
    // 0: S.No
    // 1: C_Number (Employee ID)
    // 2: Employee Name
    // 3: Occupation
    // 4: Current Project
    // 5: Department
    // 6: House Name
    // 7: Building
    // 8: Room
    // 9: Iqama_No
    // 10: Nationality
    // 11: Birth_date
    // 12: Date In
    // 13: Date Out
    // 14: Remarks
    // 15: Company
    // 16: Site
    // 17: Sponsor

    const empId = values[1] || '';
    const empName = values[2] || '';
    if (!empId && !empName) continue;

    rows.push({
      sNo: values[0] || '',
      employeeId: empId,
      employeeName: empName,
      occupation: values[3] || '',
      currentProject: values[4] || '',
      department: values[5] || '',
      houseName: values[6] || '',
      building: values[7] || '',
      room: values[8] || '',
      iqamaNo: values[9] || '',
      nationality: values[10] || '',
      birthDate: values[11] || '',
      dateIn: values[12] || '',
      dateOut: values[13] || '',
      remarks: values[14] || '',
      company: values[15] || '',
      site: values[16] || '',
      sponsor: values[17] || '',
    });
  }

  return rows;
}
