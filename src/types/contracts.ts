// ============================================================
// أنواع العقود النظامية الشاملة - Enterprise Contracts Architecture
// ============================================================

// ---- التصنيف الأساسي ----
export type ContractCategory = 'revenue' | 'expense';

// ---- الأنواع السبعة الأساسية للعقود (Polymorphic Contract Types) ----
export type CoreContractType =
  | 'lease_in'                // 🔴 استئجار عقار (نحن المستأجر: سكن، أراضي، مستودعات)
  | 'lease_out'               // 🟢 تأجير عقار (نحن المؤجر: سكنات، محلات، مطاعم)
  | 'accommodation_agreement' // 🟢/🔴 عقد إسكان وتسكين أفراد وعمالة (مرتبط بالإشغال)
  | 'service'                 // 🔴 عقد خدمات وصيانة (مصاعد، نظافة، طفايات، كاميرات)
  | 'supply'                  // 🔴 عقد توريد (مياه، ديزل، أثاث، أجهزة)
  | 'commercial'              // 🟢 عقد استثمار/امتياز تجاري (بقالة، مطعم، مغسلة)
  | 'utility';                // 🔴 عقد مرافق وخدمات عامة (كهرباء، مياه، غاز، إنترنت)

// دعم الأنواع مع التوافق الترجعي للبيانات القديمة
export type ContractType =
  | CoreContractType
  // إيجاز للتوافق القديم:
  | 'worker_housing_revenue'
  | 'commercial_rent'
  | 'full_residence_rental'
  | 'worker_housing_expense'
  | 'residence_rent'
  | 'service_maintenance'
  | 'water_drinking'
  | 'water_washing'
  | 'gas'
  | 'internet_distribution';

// ---- أنواع الفوترة ----
export type BillingType =
  | 'per_person_per_day'      // للشخص/اليوم
  | 'per_person_per_month'    // للشخص/الشهر
  | 'per_room_per_month'      // للغرفة/الشهر
  | 'fixed_monthly'           // مبلغ شهري ثابت
  | 'fixed_yearly'            // مبلغ سنوي ثابت
  | 'one_time'                // مبلغ لمرة واحدة
  | 'per_invoice'             // حسب الفاتورة المقدمة
  | 'per_unit';               // حسب الوحدة (خزان، دبة غاز، لتر)

// ---- أنواع التجديد ----
export type RenewalType =
  | 'manual'                // يدوي
  | 'auto_monthly'          // تلقائي شهري
  | 'auto_quarterly'        // تلقائي ربع سنوي
  | 'auto_yearly'           // تلقائي سنوي
  | 'auto_same_duration';   // تلقائي بنفس مدة العقد الأصلية

// ---- حالة العقد ----
export type ContractStatus =
  | 'Active'
  | 'Suspended'
  | 'Expired'
  | 'Cancelled'
  | 'Draft';

// ---- حالة فاتورة العقد ----
export type ContractInvoiceStatus =
  | 'Draft'
  | 'Issued'
  | 'Paid'
  | 'Overdue'
  | 'Cancelled';

// ---- نوع الطرف الآخر ----
export type PartyType = 'company' | 'vendor' | 'individual';

// ---- أنواع الضمانات (Guarantees) ----
export type GuaranteeType = 'security_deposit' | 'check' | 'letter_of_credit' | 'deposit' | 'bail';

export interface ContractGuarantee {
  type: GuaranteeType;
  amount: number;
  referenceNumber?: string;
  bankName?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
}

// ---- خدمة داخل العقد (لعقود الخدمات المتعددة) ----
export interface ContractService {
  name: string;
  description?: string;
  rate: number;
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
}

// ---- الحقول والأقسام الديناميكية لكل نوع عقد (Dynamic Sections) ----
export interface LeaseDetails {
  propertyType?: 'building' | 'land' | 'warehouse' | 'residence';
  totalAreaSqm?: number;
  buildingName?: string;
  unitNumbers?: string[];
}

export interface AccommodationDetails {
  targetWorkersCount?: number;
  dailyRatePerWorker?: number;
  bedsCount?: number;
}

