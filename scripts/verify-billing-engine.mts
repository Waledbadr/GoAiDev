import {
  countBillableDays,
  billResidence,
  termsFromLegacyContract,
  type BillingPeriod,
  type OccupancyContext,
} from "../src/lib/billing-engine";
import { collectOccupancyBillingSources } from "../src/lib/occupancy-billing-sources";
import { resolveDailyRate } from "../src/lib/billing-engine";

// Fiscal month 2026-08 = 21/07/2026 -> 20/08/2026 (31 days)
const period: BillingPeriod = {
  startDate: new Date("2026-07-21T00:00:00Z"),
  endDate: new Date("2026-08-20T00:00:00Z"),
};

const RES_A = "res_A";
const RES_B = "res_B";

function ctx(partial: Partial<OccupancyContext>): OccupancyContext {
  return { occupancy: [], movements: [], ...partial };
}

const cases: Array<{ name: string; expected: number; run: () => number }> = [
  {
    name: "Present all month, still checked in, no movements",
    expected: 31,
    run: () =>
      countBillableDays("w1", RES_A, period, ctx({
        occupancy: [{ workerId: "w1", residenceId: RES_A, since: "2026-01-01", until: null }],
      })),
  },
  {
    name: "Checked in on 01/08, no movement record",
    expected: 20, // 01/08 .. 20/08 inclusive
    run: () =>
      countBillableDays("w2", RES_A, period, ctx({
        occupancy: [{ workerId: "w2", residenceId: RES_A, since: "2026-08-01", until: null }],
      })),
  },
  {
    name: "Same-day check-in and check-out",
    expected: 1,
    run: () =>
      countBillableDays("w3", RES_A, period, ctx({
        occupancy: [{ workerId: "w3", residenceId: RES_A, since: "2026-08-05", until: "2026-08-05" }],
      })),
  },
  {
    name: "Inside at period start, checked out 30/07 (movement)",
    expected: 10, // 21/07 .. 30/07
    run: () =>
      countBillableDays("w4", RES_A, period, ctx({
        occupancy: [{ workerId: "w4", residenceId: RES_A, since: "2026-05-01", until: "2026-07-30" }],
        movements: [
          { workerId: "w4", residenceId: RES_A, actionType: "CHECK_OUT", actionDate: "2026-07-30" },
        ],
      })),
  },
  {
    name: "TRANSFER INTO residence B on 01/08 (the multi-residence fix)",
    expected: 20, // 01/08 .. 20/08 -- was 0 before the fix
    run: () =>
      countBillableDays("w5", RES_B, period, ctx({
        occupancy: [{ workerId: "w5", residenceId: RES_B, since: "2026-08-01", until: null }],
        movements: [
          {
            workerId: "w5",
            residenceId: RES_B,
            fromResidenceId: RES_A,
            toResidenceId: RES_B,
            actionType: "TRANSFER",
            actionDate: "2026-08-01",
          },
        ],
      })),
  },
  {
    name: "Same worker, transfer OUT of residence A on 01/08",
    expected: 12, // 21/07 .. 01/08 -- note 01/08 counted here too
    run: () =>
      countBillableDays("w5", RES_A, period, ctx({
        occupancy: [{ workerId: "w5", residenceId: RES_A, since: "2026-01-01", until: "2026-08-01" }],
        movements: [
          {
            workerId: "w5",
            residenceId: RES_A,
            fromResidenceId: RES_A,
            toResidenceId: RES_B,
            actionType: "TRANSFER",
            actionDate: "2026-08-01",
          },
        ],
      })),
  },
];

