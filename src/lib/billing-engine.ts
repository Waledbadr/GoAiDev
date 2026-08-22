import { differenceInDays } from "date-fns";

/**
 * Occupancy billing engine.
 *
 * Pure functions: no Firestore, no React context, no toasts. Everything the
 * engine needs is passed in, so a billing run can be reproduced and asserted
 * against a known set of movements.
 *
 * The engine deliberately speaks in `BillingTerms` rather than in any one
 * contract type. Both the legacy `contracts` model and the newer `contractsV2`
 * model have adapters at the bottom of this file, so the day-counting logic
 * stays identical while the contract model underneath it changes.
 *
 * Extracted from accommodation-context.generateMonthlyInvoices. The counting
 * behaviour is preserved exactly, quirks included, so that invoices generated
 * before and after the extraction can be compared line by line.
 */

export const NOMINAL_DAYS_PER_MONTH = 30;

export interface BillingPeriod {
  startDate: Date;
  endDate: Date;
}

/** A contract reduced to what billing actually needs. */
export interface BillingTerms {
  contractId: string;
  companyId: string;
  /** Already resolved to a per-person-per-day figure. */
  dailyRate: number;
  residenceIds: string[];
  startDate: string;
  endDate: string;
  status: string;
}

export interface OccupancySpan {
  workerId: string;
  residenceId: string;
  since: string;
  until?: string | null;
}

export interface MovementEvent {
  workerId: string;
  residenceId: string;
  toResidenceId?: string;
  fromResidenceId?: string;
  actionType: "CHECK_IN" | "CHECK_OUT" | "TRANSFER" | "SWAP";
  actionDate: string;
}

export interface BillableWorker {
  id: string;
  name: string;
  idNumber?: string;
  company?: string;
}

export interface InvoiceLine {
  workerId: string;
  name: string;
  idNumber?: string;
  residenceId: string;
  days: number;
  dailyRate: number;
  amount: number;
}

export interface ResidenceBilling {
  contractId: string;
  companyId: string;
  residenceId: string;
  period: BillingPeriod;
  lines: InvoiceLine[];
  totalWorkers: number;
  totalDays: number;
  totalAmount: number;
}

/** What the engine reads to decide who was where, and when. */
export interface OccupancyContext {
  occupancy: OccupancySpan[];
  movements: MovementEvent[];
}

/**
 * Occupancy is counted in calendar days including BOTH the arrival and the
 * departure day, so a same-day stay bills 1 day.
 *
 * Consequence worth knowing: a worker who transfers between residences on day X
 * has day X billed by both residences, and when those sit under different
 * contracts the same day is billed to two parties. That is the long-standing
 * behaviour and is preserved deliberately — moving to night-based counting
 * would change every invoice, so it belongs in its own decision.
 */
export function billableDaysInclusive(from: Date, to: Date): number {
  return Math.max(0, differenceInDays(to, from) + 1);
}

/**
 * The unit a legacy contract's rate figure is expressed in.
 *
 * Accommodation is agreed per person per DAY. The legacy field is named
 * `ratePerPersonPerMonth` and the entry form was labelled "Rate per
 * Person/Month", so some contracts were entered at the agreed daily figure and
 * others at that figure times thirty — the same column holding two units, with
 * nothing recording which. Billing then divided everything by thirty, so the
 * daily ones were invoiced at a thirtieth of their value.
 *
 * The unit is now stored on the contract instead of being implied by a field
 * name. A name cannot be trusted to carry meaning that the data contradicts.
 */
export type RateUnit = "daily" | "monthly";

export interface LegacyRateShape {
  /** Misnamed: holds either a daily or a monthly figure, per `rateUnit`. */
  ratePerPersonPerMonth?: number;
  rateUnit?: RateUnit;
}

/**
 * The per-person-per-day figure to bill, or `null` when the contract does not
 * say which unit its number is in.
 *
 * Returning `null` rather than guessing is deliberate: the two readings differ
 * by a factor of thirty, so an inference that goes the wrong way either bills a
 * thirtieth of what was agreed or thirty times it. A contract that cannot say
 * what its own rate means must not be invoiced until someone says.
 */
export function resolveDailyRate(contract: LegacyRateShape): number | null {
  const value = contract.ratePerPersonPerMonth || 0;
  if (value <= 0) return null;

  switch (contract.rateUnit) {
    case "daily":
      return value;
    case "monthly":
      return value / NOMINAL_DAYS_PER_MONTH;
    default:
      return null;
  }
}

