import { NOMINAL_DAYS_PER_MONTH, type RateUnit } from './billing-engine';

/**
 * كشف العقود التي لا يمكن فوترتها بثقة.
 *
 * أصل المشكلة تسمية، لا إدخال: الحقل اسمه `ratePerPersonPerMonth` وكانت
 * الواجهة تعنونه «Rate per Person/Month»، بينما الاتفاقات الفعلية بالأجرة
 * اليومية للفرد. فأُدخلت أرقام يومية في خانة تقول «شهري»، ثم قسمها محرك
 * الفوترة على ثلاثين — فصدرت فواتير بثلاثة بالمئة من قيمتها.
 *
 * الحلّ أن تُحفظ الوحدة مع العقد (`rateUnit`) بدل أن يُستدلّ عليها من اسم حقل.
 * تكشف هذه الوحدة العقود التي لم تُحسم وحدتها بعد، وتقترح قراءة مرجّحة من
 * مقدار الرقم — لكنها لا تكتب شيئاً: القيمة الصحيحة في العقد الموقّع.
 */

export type RateFlagKind =
  | 'unresolved_rate_unit'
  | 'yearly_rate_in_monthly_field'
  | 'zero_rate'
  | 'no_residence'
  | 'no_expected_workers';

export interface RateFlag {
  kind: RateFlagKind;
  severity: 'critical' | 'warning';
  messageAr: string;
  messageEn: string;
  /** الأجرة اليومية لو كان الرقم يومياً. */
  ifDaily?: string;
  /** الأجرة اليومية لو كان الرقم شهرياً. */
  ifMonthly?: string;
  /** القراءة المرجّحة من مقدار الرقم، اقتراحاً لا حُكماً. */
  suggested?: RateUnit;
}

/**
 * الحدّ الذي يُرجَّح دونه أن الرقم أجرة يومية. أي أجرة شهرية للفرد في السوق
 * السعودي تتجاوز هذا بكثير، وأي أجرة يومية تقلّ عنه بكثير — فالفجوة بين
 * القراءتين واسعة بما يكفي لاقتراح واحدة، لا لفرضها.
 */
const DAILY_RATE_CEILING = 100;

/** أعلى مبلغ شهري معقول للفرد؛ ما فوقه غالباً مبلغ سنوي في خانة شهرية. */
const MAX_PLAUSIBLE_MONTHLY_RATE = 5000;

export interface LegacyContractShape {
  id: string;
  ratePerPersonPerMonth?: number;
  rateUnit?: RateUnit;
  residenceId?: string;
  residenceIds?: string[];
  expectedWorkers?: number;
  status?: string;
}

/** فحص عقد واحد من المجموعة القديمة. */
export function flagLegacyContract(contract: LegacyContractShape): RateFlag[] {
  const flags: RateFlag[] = [];
  const rate = contract.ratePerPersonPerMonth || 0;

  if (rate <= 0) {
    flags.push({
      kind: 'zero_rate',
      severity: 'critical',
      messageAr: 'العقد بلا أجرة — كل فاتورة تصدر منه ستكون بصفر ريال.',
      messageEn: 'Contract has no rate — every invoice it produces will be zero.',
    });
  } else if (contract.rateUnit !== 'daily' && contract.rateUnit !== 'monthly') {
    // الوحدة غير محسومة. الفارق بين القراءتين ثلاثون ضعفاً، فلا يُفوتَر العقد
    // حتى تُحسم — ويُعرض الاقتراح مع الرقمين ليكون الحسم بضغطة واحدة.
    const suggested: RateUnit = rate < DAILY_RATE_CEILING ? 'daily' : 'monthly';
    flags.push({
      kind: 'unresolved_rate_unit',
      severity: 'critical',
      messageAr:
        `لم تُحدَّد وحدة الأجرة (${rate} ر.س) — يومية أم شهرية؟ لن تُصدر فواتير ` +
        `لهذا العقد حتى تُحسم، لأن الفارق بين القراءتين ثلاثون ضعفاً.`,
      messageEn:
        `Rate unit not set (${rate} SAR) — daily or monthly? No invoice will be issued ` +
        `for this contract until it is resolved: the two readings differ thirtyfold.`,
      ifDaily: `${rate.toFixed(2)} ر.س / اليوم`,
      ifMonthly: `${(rate / NOMINAL_DAYS_PER_MONTH).toFixed(2)} ر.س / اليوم`,
      suggested,
    });
  } else if (contract.rateUnit === 'monthly' && rate > MAX_PLAUSIBLE_MONTHLY_RATE) {
    flags.push({
      kind: 'yearly_rate_in_monthly_field',
      severity: 'warning',
      messageAr: `القيمة ${rate} ر.س مرتفعة كأجرة شهرية للفرد — تحقق أنها ليست مبلغاً سنوياً.`,
      messageEn: `${rate} SAR is high for a monthly per-person rate — check it is not a yearly figure.`,
      ifMonthly: `${(rate / NOMINAL_DAYS_PER_MONTH).toFixed(2)} ر.س / اليوم`,
    });
  }

  const residences = contract.residenceIds?.length
    ? contract.residenceIds
    : contract.residenceId
      ? [contract.residenceId]
      : [];
  if (residences.length === 0) {
    flags.push({
      kind: 'no_residence',
      severity: 'critical',
      messageAr: 'لا سكن مرتبط بالعقد — لن تُصدر له أي فاتورة إشغال إطلاقاً.',
      messageEn: 'No residence linked — this contract can never produce an occupancy invoice.',
    });
  }

  if (!contract.expectedWorkers) {
    flags.push({
      kind: 'no_expected_workers',
      severity: 'warning',
      messageAr: 'لا عدد عمال متوقع — لا سبيل لمقارنة المفوتَر بالمتفق عليه.',
      messageEn: 'No expected worker count — billed occupancy cannot be checked against the agreement.',
    });
  }

  return flags;
}

