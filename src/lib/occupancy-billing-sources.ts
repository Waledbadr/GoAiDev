import {
  type BillingPeriod,
  type BillingTerms,
  isContractActiveInPeriod,
  isOccupancyBilled,
  resolveDailyRate,
  termsFromLegacyContract,
  termsFromContractV2,
  NOMINAL_DAYS_PER_MONTH,
  type RateUnit,
} from './billing-engine';

/**
 * توحيد مصادر عقود الفوترة بالإشغال.
 *
 * توجد مجموعتا عقود: `contracts` القديمة و`contractsV2` الجديدة. كانت دورة
 * الفوترة تقرأ القديمة وحدها، فأي عقد يُنشأ في الواجهة الجديدة لا يُفوتَر
 * إطلاقاً — ومحوّل `termsFromContractV2` مكتوب في محرك الفوترة ولا يُستدعى.
 *
 * هذه الوحدة تدمج المصدرين في قائمة واحدة من الشروط المطبَّعة، فيبقى المحرك
 * جاهلاً بأيّ من النموذجين، وتظل فترة التوازي آمنة: العقد المُرحَّل يحتفظ
 * بمعرّفه، فيُطابَق ويُفوتَر مرة واحدة لا مرتين.
 */

export interface OccupancyBillingSource {
  terms: BillingTerms;
  source: 'legacy' | 'v2';
  /** السكنات بعد فكّ الرمز `all`. */
  residenceIds: string[];
  /** المبلغ الشهري المعروض على الفاتورة، مشتق من السعر اليومي عند اللزوم. */
  ratePerPersonPerMonth: number;
}

/** عقد استُبعد من الفوترة، مع سبب صالح للعرض على المستخدم. */
export interface UnbillableContract {
  contractId: string;
  reason: 'unresolved_rate_unit';
}

export interface OccupancyBillingCollection {
  sources: OccupancyBillingSource[];
  /** عقود قائمة في الفترة لكنها غير قابلة للفوترة بعد. */
  unbillable: UnbillableContract[];
}

export interface LegacyOccupancyContract {
  id: string;
  companyId: string;
  residenceId?: string;
  residenceIds?: string[];
  ratePerPersonPerMonth: number;
  rateUnit?: RateUnit;
  startDate: string;
  endDate: string;
  status: string;
}

export interface V2OccupancyContract {
  id: string;
  partyId: string;
  contractType: string;
  billingType: string;
  billingRate: number;
  accommodationDetails?: { dailyRatePerWorker?: number };
  linkedResidences?: string[];
  startDate: string;
  endDate: string;
  status: string;
  archivedAt?: unknown;
}

/** `all` رمز قديم يعني كل السكنات. */
export function resolveResidenceIds(
  contract: { residenceId?: string; residenceIds?: string[] },
  allResidenceIds: string[]
): string[] {
  const ids = contract.residenceIds?.length
    ? contract.residenceIds
    : contract.residenceId
      ? [contract.residenceId]
      : [];
  return ids.includes('all') ? allResidenceIds : ids;
}

export function collectOccupancyBillingSources(input: {
  legacyContracts: LegacyOccupancyContract[];
  v2Contracts: V2OccupancyContract[];
  allResidenceIds: string[];
  period: BillingPeriod;
}): OccupancyBillingCollection {
  const { legacyContracts, v2Contracts, allResidenceIds, period } = input;

  const sources = new Map<string, OccupancyBillingSource>();
  const unbillable: UnbillableContract[] = [];

  for (const contract of legacyContracts) {
    const terms = termsFromLegacyContract(contract);
    if (!isContractActiveInPeriod(terms, period)) continue;

    // العقد الذي لم يُحدَّد فيه أن المبلغ يومي أم شهري لا يُفوتَر بالتخمين:
    // القراءتان تفترقان بثلاثين ضعفاً. يُبلَّغ عنه ليُحسم، ولا تُصدر له فاتورة.
    const dailyRate = resolveDailyRate(contract);
    if (dailyRate === null) {
      unbillable.push({ contractId: contract.id, reason: 'unresolved_rate_unit' });
      continue;
    }

    sources.set(contract.id, {
      terms,
      source: 'legacy',
      residenceIds: resolveResidenceIds(contract, allResidenceIds),
      ratePerPersonPerMonth: dailyRate * NOMINAL_DAYS_PER_MONTH,
    });
  }

  for (const contract of v2Contracts) {
    if (contract.archivedAt) continue;
    // العقود الثابتة وعقود الوحدة تُفوتَر من شروطها لا من الإشغال؛ إقحامها هنا
    // ينتج فاتورة بيوم واحد بدل الشهر كاملاً.
    if (!isOccupancyBilled(contract.contractType, contract.billingType)) continue;

    const terms = termsFromContractV2(contract);
    if (terms.dailyRate <= 0) continue;
    if (!isContractActiveInPeriod(terms, period)) continue;

    // الترحيل يحتفظ بمعرّف المستند، فالعقد الموجود في المجموعتين هو نفسه.
    // النسخة الجديدة تحمل السعر بوحدته المتفق عليها، فهي الأولى بالاعتماد.
    sources.set(contract.id, {
      terms,
      source: 'v2',
      residenceIds: terms.residenceIds,
      ratePerPersonPerMonth: terms.dailyRate * NOMINAL_DAYS_PER_MONTH,
    });
  }

  return { sources: Array.from(sources.values()), unbillable };
}