/** A contract bills for a period only if its own term overlaps that period. */
export function isContractActiveInPeriod(terms: BillingTerms, period: BillingPeriod): boolean {
  if (terms.status !== "Active") return false;
  const contractStart = new Date(terms.startDate);
  const contractEnd = new Date(terms.endDate);
  return contractStart < period.endDate && contractEnd > period.startDate;
}

function overlapsPeriod(span: OccupancySpan, period: BillingPeriod): boolean {
  const start = new Date(span.since);
  const end = span.until ? new Date(span.until) : period.endDate;
  return start <= period.endDate && end >= period.startDate;
}

/**
 * Everyone who occupied `residenceId` at any point in the period, whether they
 * are still there, already checked out, or only appear via a movement record.
 */
export function findWorkerIdsInResidence(
  residenceId: string,
  period: BillingPeriod,
  ctx: OccupancyContext
): Set<string> {
  const ids = new Set<string>();

  for (const occ of ctx.occupancy) {
    if (occ.residenceId !== residenceId) continue;
    if (!occ.until || overlapsPeriod(occ, period)) ids.add(occ.workerId);
  }

  for (const move of ctx.movements) {
    if (move.residenceId === residenceId || move.toResidenceId === residenceId) {
      ids.add(move.workerId);
    }
  }

  return ids;
}

/**
 * Restrict a candidate set to the workers belonging to the billed company.
 *
 * Workers carry their employer as a free-text `company` string rather than an
 * id, so this compares against every name the company is known by. Kept as its
 * own function because it is a data-quality workaround, not billing logic: once
 * workers reference a company id this can be replaced without touching any of
 * the day counting.
 */
export function selectBillableWorkers(
  workers: BillableWorker[],
  workerIds: Set<string>,
  company: { id: string; name?: string; nameAr?: string; nameEn?: string }
): BillableWorker[] {
  const aliases = new Set(
    [company.name, company.nameAr, company.nameEn, company.id]
      .map((value) => (value || "").trim().toLowerCase())
      .filter(Boolean)
  );

  return workers.filter(
    (worker) => workerIds.has(worker.id) && aliases.has((worker.company || "").trim().toLowerCase())
  );
}

/**
 * Billable days for one worker in one residence over one period.
 *
 * Two paths, matching the data available:
 *  - No movement records in the period: the worker's state never changed, so
 *    the answer is the overlap between their occupancy spans and the period.
 *  - Movement records present: walk them in order, accumulating days for every
 *    stretch the worker was inside, and close the final stretch at period end.
 */
export function countBillableDays(
  workerId: string,
  residenceId: string,
  period: BillingPeriod,
  ctx: OccupancyContext
): number {
  const { startDate, endDate } = period;

  const movements = ctx.movements
    .filter((m) => m.workerId === workerId && m.residenceId === residenceId)
    .sort((a, b) => new Date(a.actionDate).getTime() - new Date(b.actionDate).getTime());

  const spans = ctx.occupancy.filter(
    (o) => o.workerId === workerId && o.residenceId === residenceId && overlapsPeriod(o, period)
  );

  if (movements.length === 0) {
    let days = 0;
    for (const span of spans) {
      const spanStart = new Date(span.since);
      const spanEnd = span.until ? new Date(span.until) : endDate;
      const effectiveStart = spanStart > startDate ? spanStart : startDate;
      const effectiveEnd = spanEnd < endDate ? spanEnd : endDate;
      if (effectiveStart <= effectiveEnd) {
        days += billableDaysInclusive(effectiveStart, effectiveEnd);
      }
    }
    return days;
  }

  // The first event tells us the state the worker was in when the period
  // opened: you can only leave somewhere you were already inside.
  const firstEvent = movements[0];
  const isTransferOut =
    firstEvent.actionType === "TRANSFER" && firstEvent.fromResidenceId === residenceId;
  let isInside = firstEvent.actionType === "CHECK_OUT" || isTransferOut;

  let days = 0;
  let lastDate = startDate;

  for (const event of movements) {
    const eventDate = new Date(event.actionDate);
    if (eventDate < startDate) continue;
    if (eventDate > endDate) break;

    if (isInside) {
      days += billableDaysInclusive(lastDate, eventDate);
    }

    // Compare against the residence being billed: a TRANSFER whose destination
    // is this residence is an arrival, anything else ends the stay.
    const isTransferIn = event.actionType === "TRANSFER" && event.toResidenceId === residenceId;
    isInside = event.actionType === "CHECK_IN" || isTransferIn;
    lastDate = eventDate;
  }

  if (isInside) {
    days += billableDaysInclusive(lastDate, endDate);
  }

  return days;
}

