import {
  type ContractFormData,
  type Contract,
  getContractTypeInfo,
} from '@/types/contracts';

/**
 * التحقق من صحة بيانات العقد قبل الحفظ.
 *
 * دوال خالصة بلا Firestore ولا React: كل ما تحتاجه يُمرَّر إليها، فيمكن
 * استدعاؤها من المعالج ومن أي مسار إدخال آخر (استيراد جماعي، واجهة برمجية)
 * بنفس القواعد بالضبط.
 *
 * المعالج كان يسمح بالحفظ إذا كان اسم الطرف غير فارغ والسعر ≥ 0 فقط، فيمكن
 * إنشاء عقد بتاريخ نهاية قبل بدايته، أو عقد تسكين بسعر صفر، أو عقد ثانٍ يغطي
 * نفس الشركة ونفس السكن في نفس الفترة. هذه القواعد تسدّ ذلك عند المصدر.
 */

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  /** خطوة المعالج التي يُصحَّح فيها هذا الحقل. */
  step: number;
  field: string;
  severity: IssueSeverity;
  messageAr: string;
  messageEn: string;
}

/** أنواع الفوترة التي يكون فيها السعر لكل فرد، لا مبلغ العقد كاملاً. */
const PER_PERSON_BILLING = new Set(['per_person_per_day', 'per_person_per_month']);

/** حد أعلى تحذيري للسعر اليومي للفرد؛ ما فوقه غالباً مبلغ شهري في خانة يومية. */
const IMPLAUSIBLE_DAILY_RATE = 500;

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * عقدان يتعارضان إذا غطّيا نفس الطرف ونفس نوع العقد ونفس السكن وتقاطعت مدتاهما.
 * لا يمنع الحفظ — فقد يكون ملحقاً مقصوداً — لكنه يستحق أن يُرى قبل التأكيد.
 */
export function findOverlappingContracts(
  form: ContractFormData,
  existing: Contract[],
  excludeId?: string
): Contract[] {
  const start = parseDate(form.startDate);
  if (!start) return [];
  const end = form.isOpenEnded ? null : parseDate(form.endDate);

  return existing.filter(c => {
    if (excludeId && c.id === excludeId) return false;
    if (c.status === 'Cancelled' || c.status === 'Expired' || c.status === 'Draft') return false;
    if (c.contractType !== form.contractType) return false;

    const sameParty = form.partyId
      ? c.partyId === form.partyId
      : (c.partyName || '').trim().toLowerCase() === (form.partyName || '').trim().toLowerCase();
    if (!sameParty) return false;

    // بلا سكنات مرتبطة على أي من الجانبين يبقى التطابق على مستوى الطرف والنوع.
    const formResidences = form.linkedResidences || [];
    const otherResidences = c.linkedResidences || [];
    if (formResidences.length > 0 && otherResidences.length > 0) {
      const shares = formResidences.some(id => otherResidences.includes(id));
      if (!shares) return false;
    }

    const otherStart = parseDate(c.startDate);
    const otherEnd = c.isOpenEnded ? null : parseDate(c.endDate);
    if (!otherStart) return false;

    const startsBeforeOtherEnds = !otherEnd || start <= otherEnd;
    const otherStartsBeforeEnds = !end || otherStart <= end;
    return startsBeforeOtherEnds && otherStartsBeforeEnds;
  });
}

