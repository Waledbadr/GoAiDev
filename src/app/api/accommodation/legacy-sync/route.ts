import { NextRequest, NextResponse } from 'next/server';
import { d1Database } from '@/lib/d1-database';
import {
  fetchAndParseLegacyReport,
  mapLegacyHouseToResidence,
  parseLegacyDateToIso,
  LegacyEmployeeRow,
  DEFAULT_LEGACY_REPORT_URL,
} from '@/lib/accommodation-legacy-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SyncExecutionResult {
  ok: boolean;
  totalLegacyRows: number;
  residencesUpdated: number;
  workersCreatedOrUpdated: number;
  occupantsActive: number;
  occupantsCheckedOut: number;
  historyEntriesCreated: number;
  residenceBreakdown: Record<string, { totalWorkers: number; buildings: string[] }>;
  errors?: string[];
}

export function normalizeBldgName(name: string, resName?: string): string {
  const clean = (name || '').trim();
  if (/^B[-_]?1$/i.test(clean)) return 'B-1';
  if (/^B[-_]?2$/i.test(clean)) return 'B-2';
  if (/^B[-_]?3$/i.test(clean)) return 'B-3';
  if (/عمار/i.test(clean)) return 'عمارة';
  if (/انتظار/i.test(clean)) return 'انتظار';
  if (resName === 'Al-Remal') {
    if (clean === 'C') return 'C-1';
    if (clean === 'A') return 'A-1';
    if (clean === 'B') return 'B-1';
    if (clean === 'D') return 'D-1';
    if (clean === 'G') return 'G-1';
  }
  return clean.toLowerCase();
}

/**
 * GET /api/accommodation/legacy-sync
 * Previews the synchronization diff (Dry Run)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customUrl = searchParams.get('url') || DEFAULT_LEGACY_REPORT_URL;

    const legacyRows = await fetchAndParseLegacyReport(customUrl);

    // Get current data from database
    const existingResidences = d1Database.getCollection('residences') || [];
    const existingWorkers = d1Database.getCollection('workers') || [];
    const existingOccupants = d1Database.getCollection('occupants') || [];

    // Analyze mapping and breakdown
    const breakdown: Record<string, { totalWorkers: number; buildings: Set<string>; rooms: Set<string> }> = {};

    for (const row of legacyRows) {
      const mapping = mapLegacyHouseToResidence(row.houseName, row.building);
      const resKey = mapping.residenceName;
      if (!breakdown[resKey]) {
        breakdown[resKey] = { totalWorkers: 0, buildings: new Set(), rooms: new Set() };
      }
      breakdown[resKey].totalWorkers++;
      breakdown[resKey].buildings.add(mapping.buildingName);
      breakdown[resKey].rooms.add(`${mapping.buildingName}_${row.room || 'General'}`);
    }

    const formattedBreakdown: Record<string, { totalWorkers: number; buildingsCount: number; buildings: string[]; roomsCount: number }> = {};
    for (const [key, val] of Object.entries(breakdown)) {
      formattedBreakdown[key] = {
        totalWorkers: val.totalWorkers,
        buildingsCount: val.buildings.size,
        buildings: Array.from(val.buildings),
        roomsCount: val.rooms.size,
      };
    }

    return NextResponse.json({
      ok: true,
      mode: 'preview',
      totalLegacyWorkers: legacyRows.length,
      existingResidencesCount: existingResidences.length,
      existingWorkersCount: existingWorkers.length,
      existingOccupantsCount: existingOccupants.length,
      residenceBreakdown: formattedBreakdown,
      sampleRows: legacyRows.slice(0, 5),
    });
  } catch (err: any) {
    console.error('[legacy-sync][GET] Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/accommodation/legacy-sync
 * Executes the synchronization and updates database collections
 */