/** Bill one residence of one contract, producing a line per worker. */
export function billResidence(
  terms: BillingTerms,
  residenceId: string,
  period: BillingPeriod,
  workers: BillableWorker[],
  ctx: OccupancyContext
): ResidenceBilling {
  const lines: InvoiceLine[] = [];

  for (const worker of workers) {
    const days = countBillableDays(worker.id, residenceId, period, ctx);
    if (days <= 0) continue;

    lines.push({
      workerId: worker.id,
      name: worker.name,
      idNumber: worker.idNumber,
      residenceId,
      days,
      dailyRate: terms.dailyRate,
      amount: terms.dailyRate * days,
    });
  }

  const totalDays = lines.reduce((sum, line) => sum + line.days, 0);
  const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);

  return {
    contractId: terms.contractId,
    companyId: terms.companyId,
    residenceId,
    period,
    lines,
    totalWorkers: lines.length,
    totalDays,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

// ============ CONTRACT ADAPTERS ============
// Each contract model is normalised into BillingTerms here, so the engine never
// learns about either of them.

/**
 * Legacy `contracts` collection.
 *
 * The rate is interpreted through the contract's own `rateUnit` (see
 * `resolveDailyRate`). A contract that has not declared its unit yields a
 * `dailyRate` of 0, which callers treat as "not billable yet" rather than
 * silently invoicing the wrong figure — use `termsFromLegacyContractOrNull`
 * when you need to tell the two apart.
 */
export function termsFromLegacyContract(contract: {
  id: string;
  companyId: string;
  residenceId?: string;
  residenceIds?: string[];
  ratePerPersonPerMonth: number;
  rateUnit?: RateUnit;
  startDate: string;
  endDate: string;
  status: string;
}): BillingTerms {
  return {
    contractId: contract.id,
    companyId: contract.companyId,
    dailyRate: resolveDailyRate(contract) ?? 0,
    residenceIds: contract.residenceIds?.length
      ? contract.residenceIds
      : contract.residenceId
        ? [contract.residenceId]
        : [],
    startDate: contract.startDate,
    endDate: contract.endDate,
    status: contract.status,
  };
}

/**
 * `contractsV2` collection, which carries the rate in its agreed unit rather
 * than forcing it through a monthly figure.
 */
export function termsFromContractV2(contract: {
  id: string;
  partyId: string;
  billingType: string;
  billingRate: number;
  accommodationDetails?: { dailyRatePerWorker?: number };
  linkedResidences?: string[];
  startDate: string;
  endDate: string;
  status: string;
}): BillingTerms {
  const explicitDaily = contract.accommodationDetails?.dailyRatePerWorker;

  let dailyRate: number;
  if (typeof explicitDaily === "number" && explicitDaily > 0) {
    dailyRate = explicitDaily;
  } else if (contract.billingType === "per_person_per_day") {
    dailyRate = contract.billingRate || 0;
  } else if (contract.billingType === "per_person_per_month") {
    dailyRate = (contract.billingRate || 0) / NOMINAL_DAYS_PER_MONTH;
  } else {
    // Fixed and per-unit contracts are not occupancy-billed; a caller that
    // reaches here is asking the wrong engine, so bill nothing rather than
    // silently inventing a per-day figure out of a monthly lump sum.
    dailyRate = 0;
  }

  return {
    contractId: contract.id,
    companyId: contract.partyId,
    dailyRate,
    residenceIds: contract.linkedResidences ?? [],
    startDate: contract.startDate,
    endDate: contract.endDate,
    status: contract.status,
  };
}

/** Contract types whose amount comes from occupancy rather than a flat figure. */
export const OCCUPANCY_BILLED_TYPES = new Set([
  "accommodation_agreement",
  "worker_housing_revenue",
  "worker_housing_expense",
]);

export function isOccupancyBilled(contractType: string, billingType: string): boolean {
  return (
    OCCUPANCY_BILLED_TYPES.has(contractType) ||
    billingType === "per_person_per_day" ||
    billingType === "per_person_per_month"
  );
}
