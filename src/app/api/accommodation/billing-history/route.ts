import { NextRequest, NextResponse } from 'next/server';
import { d1Database } from '@/lib/d1-database';
import {
  fetchAndParseLegacyBillingReport,
  buildLegacyBillingUrl,
  LegacyBillingRow,
  DEFAULT_BILLING_REPORT_URL,
} from '@/lib/accommodation-billing-sync';
import { billableDaysInclusive } from '@/lib/billing-engine';
import { parseISO, max, min } from 'date-fns';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || '2026-07-21';
    const endDate = searchParams.get('endDate') || '2026-08-20';
    const source = searchParams.get('source') || 'database'; // 'database' | 'legacy'
    const customUrl = searchParams.get('url');

    let billingRows: LegacyBillingRow[] = [];

    // 1. If source is Legacy: Fetch directly from external ASP.NET server
    if (source === 'legacy') {
      const targetUrl = customUrl || buildLegacyBillingUrl(startDate, endDate);
      try {
        billingRows = await fetchAndParseLegacyBillingReport(targetUrl);
      } catch (err: any) {
        console.warn('[billing-history] Failed to fetch legacy URL, falling back to database:', err.message);
      }
    }

    // 2. If source is Database OR legacy fetch was empty: Compute instantly from D1 Database
    if (billingRows.length === 0) {
      const residences = d1Database.getCollection('residences') || [];
      const workers = d1Database.getCollection('workers') || [];
      const occupants = d1Database.getCollection('occupants') || [];
      const history =
        d1Database.getCollection('accommodation_history') ||
        d1Database.getCollection('accommodationHistory') ||
        [];

      const periodStart = parseISO(startDate);
      const periodEnd = parseISO(endDate);
      const pStartStr = startDate;
      const pEndStr = endDate;

      // Workers Map
      const workerMap = new Map<string, any>();
      for (const w of workers) {
        if (w.id) workerMap.set(w.id, w);
        if (w.employeeId) workerMap.set(String(w.employeeId), w);
      }

      // Residences Map
      const resMap = new Map<string, any>();
      for (const r of residences) {
        if (r.id) resMap.set(r.id, r);
        if (r.name) resMap.set(r.name.toLowerCase().trim(), r);
      }

      // Collect all movements and occupancies within this period
      // A worker is billable if:
      // - They have an active stay during the period: (since <= periodEnd && (!until || until >= periodStart))
      const processedWorkerKeys = new Set<string>();

      for (const occ of occupants) {
        const occSince = occ.since || '2026-01-01';
        const occUntil = occ.until || null;

        // Check date overlap
        if (occSince <= pEndStr && (!occUntil || occUntil >= pStartStr)) {
          const w = workerMap.get(occ.workerId) || {};
          const empId = w.employeeId || occ.workerId.replace('w_', '');

          const effStart = occSince > pStartStr ? parseISO(occSince) : periodStart;
          const effEnd = occUntil && occUntil < pEndStr ? parseISO(occUntil) : periodEnd;
          const daysCount = billableDaysInclusive(effStart, effEnd);

          const rName = occ.residenceName || resMap.get(occ.residenceId)?.name || 'سكن عام';
          const uniqueKey = `${empId}_${occ.roomId}_${occSince}`;

          if (!processedWorkerKeys.has(uniqueKey)) {
            processedWorkerKeys.add(uniqueKey);
            billingRows.push({
              sNo: String(billingRows.length + 1),
              employeeId: String(empId),
              employeeName: occ.workerName || w.name || 'عامل',
              houseName: rName,
              targetResidenceName: rName,
              department: w.department || '',
              nationality: w.nationality || w.nationaliy || '',
              profession: w.occupation || w.role || 'عامل',
              building: occ.buildingName || '1',
              room: occ.roomName || '1',
              sponsor: w.sponsor || w.company || 'SACODECO',
              remarks: occ.notes || '',
              site: w.project || '',
              dateIn: occSince,
              dateOut: occUntil || '',
              days: daysCount,
            });
          }
        }
      }
    }

    // Compute stats
    let totalDays = 0;
    let fullMonthCount = 0;
    let partialCount = 0;
    const companyTotals: Record<string, { totalWorkers: number; totalDays: number }> = {};
    const residenceTotals: Record<string, { totalWorkers: number; totalDays: number }> = {};

    for (const row of billingRows) {
      totalDays += row.days;
      if (row.days >= 30) fullMonthCount++;
      else partialCount++;

      const comp = row.sponsor || 'SACODECO';
      if (!companyTotals[comp]) companyTotals[comp] = { totalWorkers: 0, totalDays: 0 };
      companyTotals[comp].totalWorkers++;
      companyTotals[comp].totalDays += row.days;

      const resName = row.targetResidenceName || row.houseName;
      if (!residenceTotals[resName]) residenceTotals[resName] = { totalWorkers: 0, totalDays: 0 };
      residenceTotals[resName].totalWorkers++;
      residenceTotals[resName].totalDays += row.days;
    }

    return NextResponse.json({
      ok: true,
      source: source === 'legacy' ? 'legacy_external_server' : 'cloudflare_d1_database',
      period: {
        startDate,
        endDate,
        totalDaysInPeriod: billableDaysInclusive(parseISO(startDate), parseISO(endDate)),
      },
      summary: {
        totalRows: billingRows.length,
        totalDays,
        fullMonthCount,
        partialCount,
        companyTotals,
        residenceTotals,
      },
      rows: billingRows,
    });
  } catch (err: any) {
    console.error('[billing-history][GET] Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