export interface V2ContractShape {
  id: string;
  billingType?: string;
  billingRate?: number;
  linkedResidences?: string[];
  accommodationDetails?: { targetWorkersCount?: number; dailyRatePerWorker?: number };
}

/** فحص عقد واحد من `contractsV2`. */
export function flagV2Contract(contract: V2ContractShape): RateFlag[] {
  const flags: RateFlag[] = [];
  const rate = contract.billingRate || 0;

  if (rate <= 0) {
    flags.push({
      kind: 'zero_rate',
      severity: 'critical',
      messageAr: 'العقد بلا سعر — كل فاتورة تصدر منه ستكون بصفر ريال.',
      messageEn: 'Contract has no rate — every invoice it produces will be zero.',
    });
  }

  // مبلغ شهري ثابت يتجاوز ١٠٠ ألف ريال هو غالباً مبلغ سنوي وُضع في خانة شهرية،
  // وأثره أنه يُضخّم الإيراد الشهري في التقارير اثني عشر ضعفاً.
  if (contract.billingType === 'fixed_monthly' && rate > 100000) {
    flags.push({
      kind: 'yearly_rate_in_monthly_field',
      severity: 'warning',
      messageAr:
        `${rate.toLocaleString('en-US')} ر.س شهرياً مبلغ كبير — تحقق أنه ليس مبلغاً سنوياً ` +
        `في خانة شهرية (يُضخّم الإيراد الشهري اثني عشر ضعفاً). لو كان سنوياً لكان ` +
        `${(rate / 12).toLocaleString('en-US', { maximumFractionDigits: 2 })} ر.س شهرياً.`,
      messageEn:
        `${rate.toLocaleString('en-US')} SAR monthly is large — check it is not a yearly figure ` +
        `in a monthly field (it inflates monthly revenue twelvefold). As a yearly figure it ` +
        `would be ${(rate / 12).toLocaleString('en-US', { maximumFractionDigits: 2 })} SAR/month.`,
    });
  }

  const isPerPerson =
    contract.billingType === 'per_person_per_day' ||
    contract.billingType === 'per_person_per_month';

  if (isPerPerson && (contract.linkedResidences?.length || 0) === 0) {
    flags.push({
      kind: 'no_residence',
      severity: 'critical',
      messageAr: 'عقد فوترة بالفرد بلا سكن مرتبط — لن تُصدر له أي فاتورة إشغال.',
      messageEn: 'Per-person contract with no linked residence — it can never produce an invoice.',
    });
  }

  if (isPerPerson && !contract.accommodationDetails?.targetWorkersCount) {
    flags.push({
      kind: 'no_expected_workers',
      severity: 'warning',
      messageAr: 'لا عدد أفراد مستهدف — لا قيمة شهرية تقديرية لهذا العقد في التقارير.',
      messageEn: 'No target worker count — this contract shows no estimated monthly value in reports.',
    });
  }

  return flags;
}

export function hasCritical(flags: RateFlag[]): boolean {
  return flags.some(f => f.severity === 'critical');
}