export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable (uses defaults)
    }

    const customUrl = body.url || DEFAULT_LEGACY_REPORT_URL;
    const autoCheckoutMissing = body.autoCheckoutMissing !== false; // default true

    const legacyRows = await fetchAndParseLegacyReport(customUrl);
    if (!legacyRows || legacyRows.length === 0) {
      return NextResponse.json({ ok: false, error: 'No data found in legacy report' }, { status: 400 });
    }

    // 1. Load current DB state
    const currentResidences = d1Database.getCollection('residences') || [];
    const currentWorkers = d1Database.getCollection('workers') || [];
    const currentOccupants = d1Database.getCollection('occupants') || [];

    // Map current residences by normalized name
    const residencesByName = new Map<string, any>();
    for (const res of currentResidences) {
      if (res.name) {
        residencesByName.set(res.name.toLowerCase().trim(), res);
      }
    }

    // Map current workers by employeeId / idNumber / id
    const workersByEmpId = new Map<string, any>();
    const workersByIdNum = new Map<string, any>();
    for (const w of currentWorkers) {
      if (w.employeeId) workersByEmpId.set(String(w.employeeId).trim(), w);
      if (w.idNumber) workersByIdNum.set(String(w.idNumber).trim(), w);
    }

    const updatedResidencesMap = new Map<string, any>();
    const newWorkersList: any[] = [];
    const updatedOccupantsList: any[] = [];
    const newHistoryList: any[] = [];
    const nowIso = new Date().toISOString();
    const todayIsoDate = nowIso.split('T')[0];

    const breakdown: Record<string, { totalWorkers: number; buildings: Set<string> }> = {};
    const seenWorkerIds = new Set<string>();

    // 2. Process each legacy employee row
    for (const row of legacyRows) {
      const mapping = mapLegacyHouseToResidence(row.houseName, row.building);
      const resName = mapping.residenceName;
      const bldgName = mapping.buildingName;
      const roomNumber = (row.room || '').trim() || '1';

      if (!breakdown[resName]) {
        breakdown[resName] = { totalWorkers: 0, buildings: new Set() };
      }
      breakdown[resName].totalWorkers++;
      breakdown[resName].buildings.add(bldgName);

      // Find or create Residence in state
      let residence =
        updatedResidencesMap.get(resName.toLowerCase()) ||
        residencesByName.get(resName.toLowerCase());

      if (!residence) {
        const newResId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        residence = {
          id: newResId,
          name: resName,
          city: mapping.city || 'Other',
          buildings: [],
          facilities: [],
          managerId: 'system',
          status: 'Archived',
          isHistorical: true,
        };
        residencesByName.set(resName.toLowerCase(), residence);
      }

      // Find or create Building
      const targetBldgNorm = normalizeBldgName(bldgName, resName);
      let building = residence.buildings.find(
        (b: any) => normalizeBldgName(b.name, resName) === targetBldgNorm
      );
      if (!building) {
        building = {
          id: `bldg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: bldgName,
          floors: [],
        };
        residence.buildings.push(building);
      } else {
        // Standardize name to canonical
        building.name = bldgName;
      }
      if (!building.floors) building.floors = [];

      // Determine Floor:
      // If a floor already has this room, use that floor.
      // Otherwise, use first floor or create "Floor 1"
      let targetFloor = building.floors.find((f: any) =>
        (f.rooms || []).some((r: any) => (r.name || r.id || '').toString().trim() === roomNumber)
      );

      if (!targetFloor) {
        if (building.floors.length === 0) {
          targetFloor = {
            id: `floor_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: '1',
            rooms: [],
          };
          building.floors.push(targetFloor);
        } else {
          // Put in first floor by default if not assigned
          targetFloor = building.floors[0];
        }
      }
      if (!targetFloor.rooms) targetFloor.rooms = [];

      // Find or create Room
      let room = targetFloor.rooms.find(
        (r: any) => (r.name || r.id || '').toString().trim() === roomNumber
      );
      if (!room) {
        room = {
          id: `room_${building.name}_${roomNumber}`,
          name: roomNumber,
          capacity: 4,
          occupied: true,
          occupants: [],
        };
        targetFloor.rooms.push(room);
      }

      updatedResidencesMap.set(resName.toLowerCase(), residence);

      // Find or create Worker
      const cleanEmpId = (row.employeeId || '').trim();
      const cleanIqama = (row.iqamaNo || '').trim();
      let worker =
        (cleanEmpId ? workersByEmpId.get(cleanEmpId) : null) ||
        (cleanIqama ? workersByIdNum.get(cleanIqama) : null);

      const workerId = worker ? worker.id : `w_${cleanEmpId || cleanIqama || Math.random().toString(36).slice(2, 8)}`;
      seenWorkerIds.add(workerId);

      const checkInDate = parseLegacyDateToIso(row.dateIn);

      const workerDoc = {
        id: workerId,
        name: row.employeeName || (worker ? worker.name : `Worker ${cleanEmpId}`),
        employeeId: cleanEmpId || worker?.employeeId || '',
        idNumber: cleanIqama || worker?.idNumber || '',
        nationality: row.nationality || worker?.nationality || '',
        company: row.company || worker?.company || 'SACODECO',
        occupation: row.occupation || worker?.occupation || 'عامل',
        department: row.department || worker?.department || '',
        project: row.currentProject || worker?.project || '',
        sponsor: row.sponsor || worker?.sponsor || '',
        role: 'Worker',
        status: 'Active',
        updatedAt: nowIso,
      };

      workersByEmpId.set(cleanEmpId, workerDoc);
      if (cleanIqama) workersByIdNum.set(cleanIqama, workerDoc);
      newWorkersList.push(workerDoc);

      // Create or update Occupant record
      const occupantDocId = `occ_${workerId}`;
      const occupantDoc = {
        id: occupantDocId,
        workerId: workerId,
        workerName: workerDoc.name,
        residenceId: residence.id,
        residenceName: residence.name,
        buildingId: building.id,
        buildingName: building.name,
        floorId: targetFloor.id,
        floorName: targetFloor.name,
        roomId: room.id,
        roomName: room.name,
        since: checkInDate,
        until: null,
        checkInBy: 'legacy_sync',
        notes: row.remarks ? row.remarks.trim() : null,
        updatedAt: nowIso,
      };
      updatedOccupantsList.push(occupantDoc);

      // Add to room occupants
      if (!room.occupants) room.occupants = [];
      if (!room.occupants.includes(workerId)) {
        room.occupants.push(workerId);
      }
      room.occupied = true;
    }

    // 3. Handle checkouts for workers who were active in DB but are no longer in legacy report
    let checkedOutCount = 0;
    if (autoCheckoutMissing) {
      for (const occ of currentOccupants) {
        if (!occ.until && occ.workerId && !seenWorkerIds.has(occ.workerId)) {
          // Check out this occupant
          occ.until = todayIsoDate;
          occ.checkOutBy = 'legacy_sync_checkout';
          occ.checkoutType = 'Exit';
          occ.updatedAt = nowIso;
          updatedOccupantsList.push(occ);
          checkedOutCount++;

          newHistoryList.push({
            id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            workerId: occ.workerId,
            workerName: occ.workerName || '',
            actionType: 'CHECK_OUT',
            actionDate: todayIsoDate,
            actionBy: 'legacy_sync',
            residenceId: occ.residenceId,
            buildingId: occ.buildingId,
            floorId: occ.floorId,
            roomId: occ.roomId,
            notes: 'Auto checked-out during legacy synchronization',
            createdAt: nowIso,
          });
        }
      }
    }

    // 4. Merge any duplicate buildings inside each residence before committing
    for (const res of updatedResidencesMap.values()) {
      if (res.buildings && Array.isArray(res.buildings)) {
        const mergedBuildingsMap = new Map<string, any>();
        for (const b of res.buildings) {
          const normKey = normalizeBldgName(b.name, res.name);
          if (!mergedBuildingsMap.has(normKey)) {
            mergedBuildingsMap.set(normKey, { ...b });
          } else {
            const existingB = mergedBuildingsMap.get(normKey);
            if (b.floors && Array.isArray(b.floors)) {
              if (!existingB.floors) existingB.floors = [];
              for (const f of b.floors) {
                const existingF = existingB.floors.find((ef: any) => ef.name === f.name);
                if (existingF) {
                  if (f.rooms && Array.isArray(f.rooms)) {
                    if (!existingF.rooms) existingF.rooms = [];
                    for (const r of f.rooms) {
                      if (!existingF.rooms.some((er: any) => er.name === r.name)) {
                        existingF.rooms.push(r);
                      }
                    }
                  }
                } else {
                  existingB.floors.push(f);
                }
              }
            }
          }
        }
        res.buildings = Array.from(mergedBuildingsMap.values());
      }
    }

    // 5. Batch commit to D1 Database
    const finalResidences = Array.from(updatedResidencesMap.values());
    d1Database.setDocumentsBatch('residences', finalResidences);
    d1Database.setDocumentsBatch('workers', newWorkersList);
    d1Database.setDocumentsBatch('occupants', updatedOccupantsList);
    if (newHistoryList.length > 0) {
      d1Database.setDocumentsBatch('accommodation_history', newHistoryList);
    }

    const formattedBreakdown: Record<string, { totalWorkers: number; buildings: string[] }> = {};
    for (const [key, val] of Object.entries(breakdown)) {
      formattedBreakdown[key] = {
        totalWorkers: val.totalWorkers,
        buildings: Array.from(val.buildings),
      };
    }

    const result: SyncExecutionResult = {
      ok: true,
      totalLegacyRows: legacyRows.length,
      residencesUpdated: finalResidences.length,
      workersCreatedOrUpdated: newWorkersList.length,
      occupantsActive: legacyRows.length,
      occupantsCheckedOut: checkedOutCount,
      historyEntriesCreated: newHistoryList.length,
      residenceBreakdown: formattedBreakdown,
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[legacy-sync][POST] Execution error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
