import { resolveDailyRate, type RateUnit } from './billing-engine';
import { resolveResidenceIds } from './occupancy-billing-sources';

/**
 * تخطيط ترحيل العقود من `contracts` إلى `contractsV2`.
 *
 * دالة خالصة: تستقبل ما قرأه المستدعي وتُرجع الخطة، بلا Firestore ولا كتابة.
 * يستعملها السكربت والواجهة معاً، فما تراه في المعاينة هو ما سيُكتب بالضبط —
 * لا نسختان من نفس المنطق تتباعدان.
 *
 * المستندات تحتفظ بمعرّفاتها، فالفاتورة التي تشير إلى `contractId` تظل صحيحة
 * في المجموعتين أثناء فترة التوازي، وإعادة التشغيل تكتب فوق القديم ولا تُكرّره.
 */

export interface MigrationLegacyContract {
  id: string;
  companyId: string;
  residenceId?: string;
  residenceIds?: string[];
  startDate: string;
  endDate: string;
  ratePerPersonPerMonth: number;
  rateUnit?: RateUnit;
  expectedWorkers?: number;
  status?: string;
  notes?: string;
  createdAt?: string;
  createdBy?: string;
}

export type SkipReason =
  | 'company_not_found'
  | 'no_residences'
  | 'zero_rate'
  | 'unresolved_rate_unit'
  | 'already_migrated';

export interface MigrationSkip {
  contractId: string;
  companyName: string;
  reason: SkipReason;
  detailAr: string;
  detailEn: string;
}

export interface MigrationPlanItem {
  contractId: string;
  companyName: string;
  /** الرقم كما هو في العقد القديم، مع وحدته. */
  rawRate: number;
  rateUnit: RateUnit;
  /** الأجرة اليومية بعد تفسير الوحدة — وهي ما يُكتب في النظام الجديد. */
  dailyRate: number;
  residenceCount: number;
  payload: Record<string, unknown>;
}

export interface MigrationPlan {
  items: MigrationPlanItem[];
  skips: MigrationSkip[];
  /** عقود موجودة في V2 بنفس المعرّف: الترحيل سيكتب فوقها. */
  overwrites: string[];
}

export function planContractMigration(input: {
  legacyContracts: MigrationLegacyContract[];
  companyNames: Map<string, string>;
  residenceNames: Map<string, string>;
  allResidenceIds: string[];
  existingV2Ids: Set<string>;
}): MigrationPlan {
  const { legacyContracts, companyNames, residenceNames, allResidenceIds, existingV2Ids } = input;

  const items: MigrationPlanItem[] = [];
  const skips: MigrationSkip[] = [];
  const overwrites: string[] = [];

  for (const legacy of legacyContracts) {
    const companyName = companyNames.get(legacy.companyId) ?? legacy.companyId;

    if (!companyNames.has(legacy.companyId)) {
      skips.push({
        contractId: legacy.id,
        companyName,
        reason: 'company_not_found',
        detailAr: `الشركة "${legacy.companyId}" غير موجودة في سجل الشركات.`,
        detailEn: `Company "${legacy.companyId}" is not in the companies collection.`,
      });
      continue;
    }

    const residenceIds = resolveResidenceIds(legacy, allResidenceIds);
    if (residenceIds.length === 0) {
      skips.push({
        contractId: legacy.id,
        companyName,
        reason: 'no_residences',
        detailAr: 'لا سكن مرتبط بالعقد — لا شيء يُفوتَر عليه.',
        detailEn: 'No residence linked — nothing to bill against.',
      });
      continue;
    }

    const rawRate = Number(legacy.ratePerPersonPerMonth) || 0;
    if (rawRate <= 0) {
      skips.push({
        contractId: legacy.id,
        companyName,
        reason: 'zero_rate',
        detailAr: `الأجرة ${rawRate} — لا قيمة تُرحَّل.`,
        detailEn: `Rate is ${rawRate} — nothing to migrate.`,
      });
      continue;
    }

    // النظام الجديد يحمل الأجرة اليومية صراحةً، فلا بد أن تُعرف وحدة الرقم
    // القديم قبل نقله. العقد الذي لم تُحسم وحدته يُرحَّل بقيمة خاطئة بثلاثين
    // ضعفاً في أحد الاتجاهين، ويصير الخطأ دائماً وأصعب اكتشافاً.
    const dailyRate = resolveDailyRate(legacy);
    if (dailyRate === null) {
      skips.push({
        contractId: legacy.id,
        companyName,
        reason: 'unresolved_rate_unit',
        detailAr:
          `لم تُحدَّد وحدة الأجرة (${rawRate} ر.س) — يومية أم شهرية؟ ` +
          `حدّدها من شاشة عقود السكن ثم أعد المعاينة.`,
        detailEn:
          `Rate unit not set (${rawRate} SAR) — daily or monthly? ` +
          `Set it on the accommodation contracts screen, then preview again.`,
      });
      continue;
    }

    if (existingV2Ids.has(legacy.id)) overwrites.push(legacy.id);

    const now = new Date().toISOString();

    items.push({
      contractId: legacy.id,
      companyName,
      rawRate,
      rateUnit: legacy.rateUnit as RateUnit,
      dailyRate,
      residenceCount: residenceIds.length,
      payload: {
        id: legacy.id,
        legacyContractId: legacy.id,
        title: `تسكين عمالة — ${companyName}`,

        contractType: 'accommodation_agreement',
        contractCategory: 'revenue',

        partyType: 'company',
        partyId: legacy.companyId,
        partyName: companyName,

        linkedResidences: residenceIds,
        linkedResidenceNames: residenceIds.map(id => residenceNames.get(id) ?? id),

        startDate: legacy.startDate,
        endDate: legacy.endDate,
        isOpenEnded: false,

        currency: 'SAR',
        // السعر ينتقل بوحدته الحقيقية: للشخص، في اليوم.
        billingType: 'per_person_per_day',
        billingRate: dailyRate,
        billingUnit: 'شخص/يوم',
        accommodationDetails: {
          dailyRatePerWorker: dailyRate,
          targetWorkersCount: legacy.expectedWorkers ?? null,
        },

        renewalType: 'manual',
        autoRenew: false,
        noticePeriodDays: 30,
        renewalCount: 0,

        status:
          legacy.status === 'Expired' || legacy.status === 'Cancelled' ? legacy.status : 'Active',
        notes: legacy.notes ?? '',

        createdBy: legacy.createdBy ?? 'migration',
        createdAt: legacy.createdAt ?? now,
        updatedAt: now,
        migratedAt: now,
      },
    });
  }

  return { items, skips, overwrites };
}
