/**
 * Hijri <-> Gregorian Date Conversion Utilities
 * Compatible with Browser Intl and Node.js
 */

export const HIJRI_MONTHS_AR = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الثاني',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

export const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  'Rabi I',
  'Rabi II',
  'Jumada I',
  'Jumada II',
  'Rajab',
  'Sha\'ban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qi\'dah',
  'Dhu al-Hijjah',
];

export interface HijriDateParts {
  year: number;
  month: number; // 1 - 12
  day: number; // 1 - 30
  monthNameAr: string;
  monthNameEn: string;
  formattedAr: string;
  formattedEn: string;
}

/**
 * Converts ISO Gregorian date string (YYYY-MM-DD) to Hijri Date Parts
 */
export function getHijriFromGregorian(dateStr: string): HijriDateParts | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;

  try {
    const fmtAr = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-islamic', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    const partsAr = fmtAr.formatToParts(d);

    let year = 1448;
    let month = 1;
    let day = 1;

    for (const p of partsAr) {
      if (p.type === 'year') year = parseInt(p.value, 10);
      if (p.type === 'month') month = parseInt(p.value, 10);
      if (p.type === 'day') day = parseInt(p.value, 10);
    }

    const monthIndex = Math.max(0, Math.min(11, month - 1));
    const monthNameAr = HIJRI_MONTHS_AR[monthIndex] || `شهر ${month}`;
    const monthNameEn = HIJRI_MONTHS_EN[monthIndex] || `Month ${month}`;

    return {
      year,
      month,
      day,
      monthNameAr,
      monthNameEn,
      formattedAr: `${day} ${monthNameAr} ${year} هـ`,
      formattedEn: `${day} ${monthNameEn} ${year} AH`,
    };
  } catch (err) {
    console.error('Error converting Gregorian to Hijri:', err);
    return null;
  }
}

/**
 * Extracts raw Hijri numeric parts (year, month, day) from Date
 */
function getIntlHijriParts(d: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = fmt.formatToParts(d);
  let year = 1448, month = 1, day = 1;
  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = parseInt(p.value, 10);
  }
  return { year, month, day };
}

/**
 * Converts Hijri Year, Month, Day to Gregorian ISO string (YYYY-MM-DD)
 */
export function hijriToGregorianISO(hy: number, hm: number, hd: number): string {
  try {
    // 1. Initial Julian Day Number approximation
    const approxJD = Math.floor((11 * hy + 3) / 30) + 354 * hy + 30 * hm - Math.floor((hm - 1) / 2) + hd + 1948440 - 385;
    let l = approxJD + 68569;
    let n = Math.floor((4 * l) / 146097);
    l = l - Math.floor((146097 * n + 3) / 4);
    let i = Math.floor((4000 * (l + 1)) / 1464001);
    l = l - Math.floor((1461 * i) / 4) + 31;
    let j = Math.floor((80 * l) / 2447);
    let day = l - Math.floor((2447 * j) / 80);
    l = Math.floor(j / 11);
    let month = j + 2 - 12 * l;
    let year = 100 * (n - 49) + i + l;

    const estDate = new Date(year, month - 1, day);

    // 2. Search +/- 5 days for exact match with browser Intl calendar
    for (let offset = -5; offset <= 5; offset++) {
      const testDate = new Date(estDate.getTime() + offset * 86400000);
      const hp = getIntlHijriParts(testDate);
      if (hp.year === hy && hp.month === hm && hp.day === hd) {
        const yyyy = testDate.getFullYear();
        const mm = String(testDate.getMonth() + 1).padStart(2, '0');
        const dd = String(testDate.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    // Fallback
    const yyyy = String(year).padStart(4, '0');
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch (err) {
    console.error('Error converting Hijri to Gregorian:', err);
    const now = new Date();
    return now.toISOString().split('T')[0];
  }
}

/**
 * Returns formatted Hijri date string for subtext display
 */
export function formatHijriSubtext(dateStr: string, isAr: boolean = true): string | null {
  const hijri = getHijriFromGregorian(dateStr);
  if (!hijri) return null;
  return isAr ? hijri.formattedAr : hijri.formattedEn;
}