export interface ServiceDetails {
  serviceCategory?: string; // مصاعد، نظافة، طفايات، كاميرات، مكيفات
  slaResponseHours?: number;
  visitFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  equipmentCount?: number;
}

export interface SupplyDetails {
  supplyCategory?: 'water' | 'diesel' | 'furniture' | 'appliances' | 'beds';
  unitPrice?: number;
  deliverySchedule?: string;
}

export interface CommercialDetails {
  commercialActivity?: 'grocery' | 'restaurant' | 'laundry' | 'sim_cards' | 'internet_kiosk';
  concessionType?: 'fixed_rent' | 'percentage';
  concessionPercentage?: number;
}

export interface UtilityDetails {
  utilityType?: 'electricity' | 'water' | 'internet' | 'gas' | 'phone';
  meterNumber?: string;
  accountNumber?: string;
  providerName?: string;
}

// ---- العقد الرئيسي الشامل ----
export interface Contract {
  id: string;
  contractNumber?: string;
  title?: string;

  // التصنيف والنوع
  contractType: ContractType;
  contractCategory: ContractCategory;

  // الطرف الأول والطرف الثاني
  firstPartyName?: string;
  partyType: PartyType;
  partyId: string;
  partyName: string;
  partyContact?: string;
  partyPhone?: string;
  partyEmail?: string;

  // الربط التكاملي مع الكيانات
  linkedResidences: string[];
  linkedResidenceNames?: string[];
  linkedBuildings?: string[];
  linkedUnits?: string[];
  linkedEmployees?: string[];

  // المدة والتواريخ
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  dateSystem?: 'gregorian' | 'hijri';
  isOpenEnded: boolean;
  durationMonths?: number;

  // الفوترة والمالية والشروط
  currency?: string;
  billingType: BillingType;
  billingRate: number; // المبلغ قبل الضريبة
  vatPercentage?: number; // نسبة الضريبة (15%)
  vatAmount?: number; // قيمة الضريبة
  totalAmount?: number; // الإجمالي مع الضريبة
  billingUnit: string;
  paymentTerms?: string;
  paymentCycle?: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  advancePayment?: number;

  // الأقسام الديناميكية المخصصة لكل نوع
  leaseDetails?: LeaseDetails;
  accommodationDetails?: AccommodationDetails;
  serviceDetails?: ServiceDetails;
  supplyDetails?: SupplyDetails;
  commercialDetails?: CommercialDetails;
  utilityDetails?: UtilityDetails;

  // الخدمات والضمانات
  services?: ContractService[];
  guarantees?: ContractGuarantee[];

  // التجديد والإلغاء والعلاقات
  renewalType: RenewalType;
  autoRenew: boolean;
  noticePeriodDays: number;
  noticeSendDate?: string;
  autoRenewCondition?: string;
  cancellationReason?: string;
  cancellationDate?: string;
  lastRenewedDate?: string;
  renewalCount: number;

  // الربط بين العقود والملاحق
  parentContractId?: string;
  contractRelationType?: 'new_contract' | 'addendum';

  // الأشخاص والأدوار المسؤولة
  contractManager?: string;
  accountantName?: string;
  supervisorName?: string;

  // الحالة والملاحظات
  status: ContractStatus;
  notes?: string;
  attachments?: string[];
  linkedFinancialCategory?: string;

  // النظام
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;

  // ---- الأرشفة ----
  // العقد سجل مالي صادر لطرف آخر، فلا يُمحى: يُؤرشف فيختفي من القوائم ويبقى
  // مرجعاً لفواتيره. الحذف النهائي مسار منفصل ومقصود.
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
}

// ---- قيد في سجل تغييرات العقد ----
export type ContractChangeAction =
  | 'created'
  | 'updated'
  | 'renewed'
  | 'suspended'
  | 'cancelled'
  | 'activated'
  | 'archived';

export interface ContractFieldChange {
  field: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
}

export interface ContractChange {
  id: string;
  contractId: string;
  action: ContractChangeAction;
  /** الحقول المالية والزمنية فقط؛ تغيير ملاحظة لا يستحق قيداً. */
  changes: ContractFieldChange[];
  byUid?: string | null;
  at: string;
  note?: string;
}