export function validateContractForm(
  form: ContractFormData,
  options: { existingContracts?: Contract[]; excludeId?: string } = {}
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const info = getContractTypeInfo(form.contractType);

  // ---- الخطوة 2: الطرف الآخر والمباني ----
  if (!form.partyName?.trim()) {
    issues.push({
      step: 2,
      field: 'partyName',
      severity: 'error',
      messageAr: 'اسم الطرف الثاني مطلوب.',
      messageEn: 'Party name is required.',
    });
  }

  if (!form.contractNumber?.trim()) {
    issues.push({
      step: 2,
      field: 'contractNumber',
      severity: 'error',
      messageAr: 'رقم العقد مطلوب.',
      messageEn: 'Contract number is required.',
    });
  }

  // عقد يُفوتر على الإشغال بلا سكن مرتبط لن يجد شيئاً ليحسبه.
  if (PER_PERSON_BILLING.has(form.billingType) && (form.linkedResidences?.length || 0) === 0) {
    issues.push({
      step: 2,
      field: 'linkedResidences',
      severity: 'error',
      messageAr: 'عقود الفوترة بالفرد تحتاج سكناً مرتبطاً واحداً على الأقل، وإلا لن تُصدر لها فواتير.',
      messageEn: 'Per-person contracts need at least one linked residence, otherwise no invoice can be generated.',
    });
  } else if (info.hasMultipleResidences && (form.linkedResidences?.length || 0) === 0) {
    issues.push({
      step: 2,
      field: 'linkedResidences',
      severity: 'warning',
      messageAr: 'لم يُربط أي سكن بهذا العقد.',
      messageEn: 'No residence linked to this contract.',
    });
  }

  // ---- الخطوة 3: الفوترة ----
  if (!form.billingRate || form.billingRate <= 0) {
    issues.push({
      step: 3,
      field: 'billingRate',
      severity: 'error',
      messageAr: 'مبلغ الفوترة يجب أن يكون أكبر من صفر.',
      messageEn: 'Billing rate must be greater than zero.',
    });
  }

  if (
    form.billingType === 'per_person_per_day' &&
    (form.billingRate || 0) > IMPLAUSIBLE_DAILY_RATE
  ) {
    issues.push({
      step: 3,
      field: 'billingRate',
      severity: 'warning',
      messageAr: `السعر ${form.billingRate} ر.س مرتفع لسعر يومي للفرد — تأكد أنه ليس مبلغاً شهرياً.`,
      messageEn: `${form.billingRate} SAR is high for a daily per-person rate — check it is not a monthly figure.`,
    });
  }

  if ((form.vatPercentage ?? 0) < 0 || (form.vatPercentage ?? 0) > 100) {
    issues.push({
      step: 3,
      field: 'vatPercentage',
      severity: 'error',
      messageAr: 'نسبة الضريبة يجب أن تكون بين 0 و 100.',
      messageEn: 'VAT percentage must be between 0 and 100.',
    });
  }

  if (PER_PERSON_BILLING.has(form.billingType) && !form.accommodationDetails?.targetWorkersCount) {
    issues.push({
      step: 3,
      field: 'targetWorkersCount',
      severity: 'warning',
      messageAr: 'بلا عدد أفراد مستهدف لن تظهر قيمة شهرية تقديرية لهذا العقد في التقارير.',
      messageEn: 'Without a target worker count this contract shows no estimated monthly value in reports.',
    });
  }

  // ---- الخطوة 4: المدة ----
  const start = parseDate(form.startDate);
  const end = parseDate(form.endDate);

  if (!start) {
    issues.push({
      step: 4,
      field: 'startDate',
      severity: 'error',
      messageAr: 'تاريخ بداية العقد مطلوب.',
      messageEn: 'Start date is required.',
    });
  }

  if (!form.isOpenEnded) {
    if (!end) {
      issues.push({
        step: 4,
        field: 'endDate',
        severity: 'error',
        messageAr: 'تاريخ نهاية العقد مطلوب، أو حدِّد العقد كمفتوح المدة.',
        messageEn: 'End date is required, or mark the contract as open-ended.',
      });
    } else if (start && end <= start) {
      issues.push({
        step: 4,
        field: 'endDate',
        severity: 'error',
        messageAr: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.',
        messageEn: 'End date must be after the start date.',
      });
    }
  }

  if (start && end && !form.isOpenEnded) {
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (days > 365 * 10) {
      issues.push({
        step: 4,
        field: 'endDate',
        severity: 'warning',
        messageAr: 'مدة العقد تتجاوز عشر سنوات — تحقق من التاريخ.',
        messageEn: 'Contract term exceeds ten years — check the date.',
      });
    }
  }

  if ((form.noticePeriodDays ?? 0) < 0) {
    issues.push({
      step: 4,
      field: 'noticePeriodDays',
      severity: 'error',
      messageAr: 'مدة الإشعار لا يمكن أن تكون سالبة.',
      messageEn: 'Notice period cannot be negative.',
    });
  }

  // الضمانات: مبلغ صفر أو تاريخ انتهاء ماضٍ يعني ضماناً غير فعّال.
  (form.guarantees || []).forEach((g, i) => {
    if (!g.amount || g.amount <= 0) {
      issues.push({
        step: 4,
        field: `guarantees.${i}.amount`,
        severity: 'warning',
        messageAr: `الضمان رقم ${i + 1} بلا مبلغ.`,
        messageEn: `Guarantee ${i + 1} has no amount.`,
      });
    }
  });

  // ---- تعارض مع عقود قائمة ----
  const overlapping = findOverlappingContracts(
    form,
    options.existingContracts || [],
    options.excludeId
  );
  if (overlapping.length > 0) {
    const names = overlapping.map(c => c.contractNumber || c.id).join('، ');
    issues.push({
      step: 2,
      field: 'overlap',
      severity: 'warning',
      messageAr: `يوجد ${overlapping.length} عقد سارٍ لنفس الطرف والنوع والسكن في فترة متقاطعة (${names}). إن كان ملحقاً فاربطه بالعقد الأصلي.`,
      messageEn: `${overlapping.length} active contract(s) already cover the same party, type and residence in an overlapping period (${names}). If this is an addendum, link it to the parent contract.`,
    });
  }

  return issues;
}

/** أخطاء تمنع الحفظ، مقابل تحذيرات تُعرض ولا تمنع. */
export function blockingIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter(i => i.severity === 'error');
}

/** أخطاء الخطوة الحالية فقط، لتعطيل زر "الخطوة التالية". */
export function issuesForStep(issues: ValidationIssue[], step: number): ValidationIssue[] {
  return issues.filter(i => i.step === step);
}
