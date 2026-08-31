/**
 * Legacy In/Out History & Monthly Billing Parser & Engine
 */

import { parseLegacyDateToIso, mapLegacyHouseToResidence } from './accommodation-legacy-sync';

export interface LegacyBillingRow {
  sNo: string;
  employeeId: string; // C_Number
  employeeName: string;
  houseName: string;
  targetResidenceName: string;
  department: string;
  nationality: string;
  profession: string;
  building: string;
  room: string;
  sponsor: string;
  remarks: string;
  site: string;
  dateIn: string;
  dateOut: string;
  days: number;
  estimatedDailyRate?: number;
  estimatedAmount?: number;
}

export const DEFAULT_BILLING_REPORT_URL =
  'http://213.210.196.115:8082/SacoOnline/HousCamps/ReportViewForInOutHistory.aspx?HousingRefs=&SponsRef=&DepRef=&DatInRef=2026-07-21&DatOutRef=2026-08-20&InputRerenc=EmpInOutHistory&UsrInput=HousAdmin';

export const AVAILABLE_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];

const ARABIC_MONTH_NAMES = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export function getMonthsForYear(year: number) {
  const maxMonth = year === 2026 ? 8 : 12;
  const months = [];
  for (let m = 1; m <= maxMonth; m++) {
    const prevYear = m === 1 ? year - 1 : year;
    const prevMonth = m === 1 ? 12 : m - 1;
    const startStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-21`;
    const endStr = `${year}-${String(m).padStart(2, '0')}-20`;
    months.push({
      id: `${year}-${String(m).padStart(2, '0')}`,
      year,
      month: m,
      name: `${ARABIC_MONTH_NAMES[m - 1]} ${year} (شهر ${m})`,
      startDate: startStr,
      endDate: endStr,
    });
  }
  return months;
}

export const DEFAULT_2026_MONTHS = getMonthsForYear(2026);

/**
 * Builds the URL for fetching the legacy billing report for specific dates
 */
export function buildLegacyBillingUrl(startDate: string = '2026-07-21', endDate: string = '2026-08-20'): string {
  return `http://213.210.196.115:8082/SacoOnline/HousCamps/ReportViewForInOutHistory.aspx?HousingRefs=&SponsRef=&DepRef=&DatInRef=${startDate}&DatOutRef=${endDate}&InputRerenc=EmpInOutHistory&UsrInput=HousAdmin`;
}

/**
 * Fetches and parses the legacy In/Out history billing report
 */
export async function fetchAndParseLegacyBillingReport(customUrl?: string): Promise<LegacyBillingRow[]> {
  const url = customUrl || DEFAULT_BILLING_REPORT_URL;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch billing report: HTTP ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  return parseLegacyBillingHtml(html);
}

/**
 * Parses raw HTML table into structured LegacyBillingRow objects
 */
export function parseLegacyBillingHtml(html: string): LegacyBillingRow[] {
  const rows: LegacyBillingRow[] = [];
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  for (const tr of trMatches) {
    if (tr.includes('<th')) continue;
    const tdMatches = tr.match(/<td[\s\S]*?<\/td>/gi);
    if (!tdMatches || tdMatches.length < 13) continue;

    const values = tdMatches.map((td) =>
      td
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim()
    );

    // Headers:
    // 0: S.No
    // 1: C_Number
    // 2: Employee Name
    // 3: House Name
    // 4: Department
    // 5: Nationality
    // 6: Profession
    // 7: Building
    // 8: Room
    // 9: Sponsor
    // 10: Remarks
    // 11: Site
    // 12: Date In
    // 13: Date Out
    // 14: Days

    const empId = values[1] || '';
    const empName = values[2] || '';
    if (!empId && !empName) continue;

    const rawHouse = values[3] || '';
    const rawBuilding = values[7] || '';
    const mapping = mapLegacyHouseToResidence(rawHouse, rawBuilding);

    const daysCount = parseInt(values[14] || '0', 10) || 0;

    rows.push({
      sNo: values[0] || '',
      employeeId: empId,
      employeeName: empName,
      houseName: rawHouse,
      targetResidenceName: mapping.residenceName,
      department: values[4] || '',
      nationality: values[5] || '',
      profession: values[6] || '',
      building: mapping.buildingName,
      room: values[8] || '',
      sponsor: values[9] || '',
      remarks: values[10] || '',
      site: values[11] || '',
      dateIn: values[12] || '',
      dateOut: values[13] || '',
      days: daysCount,
    });
  }

  return rows;
}