/**
 * الحقول التي يُتتبَّع تغيّرها. مقصورة على ما يغيّر المال أو المدة أو الأطراف —
 * وهو ما يُسأل عنه عند أي خلاف — حتى لا يغرق السجل في تعديلات تجميلية.
 */
export const TRACKED_CONTRACT_FIELDS = [
  'billingRate',
  'billingType',
  'vatPercentage',
  'startDate',
  'endDate',
  'isOpenEnded',
  'status',
  'partyId',
  'partyName',
  'linkedResidences',
  'contractType',
  'autoRenew',
  'renewalType',
] as const;

// ---- سطر فاتورة (لعقود التسكين المحسوبة من الإشغال) ----
// كل عامل سطر مستقل: يجعل الفاتورة قابلة للشرح والاعتراض سطراً سطراً،
// بدل مبلغ إجمالي لا يمكن مراجعته.
export interface ContractInvoiceLine {
  workerId: string;
  name: string;
  idNumber?: string;
  residenceId: string;
  days: number;
  dailyRate: number;
  amount: number;
}

// ---- فاتورة العقد ----
export interface ContractInvoice {
  id: string;
  contractId: string;
  month: string; // YYYY-MM (الشهر المالي، وليس الميلادي)
  amount: number;
  description?: string;
  status: ContractInvoiceStatus;
  issuedAt: string;
  paidAt?: string;
  invoiceNumber?: string;
  notes?: string;

  // ---- حقول عقود التسكين المحسوبة من الإشغال ----
  // الفترة المالية الفعلية التي حُسبت عليها الفاتورة. تُحفظ صراحةً لأن الشهر
  // المالي يبدأ في الحادي والعشرين تقريباً، فلا يمكن اشتقاقه من `month` وحده.
  periodStart?: string; // ISO
  periodEnd?: string;   // ISO
  residenceId?: string;
  numberOfWorkers?: number;
  numberOfDays?: number; // مجموع أيام الإشغال المفوترة لكل العمال
  dailyRate?: number;
  lines?: ContractInvoiceLine[];

  // مرجع الفاتورة المقابلة في نظام السكن القديم، للمطابقة أثناء فترة التوازي.
  legacyInvoiceId?: string;
}

// ---- تنبيه العقد ----
export interface ContractAlert {
  id: string;
  contractId: string;
  alertType: 'expiry_7days' | 'expiry_14days' | 'expiry_30days' | 'renewal_due' | 'payment_due' | 'guarantee_expiry';
  sent: boolean;
  sentAt?: string;
  read: boolean;
  isResolved?: boolean;
  createdAt: string;
}

// ---- إحصائيات العقود ----
export interface ContractStats {
  totalContracts: number;
  activeContracts: number;
  expiringContracts?: number;
  expiredContracts: number;
  suspendedContracts: number;
  draftContracts: number;
  totalMonthlyRevenue: number;
  totalMonthlyExpense: number;
  // الجزء المقدَّر من الإجماليين أعلاه (مشتق من أعداد متوقعة لا من إشغال فعلي).
  estimatedMonthlyRevenue: number;
  estimatedMonthlyExpense: number;
  // عقود نشطة لا يمكن اشتقاق قيمة شهرية لها من شروطها (لمرة واحدة، حسب الفاتورة،
  // أو عقود بالفرد بلا عدد أفراد مستهدف).
  unvaluedContracts: number;
  expiringThisMonth: number;
  expiringNextMonth: number;
  contractsByType: Record<ContractType, number>;
  contractsByCategory: Record<ContractCategory, number>;
}

// ---- بيانات الفورم (لإنشاء/تعديل العقد) ----
export interface ContractFormData {
  contractNumber?: string;
  title?: string;
  contractType: ContractType;
  contractCategory: ContractCategory;

  firstPartyName?: string;
  partyType: PartyType;
  partyId: string;
  partyName: string;
  partyContact?: string;
  partyPhone?: string;
  partyEmail?: string;

  linkedResidences: string[];
  linkedResidenceNames?: string[];
  linkedBuildings?: string[];
  linkedUnits?: string[];

  startDate: string;
  endDate: string;
  dateSystem?: 'gregorian' | 'hijri';
  isOpenEnded: boolean;