let failures = 0;
console.log(`\nFiscal period: 21/07/2026 -> 20/08/2026 (31 days)\n`);
for (const c of cases) {
  const actual = c.run();
  const ok = actual === c.expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${String(actual).padStart(3)} days (expected ${c.expected})  ${c.name}`);
}

// Rate unit is now explicit. 600 marked "monthly" is the 20 SAR/day it always was.
const terms = termsFromLegacyContract({
  id: "ctr_1",
  companyId: "co_bremco",
  residenceIds: [RES_A],
  ratePerPersonPerMonth: 600,
  rateUnit: "monthly",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "Active",
});

// The unit decides the reading; the same number means two very different things.
console.log(`\n--- Rate unit resolution ---\n`);
const unitChecks: Array<{ name: string; actual: number | null; expected: number | null }> = [
  { name: "13 marked daily   -> 13 SAR/day",
    actual: resolveDailyRate({ ratePerPersonPerMonth: 13, rateUnit: "daily" }), expected: 13 },
  { name: "390 marked monthly -> 13 SAR/day",
    actual: resolveDailyRate({ ratePerPersonPerMonth: 390, rateUnit: "monthly" }), expected: 13 },
  { name: "13 with NO unit    -> null (refuse to guess)",
    actual: resolveDailyRate({ ratePerPersonPerMonth: 13 }), expected: null },
  { name: "0 marked daily     -> null (nothing to bill)",
    actual: resolveDailyRate({ ratePerPersonPerMonth: 0, rateUnit: "daily" }), expected: null },
];
for (const chk of unitChecks) {
  const ok = chk.actual === chk.expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${chk.name}  (got ${chk.actual})`);
}

console.log(`\nDaily rate resolved from 600 SAR/month: ${terms.dailyRate} SAR/day`);

const billing = billResidence(
  terms,
  RES_A,
  period,
  [{ id: "w1", name: "Worker One", company: "co_bremco" }],
  ctx({ occupancy: [{ workerId: "w1", residenceId: RES_A, since: "2026-01-01", until: null }] })
);

console.log(`Full-month invoice: ${billing.totalDays} days x ${terms.dailyRate} = ${billing.totalAmount} SAR`);
console.log(`Lines: ${JSON.stringify(billing.lines, null, 2)}`);

const rateOk = terms.dailyRate === 20;
const amountOk = billing.totalAmount === 620;
if (!rateOk || !amountOk) failures++;

// ---- Unified source collection: legacy + contractsV2 ----
console.log(`
--- Occupancy billing sources (legacy + V2 merge) ---
`);

const legacy = [
  { id: "ctr_legacy_only", companyId: "co_a", residenceIds: [RES_A], ratePerPersonPerMonth: 600, rateUnit: "monthly" as const, startDate: "2026-01-01", endDate: "2026-12-31", status: "Active" },
  { id: "ctr_migrated", companyId: "co_b", residenceIds: ["all"], ratePerPersonPerMonth: 390, rateUnit: "monthly" as const, startDate: "2026-01-01", endDate: "2026-12-31", status: "Active" },
  { id: "ctr_out_of_period", companyId: "co_c", residenceIds: [RES_A], ratePerPersonPerMonth: 600, rateUnit: "monthly" as const, startDate: "2020-01-01", endDate: "2020-12-31", status: "Active" },
  // Entered at the agreed daily figure, with the unit now recorded. Before the
  // unit existed this was divided by 30 and invoiced at 0.43 SAR/day.
  { id: "ctr_daily_unit", companyId: "co_g", residenceIds: [RES_A], ratePerPersonPerMonth: 13, rateUnit: "daily" as const, startDate: "2026-01-01", endDate: "2026-12-31", status: "Active" },
  // No unit recorded: must not be billed at all.
  { id: "ctr_no_unit", companyId: "co_h", residenceIds: [RES_A], ratePerPersonPerMonth: 16, startDate: "2026-01-01", endDate: "2026-12-31", status: "Active" },
];

