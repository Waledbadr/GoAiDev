// ─── Income Categories ────────────────────────────────────────────────────
export const INCOME_CATEGORIES = [
  { key: 'workerAccommodationCompanies', labelAr: 'تسكين عمالة (شركات)',   labelEn: 'Worker Housing (Companies)' },
  { key: 'workerAccommodationSacodeco',  labelAr: 'تسكين عمالة (ساكوديكو)', labelEn: 'Worker Housing (Sacodeco)' },
  { key: 'serviceRooms',                 labelAr: 'غرف خدمات',             labelEn: 'Service Rooms' },
  { key: 'housingRent',                  labelAr: 'ايجار سكن',             labelEn: 'Housing Rent' },
  { key: 'shopsRent',                    labelAr: 'ايجار محلات',           labelEn: 'Shops Rent' },
  { key: 'groceryRent',                  labelAr: 'ايجار بقالات',          labelEn: 'Grocery Rent' },
  { key: 'restaurantRent',               labelAr: 'ايجار مطاعم',           labelEn: 'Restaurant Rent' },
  { key: 'electricityRental',            labelAr: 'تاجير كهرباء',          labelEn: 'Electricity Rental' },
  { key: 'otherIncome',                  labelAr: 'أخرى',                  labelEn: 'Other' },
] as const;

// ─── Expense Groups & Categories ─────────────────────────────────────────
export const EXPENSE_GROUPS = [
  {
    key: 'maintenance',
    labelAr: 'صيانات',
    labelEn: 'Maintenance',
    categories: [
      { key: 'vehicles',           labelAr: 'سيارات',           labelEn: 'Vehicles' },
      { key: 'electricity',        labelAr: 'كهرباء',           labelEn: 'Electricity' },
      { key: 'plumbing',           labelAr: 'سباكة',            labelEn: 'Plumbing' },
      { key: 'airConditioners',    labelAr: 'مكيفات',           labelEn: 'Air Conditioners' },
      { key: 'generatorsMotors',   labelAr: 'مولدات + مواتير',  labelEn: 'Generators & Motors' },
      { key: 'drainageLines',      labelAr: 'خطوط الصرف',       labelEn: 'Drainage Lines' },
      { key: 'fireExtinguishers',  labelAr: 'طفاية الحريق',     labelEn: 'Fire Extinguishers' },
      { key: 'waterDesalination',  labelAr: 'تحلية الماء',      labelEn: 'Water Desalination' },
      { key: 'generalMaintenance', labelAr: 'صيانة عامة',       labelEn: 'General Maintenance' },
    ],
  },
  {
    key: 'assets',
    labelAr: 'أصول',
    labelEn: 'Assets',
    categories: [
      { key: 'residenceRents',    labelAr: 'ايجارات السكنات',  labelEn: 'Residence Rents' },
      { key: 'depreciation',      labelAr: 'الاهلاك',          labelEn: 'Depreciation' },
      { key: 'staffSalaries',     labelAr: 'رواتب الموظفين',   labelEn: 'Staff Salaries' },
      { key: 'securitySalaries',  labelAr: 'رواتب الامن',      labelEn: 'Security Salaries' },
      { key: 'residenceLicense',  labelAr: 'رخصة سكن',         labelEn: 'Residence License' },
    ],
  },
  {
    key: 'services',
    labelAr: 'خدمات',
    labelEn: 'Services',
    categories: [
      { key: 'municipalWater',    labelAr: 'مياه بلدية',       labelEn: 'Municipal Water' },
      { key: 'pestControl',       labelAr: 'مكافحة الحشرات',   labelEn: 'Pest Control' },
      { key: 'sewage',            labelAr: 'صرف صحي',          labelEn: 'Sewage' },
      { key: 'drinkingWater',     labelAr: 'مياه الشرب',       labelEn: 'Drinking Water' },
      { key: 'washingWater',      labelAr: 'مياه غسيل',        labelEn: 'Washing Water' },
      { key: 'wasteCollection',   labelAr: 'رفع القمامة',      labelEn: 'Waste Collection' },
      { key: 'containers',        labelAr: 'حاويات',           labelEn: 'Containers' },
      { key: 'electricityBill',   labelAr: 'فاتورة الكهرباء',  labelEn: 'Electricity Bill' },
      { key: 'gas',               labelAr: 'غاز',              labelEn: 'Gas' },
      { key: 'gasoline',          labelAr: 'بنزين',            labelEn: 'Gasoline' },
      { key: 'diesel',            labelAr: 'ديزل',             labelEn: 'Diesel' },
    ],
  },
  {
    key: 'other',
    labelAr: 'أخرى',
    labelEn: 'Other',
    categories: [
      { key: 'buffet',            labelAr: 'بوفيه',            labelEn: 'Buffet / Catering' },
      { key: 'cleaning',          labelAr: 'نظافة',            labelEn: 'Cleaning' },
      { key: 'internet',          labelAr: 'انترنت',           labelEn: 'Internet' },
      { key: 'stationery',        labelAr: 'مكتبة',            labelEn: 'Stationery' },
      { key: 'furnishings',       labelAr: 'فرش',              labelEn: 'Furnishings' },
      { key: 'furnishingsLaundry',labelAr: 'غسيل فرش',        labelEn: 'Furnishings Laundry' },
      { key: 'laborTransportation',labelAr: 'نقل عمالة',       labelEn: 'Labor Transportation' },
    ],
  },
] as const;

export type IncomeKey = typeof INCOME_CATEGORIES[number]['key'] | string;
export type ExpenseCategoryKey =
  | typeof EXPENSE_GROUPS[number]['categories'][number]['key']
  | string;

// ─── Main Data Type ───────────────────────────────────────────────────────
export interface MonthlyFinancial {
  id: string;               // "{residenceId}_{fiscalMonth}"
  residenceId: string;
  residenceName: string;
  fiscalMonth: string;      // "YYYY-MM"
  income: Partial<Record<IncomeKey, number>>;
  expenses: Partial<Record<ExpenseCategoryKey, number>>;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────
export function calcTotalIncome(income: Partial<Record<IncomeKey, number>>): number {
  if (!income) return 0;
  return Object.values(income).reduce((s: number, v) => s + (v || 0), 0);
}

export function calcTotalExpenses(expenses: Partial<Record<ExpenseCategoryKey, number>>): number {
  if (!expenses) return 0;
  return Object.values(expenses).reduce((s: number, v) => s + (v || 0), 0);
}

export function makeEmptyFinancial(
  residenceId: string,
  residenceName: string,
  fiscalMonth: string,
): MonthlyFinancial {
  return {
    id: `${residenceId}_${fiscalMonth}`,
    residenceId,
    residenceName,
    fiscalMonth,
    income: {},
    expenses: {},
  };
}

export function formatSAR(value: number): string {
  if (!value && value !== 0) return '-';
  return value.toLocaleString('en-US');
}