  currency?: string;
  billingType: BillingType;
  billingRate: number;
  vatPercentage?: number;
  paymentTerms?: string;
  paymentCycle?: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  advancePayment?: number;

  // الأقسام الديناميكية
  leaseDetails?: LeaseDetails;
  accommodationDetails?: AccommodationDetails;
  serviceDetails?: ServiceDetails;
  supplyDetails?: SupplyDetails;
  commercialDetails?: CommercialDetails;
  utilityDetails?: UtilityDetails;

  services?: ContractService[];
  guarantees?: ContractGuarantee[];

  renewalType: RenewalType;
  autoRenew: boolean;
  noticePeriodDays: number;
  autoRenewCondition?: string;

  parentContractId?: string;
  contractRelationType?: 'new_contract' | 'addendum';

  contractManager?: string;
  accountantName?: string;
  supervisorName?: string;

  notes?: string;
  linkedFinancialCategory?: string;
  billingUnit: string;
}

// ---- معلومات نوع العقد للعرض ----
export interface ContractTypeInfo {
  type: ContractType;
  category: ContractCategory;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  icon: string;
  defaultBillingType: BillingType;
  defaultBillingUnit: string;
  hasServices: boolean;
  hasMultipleResidences: boolean;
}

// ---- قائمة أنواع العقود السبعة الشاملة مع الأنواع القديمة للتوافق ----
export const CONTRACT_TYPES: ContractTypeInfo[] = [
  // 1. استئجار عقار (Lease In)
  {
    type: 'lease_in',
    category: 'expense',
    labelAr: 'استئجار عقار (Lease In)',
    labelEn: 'Lease In (Tenant)',
    descriptionAr: 'أنت المستأجر: مبانٍ، مجمعات سكنية، مستودعات، أو أراضٍ',
    icon: 'Building2',
    defaultBillingType: 'fixed_monthly',
    defaultBillingUnit: 'شهري',
    hasServices: false,
    hasMultipleResidences: false,
  },
  // 2. تأجير عقار (Lease Out)
  {
    type: 'lease_out',
    category: 'revenue',
    labelAr: 'تأجير عقار (Lease Out)',
    labelEn: 'Lease Out (Landlord)',
    descriptionAr: 'أنت المؤجر: تأجير سكن كامل لشركة، محلات، أو مستودعات',
    icon: 'Home',
    defaultBillingType: 'fixed_monthly',
    defaultBillingUnit: 'شهري',
    hasServices: false,
    hasMultipleResidences: true,
  },
  // 3. عقد إسكان وتسكين (Accommodation Agreement)
  {
    type: 'accommodation_agreement',
    category: 'revenue',
    labelAr: 'عقد إسكان وتسكين عمالة',
    labelEn: 'Accommodation Agreement',
    descriptionAr: 'مرتبط بأعداد الأفراد والإشغال والسعر اليومي للفرد',
    icon: 'Users',
    defaultBillingType: 'per_person_per_day',
    defaultBillingUnit: 'شخص/يوم',
    hasServices: false,
    hasMultipleResidences: true,
  },
  // 4. عقد خدمات (Service Contract)
  {
    type: 'service',
    category: 'expense',
    labelAr: 'عقد خدمات وصيانة',
    labelEn: 'Service Contract',
    descriptionAr: 'مصاعد، نظافة، طفايات، مبيدات، كاميرات، مكيفات، حراسة',
    icon: 'Wrench',
    defaultBillingType: 'fixed_monthly',
    defaultBillingUnit: 'شهري',
    hasServices: true,
    hasMultipleResidences: true,
  },
  // 5. عقد توريد (Supply Contract)
  {
    type: 'supply',
    category: 'expense',
    labelAr: 'عقد توريد مستلزمات',
    labelEn: 'Supply Contract',
    descriptionAr: 'توريد مياه، ديزل، أثاث، أسرة، أجهزة كهربائية',
    icon: 'Droplets',
    defaultBillingType: 'per_unit',
    defaultBillingUnit: 'وحدة/شحنة',
    hasServices: false,
    hasMultipleResidences: true,
  },
  // 6. عقد امتياز / استثمار تجاري (Commercial Contract)
  {
    type: 'commercial',
    category: 'revenue',
    labelAr: 'عقد استثمار / امتياز تجاري',
    labelEn: 'Commercial Concession',
    descriptionAr: 'بقالة، مطعم، كافتيريا، شرائح إنترنت، مغسلة ملابس',
    icon: 'Store',
    defaultBillingType: 'fixed_monthly',
    defaultBillingUnit: 'شهري',
    hasServices: false,
    hasMultipleResidences: false,
  },
  // 7. عقد مرافق (Utility Contract)
  {
    type: 'utility',
    category: 'expense',
    labelAr: 'عقد مرافق وخدمات عامة',
    labelEn: 'Utility Contract',
    descriptionAr: 'كهرباء، مياه عامة، إنترنت، غاز، خطوط هاتف',
    icon: 'Flame',
    defaultBillingType: 'fixed_monthly',
    defaultBillingUnit: 'شهري/فاتورة',
    hasServices: false,
    hasMultipleResidences: true,
  },

  // ---- توافق رجعي للبيانات القديمة ----
  {
    type: 'worker_housing_revenue',
    category: 'revenue',
    labelAr: 'تسكين عمال شركات (سابق)',
    labelEn: 'Worker Housing Revenue (Legacy)',
    descriptionAr: 'عقد تسكين عمالة',
    icon: 'Users',
    defaultBillingType: 'per_person_per_day',
    defaultBillingUnit: 'شخص/يوم',
    hasServices: false,
    hasMultipleResidences: true,
  },
  {
    type: 'commercial_rent',
    category: 'revenue',
    labelAr: 'إيجار تجاري (سابق)',
    labelEn: 'Commercial Rent (Legacy)',
    descriptionAr: 'إيجار محلات',
    icon: 'Store',
    defaultBillingType: 'fixed_monthly',
    defaultBillingUnit: 'شهري',
    hasServices: false,
    hasMultipleResidences: false,
  },
  {
    type: 'full_residence_rental',
    category: 'revenue',
    labelAr: 'تأجير سكن كامل (سابق)',
    labelEn: 'Full Residence Lease (Legacy)',
    descriptionAr: 'تأجير سكن بالكامل',
    icon: 'Building2',
    defaultBillingType: 'fixed_monthly',
    defaultBillingUnit: 'شهري',
    hasServices: false,
    hasMultipleResidences: true,
  },
  {
    type: 'worker_housing_expense',
    category: 'expense',
    labelAr: 'تسكين عمالة لدى الغير (سابق)',
    labelEn: 'Worker Housing Expense (Legacy)',
    descriptionAr: 'تسكين عمالتنا لدى سكن آخر',
    icon: 'Users',
    defaultBillingType: 'per_person_per_month',
    defaultBillingUnit: 'شخص/شهر',
    hasServices: false,
    hasMultipleResidences: false,
  },
  {
    type: 'residence_rent',
    category: 'expense',
    labelAr: 'إيجار سكن/أرض (سابق)',
    labelEn: 'Residence Rent (Legacy)',
    descriptionAr: 'إيجار عقار',
    icon: 'Home',
    defaultBillingType: 'fixed_monthly',
    defaultBillingUnit: 'شهري',
    hasServices: false,
    hasMultipleResidences: false,
  },
  {
    type: 'service_maintenance',
    category: 'expense',
    labelAr: 'عقود خدمات وصيانة (سابق)',
    labelEn: 'Service & Maintenance (Legacy)',
    descriptionAr: 'عقد صيانة ونظافة',
    icon: 'Wrench',
    defaultBillingType: 'fixed_monthly',
    defaultBillingUnit: 'شهري',
    hasServices: true,
    hasMultipleResidences: true,
  },
  {
    type: 'water_drinking',
    category: 'expense',
    labelAr: 'مياه شرب (سابق)',
    labelEn: 'Drinking Water (Legacy)',
    descriptionAr: 'توريد مياه',
    icon: 'Droplets',
    defaultBillingType: 'per_invoice',
    defaultBillingUnit: 'خزان',
    hasServices: false,
    hasMultipleResidences: true,
  },
  {
    type: 'water_washing',
    category: 'expense',
    labelAr: 'مياه غسيل (سابق)',
    labelEn: 'Washing Water (Legacy)',
    descriptionAr: 'مياه غسيل',
    icon: 'Droplets',
    defaultBillingType: 'per_invoice',
    defaultBillingUnit: 'خزان',
    hasServices: false,
    hasMultipleResidences: true,
  },
  {
    type: 'gas',
    category: 'expense',
    labelAr: 'غاز (سابق)',
    labelEn: 'Gas (Legacy)',
    descriptionAr: 'توريد غاز',
    icon: 'Flame',
    defaultBillingType: 'per_unit',
    defaultBillingUnit: 'دبة',
    hasServices: false,
    hasMultipleResidences: true,
  },
  {
    type: 'internet_distribution',
    category: 'expense',
    labelAr: 'توزيع إنترنت (سابق)',
    labelEn: 'Internet Distribution (Legacy)',
    descriptionAr: 'خدمة إنترنت',
    icon: 'Wifi',
    defaultBillingType: 'fixed_monthly',
    defaultBillingUnit: 'شهري',
    hasServices: false,
    hasMultipleResidences: true,
  },
];