const v2 = [
  // Same id as a legacy contract: the migration preserves document ids, so this
  // is the SAME contract and must not be billed twice.
  { id: "ctr_migrated", partyId: "co_b", contractType: "accommodation_agreement", billingType: "per_person_per_day", billingRate: 13, linkedResidences: [RES_A, RES_B], startDate: "2026-01-01", endDate: "2026-12-31", status: "Active" },
  { id: "ctr_v2_only", partyId: "co_d", contractType: "accommodation_agreement", billingType: "per_person_per_day", billingRate: 25, linkedResidences: [RES_B], startDate: "2026-01-01", endDate: "2026-12-31", status: "Active" },
  // Fixed-monthly lease is not occupancy billed and must be excluded.
  { id: "ctr_v2_lease", partyId: "co_e", contractType: "lease_out", billingType: "fixed_monthly", billingRate: 50000, linkedResidences: [RES_A], startDate: "2026-01-01", endDate: "2026-12-31", status: "Active" },
  { id: "ctr_v2_archived", partyId: "co_f", contractType: "accommodation_agreement", billingType: "per_person_per_day", billingRate: 30, linkedResidences: [RES_B], startDate: "2026-01-01", endDate: "2026-12-31", status: "Active", archivedAt: "2026-05-01" },
];

const collected = collectOccupancyBillingSources({
  legacyContracts: legacy,
  v2Contracts: v2,
  allResidenceIds: [RES_A, RES_B],
  period,
});
const sources = collected.sources;

const byId = new Map(sources.map((s) => [s.terms.contractId, s]));
const countOf = (id: string) => sources.filter((s) => s.terms.contractId === id).length;

const sourceChecks: Array<{ name: string; pass: boolean; detail: string }> = [
  { name: "legacy-only contract is billed",            pass: byId.get("ctr_legacy_only")?.source === "legacy", detail: String(byId.get("ctr_legacy_only")?.source) },
  { name: "contract outside the period is excluded",   pass: !byId.has("ctr_out_of_period"),                   detail: byId.has("ctr_out_of_period") ? "present" : "absent" },
  { name: "migrated contract billed ONCE, from V2",    pass: countOf("ctr_migrated") === 1 && byId.get("ctr_migrated")?.source === "v2", detail: `${countOf("ctr_migrated")}x from ${byId.get("ctr_migrated")?.source}` },
  { name: "V2 rate used verbatim, not divided by 30",  pass: byId.get("ctr_migrated")?.terms.dailyRate === 13, detail: `${byId.get("ctr_migrated")?.terms.dailyRate} SAR/day` },
  { name: "V2-only accommodation contract is billed",  pass: byId.get("ctr_v2_only")?.terms.dailyRate === 25,  detail: `${byId.get("ctr_v2_only")?.terms.dailyRate} SAR/day` },
  { name: "fixed-monthly lease NOT occupancy billed",  pass: !byId.has("ctr_v2_lease"),                        detail: byId.has("ctr_v2_lease") ? "present" : "absent" },
  { name: "archived V2 contract is excluded",          pass: !byId.has("ctr_v2_archived"),                     detail: byId.has("ctr_v2_archived") ? "present" : "absent" },
  { name: "'all' sentinel expands to every residence", pass: byId.get("ctr_migrated")?.residenceIds.length === 2, detail: String(byId.get("ctr_migrated")?.residenceIds) },
  { name: "daily-unit contract bills at its face value",  pass: byId.get("ctr_daily_unit")?.terms.dailyRate === 13, detail: `${byId.get("ctr_daily_unit")?.terms.dailyRate} SAR/day` },
  { name: "contract with NO unit is not billed",          pass: !byId.has("ctr_no_unit"),                          detail: byId.has("ctr_no_unit") ? "billed" : "skipped" },
  { name: "...and is reported as unbillable, not dropped", pass: collected.unbillable.some((u) => u.contractId === "ctr_no_unit" && u.reason === "unresolved_rate_unit"), detail: JSON.stringify(collected.unbillable) },
];

for (const chk of sourceChecks) {
  if (!chk.pass) failures++;
  console.log(`${chk.pass ? "PASS" : "FAIL"}  ${chk.name}  (${chk.detail})`);
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
