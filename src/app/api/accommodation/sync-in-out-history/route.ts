import { NextRequest, NextResponse } from 'next/server';
import { d1Database } from '@/lib/d1-database';
import {
  fetchAndParseLegacyBillingReport,
  buildLegacyBillingUrl,
  LegacyBillingRow,
  DEFAULT_2026_MONTHS,
} from '@/lib/accommodation-billing-sync';
import { parseLegacyDateToIso } from '@/lib/accommodation-legacy-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      ok: true,
      availableMonths: DEFAULT_2026_MONTHS,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const selectedMonths: Array<{ name: string; startDate: string; endDate: string }> =
      body.months && body.months.length > 0 ? body.months : DEFAULT_2026_MONTHS;
    const isDryRun = body.dryRun === true;

    // Load existing collections
    const residences = d1Database.getCollection('residences') || [];
    const workers = d1Database.getCollection('workers') || [];
    const occupants = d1Database.getCollection('occupants') || [];
    const existingHistory =
      d1Database.getCollection('accommodation_history') ||
      d1Database.getCollection('accommodationHistory') ||
      [];

    // Maps for fast lookup
    const residenceByName = new Map<string, any>();
    for (const r of residences) {
      if (r && r.name) {
        residenceByName.set(String(r.name).toLowerCase().trim(), r);
      }
    }

    const workerByEmpId = new Map<string, any>();
    for (const w of workers) {
      if (w.employeeId) workerByEmpId.set(String(w.employeeId).trim(), w);
      if (w.id) workerByEmpId.set(String(w.id).trim(), w);
    }

    const historyKeySet = new Set<string>();
    for (const h of existingHistory) {
      const key = `${h.workerId}_${h.roomId}_${h.actionType}_${h.actionDate}`;
      historyKeySet.add(key);
    }

    let totalFetchedRows = 0;
    let newCheckInsCount = 0;
    let newCheckOutsCount = 0;
    const newHistoryRecords: any[] = [];
    const updatedOccupantsMap = new Map<string, any>();
    for (const o of occupants) {
      updatedOccupantsMap.set(o.id, { ...o });
    }

    const monthSummaries: any[] = [];

    // Process each month in chronological order
    for (const m of selectedMonths) {
      const url = buildLegacyBillingUrl(m.startDate, m.endDate);
      let rows: LegacyBillingRow[] = [];
      try {
        rows = await fetchAndParseLegacyBillingReport(url);
      } catch (err: any) {
        console.warn(`[sync-in-out-history] Failed to fetch month ${m.name}:`, err.message);
        monthSummaries.push({ month: m.name, status: 'failed', error: err.message });
        continue;
      }

      totalFetchedRows += rows.length;
      let monthCheckIns = 0;
      let monthCheckOuts = 0;

      for (const row of rows) {
        const empId = String(row.employeeId || '').trim();
        if (!empId) continue;

        let worker = workerByEmpId.get(empId);
        if (!worker) {
          // Create worker placeholder if not already existing
          const newWorkerId = `w_${empId}`;
          worker = {
            id: newWorkerId,
            employeeId: empId,
            name: row.employeeName,
            nationality: row.nationality,
            nationaliy: row.nationality,
            company: row.sponsor || 'SACODECO',
            sponsor: row.sponsor || 'SACODECO',
            role: row.profession || 'عامل',
            occupation: row.profession || 'عامل',
            department: row.department || '',
            status: 'Active',
            createdAt: new Date().toISOString(),
          };
          workerByEmpId.set(empId, worker);
          workerByEmpId.set(newWorkerId, worker);
          workers.push(worker);
        }

        // Match Residence & Room
        const targetRes =
          residenceByName.get((row.targetResidenceName || '').toLowerCase().trim()) ||
          residenceByName.get((row.houseName || '').toLowerCase().trim());

        const resId = targetRes ? targetRes.id : `res_${row.houseName}`;
        const resName = targetRes ? targetRes.name : row.targetResidenceName || row.houseName;

        let roomId = `rm_${resId}_${row.building || '1'}_${row.room || '1'}`;
        let roomName = row.room || '1';
        let buildingName = row.building || '1';
        let floorName = 'الأرضي';

        if (targetRes && targetRes.buildings) {
          const matchedBldg = targetRes.buildings.find(
            (b: any) =>
              b.name?.toLowerCase() === (row.building || '').toLowerCase() ||
              b.id === row.building ||
              b.name?.includes(row.building)
          );
          if (matchedBldg) {
            buildingName = matchedBldg.name;
            for (const fl of matchedBldg.floors || []) {
              const matchedRoom = (fl.rooms || []).find((rm: any) => rm.name === row.room || rm.id === row.room);
              if (matchedRoom) {
                roomId = matchedRoom.id;
                roomName = matchedRoom.name;
                floorName = fl.name || floorName;
                break;
              }
            }
          }
        }

        const dateInIso = row.dateIn ? parseLegacyDateToIso(row.dateIn) : null;
        const dateOutIso = row.dateOut ? parseLegacyDateToIso(row.dateOut) : null;

        // 1. Record CHECK_IN history event
        if (dateInIso) {
          const checkInKey = `${worker.id}_${roomId}_CHECK_IN_${dateInIso}`;
          if (!historyKeySet.has(checkInKey)) {
            historyKeySet.add(checkInKey);
            newCheckInsCount++;
            monthCheckIns++;
            newHistoryRecords.push({
              id: `hist_in_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              workerId: worker.id,
              workerName: worker.name,
              workerNationality: worker.nationality,
              actionType: 'CHECK_IN',
              actionDate: dateInIso,
              actionBy: 'system_sync',
              actionByName: 'مزامنة النظام القديم (2026)',
              residenceId: resId,
              residenceName: resName,
              buildingName,
              floorName,
              roomId,
              roomName,
              notes: row.remarks ? row.remarks.trim() : null,
              reason: row.remarks ? row.remarks.trim() : null,
              createdAt: new Date().toISOString(),
            });
          }
        }

        // 2. Record CHECK_OUT history event
        if (dateOutIso) {
          const checkOutKey = `${worker.id}_${roomId}_CHECK_OUT_${dateOutIso}`;
          if (!historyKeySet.has(checkOutKey)) {
            historyKeySet.add(checkOutKey);
            newCheckOutsCount++;
            monthCheckOuts++;
            newHistoryRecords.push({
              id: `hist_out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              workerId: worker.id,
              workerName: worker.name,
              workerNationality: worker.nationality,
              actionType: 'CHECK_OUT',
              actionDate: dateOutIso,
              actionBy: 'system_sync',
              actionByName: 'مزامنة النظام القديم (2026)',
              residenceId: resId,
              residenceName: resName,
              buildingName,
              floorName,
              roomId,
              roomName,
              checkoutType: (row.remarks || '').includes('تحويل') ? 'Transfer' : 'Exit',
              notes: row.remarks ? row.remarks.trim() : null,
              reason: row.remarks ? row.remarks.trim() : null,
              duration: row.days,
              createdAt: new Date().toISOString(),
            });
          }

          // Mark occupant as checked out if currently assigned
          const activeOcc = Array.from(updatedOccupantsMap.values()).find(
            (o) => o.workerId === worker.id && !o.until
          );
          if (activeOcc) {
            activeOcc.until = dateOutIso;
            activeOcc.checkOutDate = dateOutIso;
            activeOcc.checkoutType = (row.remarks || '').includes('تحويل') ? 'Transfer' : 'Exit';
            updatedOccupantsMap.set(activeOcc.id, activeOcc);
          }
        }
      }

      monthSummaries.push({
        month: m.name,
        records: rows.length,
        checkIns: monthCheckIns,
        checkOuts: monthCheckOuts,
        status: 'success',
      });
    }

    // If not dry run, commit everything to D1
    if (!isDryRun) {
      // 1. Commit history
      const mergedHistory = [...existingHistory, ...newHistoryRecords];
      d1Database.saveCollection('accommodation_history', mergedHistory);
      d1Database.saveCollection('accommodationHistory', mergedHistory);

      // 2. Commit workers
      d1Database.saveCollection('workers', workers);

      // 3. Commit occupants
      const finalOccupants = Array.from(updatedOccupantsMap.values());
      d1Database.saveCollection('occupants', finalOccupants);
    }

    return NextResponse.json({
      ok: true,
      dryRun: isDryRun,
      summary: {
        totalMonths: selectedMonths.length,
        totalFetchedRows,
        newCheckInsCount,
        newCheckOutsCount,
        totalNewHistoryRecords: newHistoryRecords.length,
        monthSummaries,
      },
    });
  } catch (err: any) {
    console.error('[sync-in-out-history][POST] Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