// ---- دوال مساعدة ----
export function getContractTypeInfo(type: ContractType): ContractTypeInfo {
  return CONTRACT_TYPES.find(t => t.type === type) || CONTRACT_TYPES[0];
}

export function getContractCategoryLabel(category: ContractCategory, isAr: boolean): string {
  return category === 'revenue'
    ? (isAr ? 'إيراد 🟢' : 'Revenue 🟢')
    : (isAr ? 'مصروف 🔴' : 'Expense 🔴');
}

export function getContractStatusLabel(status: ContractStatus, isAr: boolean): string {
  const labels: Record<ContractStatus, { ar: string; en: string }> = {
    Active: { ar: 'نشط', en: 'Active' },
    Suspended: { ar: 'موقوف', en: 'Suspended' },
    Expired: { ar: 'منتهي', en: 'Expired' },
    Cancelled: { ar: 'ملغي', en: 'Cancelled' },
    Draft: { ar: 'مسودة', en: 'Draft' },
  };
  return isAr ? labels[status]?.ar || status : labels[status]?.en || status;
}

export function getStatusBadge(status: ContractStatus): string {
  const colors: Record<ContractStatus, string> = {
    Active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    Suspended: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    Expired: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    Cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    Draft: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getEffectiveContractStatus(contract: {
  status?: ContractStatus;
  endDate?: string;
  isOpenEnded?: boolean;
}): ContractStatus {
  if (!contract) return 'Active';
  if (contract.status === 'Cancelled' || contract.status === 'Suspended' || contract.status === 'Draft') {
    return contract.status;
  }
  if (!contract.isOpenEnded && contract.endDate) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (contract.endDate < todayStr) {
      return 'Expired';
    }
  }
  return contract.status || 'Active';
}

export function getBillingTypeLabel(type: BillingType, isAr: boolean): string {
  const labels: Record<BillingType, { ar: string; en: string }> = {
    per_person_per_day: { ar: 'للشخص/اليوم', en: 'Per Person/Day' },
    per_person_per_month: { ar: 'للشخص/الشهر', en: 'Per Person/Month' },
    per_room_per_month: { ar: 'للغرفة/الشهر', en: 'Per Room/Month' },
    fixed_monthly: { ar: 'مبلغ شهري ثابت', en: 'Fixed Monthly' },
    fixed_yearly: { ar: 'مبلغ سنوي ثابت', en: 'Fixed Yearly' },
    one_time: { ar: 'مبلغ لمرة واحدة', en: 'One Time' },
    per_invoice: { ar: 'حسب الفاتورة', en: 'Per Invoice' },
    per_unit: { ar: 'حسب الوحدة', en: 'Per Unit' },
  };
  return isAr ? labels[type] ? labels[type].ar : type : labels[type] ? labels[type].en : type;
}

export function getRenewalTypeLabel(type: RenewalType, isAr: boolean): string {
  const labels: Record<RenewalType, { ar: string; en: string }> = {
    manual: { ar: 'تجديد يدوي عند الانتهاء', en: 'Manual Renewal' },
    auto_monthly: { ar: 'تجديد تلقائي شهرياً', en: 'Auto Monthly' },
    auto_quarterly: { ar: 'تجديد تلقائي كل 3 أشهر', en: 'Auto Quarterly' },
    auto_yearly: { ar: 'تجديد تلقائي سنوياً', en: 'Auto Yearly' },
    auto_same_duration: { ar: 'تجديد تلقائي بنفس مدة العقد (فترة مماثلة)', en: 'Auto Same Duration' },
  };
  return isAr ? labels[type]?.ar || type : labels[type]?.en || type;
}

// ---- تطبيع القيمة الشهرية للعقد ----
// عدد الأيام الاسمي للشهر، نفس الثابت المستخدم في محرك الفوترة، حتى تتطابق
// تقديرات لوحة المعلومات مع ما تصدره الفواتير فعلياً.
export const NOMINAL_DAYS_PER_MONTH = 30;

export type MonthlyValueBasis =
  | 'exact'      // مبلغ تعاقدي شهري صريح
  | 'estimated'  // مشتق من عدد أفراد/وحدات متوقع، وليس من إشغال فعلي
  | 'unknown';   // لا يمكن اشتقاق قيمة شهرية من شروط العقد وحدها

export interface MonthlyValue {
  amount: number;
  basis: MonthlyValueBasis;
}

/**
 * القيمة الشهرية المكافئة لعقد واحد.
 *
 * لوحة المعلومات كانت تجمع `billingRate` كما هو لكل عقد شهري، فتضيف سعر الفرد
 * الواحد في عقد تسكين (35 ر.س مثلاً) إلى إيجار مبنى كامل (50,000 ر.س) في نفس
 * الخانة، وتتجاهل العقود السنوية واليومية تماماً. هذه الدالة تُرجع القيمة
 * الشهرية مع بيان مصدرها، حتى تُعرض التقديرات على أنها تقديرات بدل أن تُخلط
 * بالمبالغ المؤكدة.
 *
 * العقود المفوترة من الإشغال (شخص/يوم) تُقدَّر هنا من العدد المستهدف فقط؛
 * القيمة الحقيقية لا تُعرف إلا بعد تشغيل الفوترة على أيام الإشغال الفعلية.
 */
export function getMonthlyValue(contract: {
  billingType: BillingType;
  billingRate?: number;
  accommodationDetails?: { targetWorkersCount?: number; bedsCount?: number };
  linkedUnits?: string[];
  services?: ContractService[];
}): MonthlyValue {
  const rate = contract.billingRate || 0;

  // عقود الخدمات قد تترك `billingRate` صفراً وتضع المبالغ في بنود الخدمات،
  // وهو ما تفعله دالة إصدار الفواتير الشهرية أيضاً.
  const monthlyServices = (contract.services || [])
    .filter(s => s.frequency === 'monthly')
    .reduce((sum, s) => sum + (s.rate || 0), 0);

  switch (contract.billingType) {
    case 'fixed_monthly':
      if (rate > 0) return { amount: rate, basis: 'exact' };
      if (monthlyServices > 0) return { amount: monthlyServices, basis: 'exact' };
      return { amount: 0, basis: 'unknown' };

    case 'fixed_yearly':
      return { amount: rate / 12, basis: 'exact' };

    case 'per_person_per_month': {
      const persons = contract.accommodationDetails?.targetWorkersCount || 0;
      if (!persons) return { amount: 0, basis: 'unknown' };
      return { amount: rate * persons, basis: 'estimated' };
    }

    case 'per_person_per_day': {
      const persons = contract.accommodationDetails?.targetWorkersCount || 0;
      if (!persons) return { amount: 0, basis: 'unknown' };
      return { amount: rate * persons * NOMINAL_DAYS_PER_MONTH, basis: 'estimated' };
    }

    case 'per_room_per_month': {
      const units = contract.linkedUnits?.length || 0;
      if (!units) return { amount: 0, basis: 'unknown' };
      return { amount: rate * units, basis: 'estimated' };
    }

    // مبالغ غير متكررة أو محكومة بفاتورة المورد: لا قيمة شهرية ثابتة لها.
    case 'one_time':
    case 'per_invoice':
    case 'per_unit':
    default:
      return { amount: 0, basis: 'unknown' };
  }
}

export function formatSAR(amount: number): string {
  return (amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
