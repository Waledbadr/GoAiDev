import { d1Database } from '@/lib/d1-database';
import { ai } from '@/ai/genkit';

export interface CopilotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CopilotResponse {
  ok: boolean;
  reply: string;
  category?: 'occupancy' | 'attendance' | 'leaves' | 'workers' | 'contracts' | 'general';
  metrics?: Record<string, any>;
  sources?: string[];
  error?: string;
}

// --------------------------------------------------------------------------
// 1. Data Intelligence & Query Helpers (Direct Real-time D1 Database)
// --------------------------------------------------------------------------

/**
 * 1. Find exact housing / residence details for a specific worker (by ID, Badge, Name, Iqama)
 */
export function findWorkerHousing(query: string) {
  const workers = d1Database.getCollection('workers') || [];
  const occupants = d1Database.getCollection('occupants') || [];
  const residences = d1Database.getCollection('residences') || [];
  const history = d1Database.getCollection('accommodationHistory') || [];

  const cleanQ = query.toLowerCase().trim();
  if (!cleanQ) return null;

  // 1. Find matching worker
  const worker = workers.find((w: any) => {
    if (!w) return false;
    const empId = String(w.employeeId || w.badgeId || '').toLowerCase();
    const idNum = String(w.idNumber || w.iqamaNumber || '').toLowerCase();
    const docId = String(w.id || '').toLowerCase();
    const name = String(w.name || '').toLowerCase();
    const nameAr = String(w.nameAr || '').toLowerCase();

    return (
      empId === cleanQ ||
      idNum === cleanQ ||
      docId === cleanQ ||
      docId === `w_${cleanQ}` ||
      docId === `w_iq_${cleanQ}` ||
      (cleanQ.length >= 3 && (name.includes(cleanQ) || nameAr.includes(cleanQ)))
    );
  });

  // 2. Find occupant record
  let occRecord: any = null;
  if (worker) {
    occRecord = occupants.find((o: any) => {
      if (!o) return false;
      return (
        o.workerId === worker.id ||
        o.workerId === `w_${worker.employeeId}` ||
        o.workerId === worker.employeeId ||
        o.workerId === `w_iq_${worker.idNumber}` ||
        o.id === `occ_${worker.id}`
      );
    });
  }

  // Fallback: search occupants directly if worker record was not matched
  if (!occRecord) {
    occRecord = occupants.find((o: any) => {
      if (!o) return false;
      const wId = String(o.workerId || '').toLowerCase();
      const wName = String(o.workerName || '').toLowerCase();
      return (
        wId === cleanQ ||
        wId === `w_${cleanQ}` ||
        wId === `w_iq_${cleanQ}` ||
        (cleanQ.length >= 3 && wName.includes(cleanQ))
      );
    });
  }

  // 3. Resolve Residence Name
  let residenceName = 'غير محدد';
  let buildingName = occRecord?.buildingName || occRecord?.buildingId || '-';
  let floorName = occRecord?.floorName || occRecord?.floorId || '-';
  let roomName = occRecord?.roomName || occRecord?.roomId || '-';

  if (occRecord?.residenceId) {
    const res = residences.find((r: any) => r.id === occRecord.residenceId);
    if (res) {
      residenceName = res.nameAr || res.name || res.nameEn || occRecord.residenceName || occRecord.residenceId;
    } else {
      residenceName = occRecord.residenceName || occRecord.residenceId;
    }
  }

  // If room has ugly internal id like "room_D_1", clean it to "1"
  if (roomName.startsWith('room_')) {
    roomName = roomName.replace(/^room_[^_]+_?/, '').replace(/^room_/, '');
  }

  return {
    found: Boolean(worker || occRecord),
    worker: worker || {
      id: occRecord?.workerId,
      name: occRecord?.workerName || cleanQ,
      employeeId: cleanQ,
    },
    occupant: occRecord,
    isAccommodated: Boolean(occRecord && (!occRecord.until || occRecord.until > new Date().toISOString().slice(0, 10))),
    residenceName,
    buildingName,
    floorName,
    roomName,
    since: occRecord?.since || '-',
    notes: occRecord?.notes || '-',
  };
}

/**
 * 2. Search for occupants inside a specific room or building
 */
export function getRoomOccupants(residenceQuery: string, roomQuery?: string) {
  const occupants = d1Database.getCollection('occupants') || [];
  const residences = d1Database.getCollection('residences') || [];
  const workers = d1Database.getCollection('workers') || [];

  const resQ = residenceQuery.toLowerCase().trim();
  const roomQ = roomQuery ? roomQuery.toLowerCase().trim() : '';

  // Find matching residence
  const targetRes = residences.find((r: any) => {
    const name = String(r.name || '').toLowerCase();
    const nameAr = String(r.nameAr || '').toLowerCase();
    const nameEn = String(r.nameEn || '').toLowerCase();
    return name.includes(resQ) || nameAr.includes(resQ) || nameEn.includes(resQ);
  });

  const resId = targetRes ? targetRes.id : '';

  const matchedOccupants = occupants.filter((o: any) => {
    if (!o) return false;
    const matchRes = resId ? o.residenceId === resId : String(o.residenceName || '').toLowerCase().includes(resQ);
    if (!matchRes) return false;

    if (roomQ) {
      const rName = String(o.roomName || o.roomId || '').toLowerCase();
      return rName.includes(roomQ);
    }
    return true;
  });

  return {
    residence: targetRes?.nameAr || targetRes?.name || residenceQuery,
    count: matchedOccupants.length,
    occupants: matchedOccupants.slice(0, 30).map((o: any) => {
      const w = workers.find((w: any) => w.id === o.workerId);
      return {
        name: o.workerName || w?.nameAr || w?.name || 'عامل',
        employeeId: w?.employeeId || w?.badgeId || '-',
        room: o.roomName || o.roomId,
        building: o.buildingName || o.buildingId,
        company: w?.company || '-',
      };
    }),
  };
}

/**
 * 3. Specific Residence Occupancy Stats
 */
export function getSpecificResidenceStats(resNameQuery: string) {
  const residences = d1Database.getCollection('residences') || [];
  const occupants = d1Database.getCollection('occupants') || [];

  const q = resNameQuery.toLowerCase().trim();
  const targetRes = residences.find((r: any) => {
    const name = String(r.name || '').toLowerCase();
    const nameAr = String(r.nameAr || '').toLowerCase();
    const nameEn = String(r.nameEn || '').toLowerCase();
    return name.includes(q) || nameAr.includes(q) || nameEn.includes(q);
  });

  if (!targetRes) return null;

  let totalCapacity = 0;
  let buildingsCount = 0;
  let roomsCount = 0;

  if (Array.isArray(targetRes.buildings)) {
    buildingsCount = targetRes.buildings.length;
    targetRes.buildings.forEach((b: any) => {
      if (Array.isArray(b.floors)) {
        b.floors.forEach((f: any) => {
          if (Array.isArray(f.rooms)) {
            roomsCount += f.rooms.length;
            f.rooms.forEach((r: any) => {
              totalCapacity += Number(r.capacity || 0);
            });
          }
        });
      }
    });
  }

  const activeOccs = occupants.filter((o: any) => o && o.residenceId === targetRes.id && (!o.until || o.until > new Date().toISOString().slice(0, 10)));
  const occupiedCount = activeOccs.length;
  const freeBeds = Math.max(0, totalCapacity - occupiedCount);
  const occupancyRate = totalCapacity > 0 ? Math.round((occupiedCount / totalCapacity) * 100) : 0;

  return {
    id: targetRes.id,
    name: targetRes.nameAr || targetRes.name || targetRes.nameEn,
    city: targetRes.city || 'غير محدد',
    buildingsCount,
    roomsCount,
    totalCapacity,
    occupiedCount,
    freeBeds,
    occupancyRate: `${occupancyRate}%`,
  };
}

/**
 * 4. Overall Occupancy Stats
 */
export function getOccupancyStats() {
  const occupants = d1Database.getCollection('occupants') || [];
  const residences = d1Database.getCollection('residences') || [];

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const activeOccupants = occupants.filter((occ: any) => {
    if (!occ) return false;
    if (!occ.until) return true;
    return occ.until > todayStr;
  });

  const residenceMap = new Map<string, { name: string; nameAr: string; capacity: number; occupied: number }>();

  residences.forEach((res: any) => {
    let totalCap = 0;
    if (Array.isArray(res.buildings)) {
      res.buildings.forEach((b: any) => {
        if (Array.isArray(b.floors)) {
          b.floors.forEach((f: any) => {
            if (Array.isArray(f.rooms)) {
              f.rooms.forEach((r: any) => {
                totalCap += Number(r.capacity || 0);
              });
            }
          });
        }
      });
    }

    residenceMap.set(String(res.id), {
      name: res.name || res.nameEn || 'Residence',
      nameAr: res.nameAr || res.name || 'مجمع سكني',
      capacity: totalCap || Number(res.capacity || 0),
      occupied: 0,
    });
  });

  activeOccupants.forEach((occ: any) => {
    const resId = String(occ.residenceId || '');
    if (residenceMap.has(resId)) {
      residenceMap.get(resId)!.occupied += 1;
    } else if (resId) {
      residenceMap.set(resId, {
        name: occ.residenceName || resId,
        nameAr: occ.residenceName || resId,
        capacity: 0,
        occupied: 1,
      });
    }
  });

  const residenceBreakdown = Array.from(residenceMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.nameAr || data.name,
      occupied: data.occupied,
      capacity: data.capacity,
      freeBeds: Math.max(0, data.capacity - data.occupied),
      occupancyRate: data.capacity > 0 ? Math.round((data.occupied / data.capacity) * 100) : 0,
    }))
    .filter((r) => r.occupied > 0 || r.capacity > 0)
    .sort((a, b) => b.occupied - a.occupied);

  const totalCapacity = residenceBreakdown.reduce((sum, r) => sum + r.capacity, 0);
  const totalOccupied = activeOccupants.length;
  const totalFreeBeds = Math.max(0, totalCapacity - totalOccupied);
  const overallOccupancyRate = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  return {
    totalOccupants: totalOccupied,
    totalCapacity,
    totalFreeBeds,
    overallOccupancyRate: `${overallOccupancyRate}%`,
    residencesCount: residences.length,
    topResidences: residenceBreakdown.slice(0, 10),
    allResidences: residenceBreakdown,
  };
}

/**
 * 5. Attendance & Absence Analytics Tool
 */
export function getAttendanceReport(targetDate?: string, projectFilter?: string) {
  const attendanceRecords = d1Database.getCollection('attendanceRecords') || [];

  let dateStr = targetDate;
  if (!dateStr) {
    const today = new Date().toISOString().slice(0, 10);
    const hasTodayRecords = attendanceRecords.some((r: any) => r.date === today);
    if (hasTodayRecords) {
      dateStr = today;
    } else {
      const dates = attendanceRecords
        .map((r: any) => r.date)
        .filter(Boolean)
        .sort();
      dateStr = dates.length > 0 ? dates[dates.length - 1] : today;
    }
  }

  let recordsForDate = attendanceRecords.filter((r: any) => r.date === dateStr);
  if (projectFilter) {
    const pQ = projectFilter.toLowerCase();
    recordsForDate = recordsForDate.filter(
      (r: any) =>
        String(r.projectName || '').toLowerCase().includes(pQ) ||
        String(r.department || '').toLowerCase().includes(pQ)
    );
  }

  const presentList: any[] = [];
  const absentList: any[] = [];
  const lateList: any[] = [];

  recordsForDate.forEach((rec: any) => {
    const status = String(rec.status || '').toLowerCase();
    const isPresent = status === 'present' || (Array.isArray(rec.punches) && rec.punches.length > 0) || Boolean(rec.checkIn);

    const workerInfo = {
      employeeId: rec.employeeId || rec.badgeId || '-',
      name: rec.firstName ? `${rec.firstName} ${rec.lastName || ''}`.trim() : (rec.name || rec.workerName || 'عامل'),
      department: rec.department || rec.projectName || 'عام',
      projectName: rec.projectName || 'غير محدد',
      checkIn: rec.checkIn || (rec.punches ? rec.punches[0] : null) || '-',
      checkOut: rec.checkOut || (rec.punches && rec.punches.length > 1 ? rec.punches[rec.punches.length - 1] : null) || '-',
      totalHours: rec.totalHours || 0,
      status: isPresent ? 'حاضر' : 'غائب',
    };

    if (isPresent) {
      presentList.push(workerInfo);
      if (rec.checkIn && rec.checkIn > '08:15') {
        lateList.push(workerInfo);
      }
    } else {
      absentList.push(workerInfo);
    }
  });

  const absenteesByDept: Record<string, number> = {};
  absentList.forEach((a) => {
    const dept = a.department || 'أخرى';
    absenteesByDept[dept] = (absenteesByDept[dept] || 0) + 1;
  });

  return {
    date: dateStr,
    totalRecordsCount: recordsForDate.length,
    presentCount: presentList.length,
    absentCount: absentList.length,
    lateCount: lateList.length,
    attendanceRate: recordsForDate.length > 0 ? `${Math.round((presentList.length / recordsForDate.length) * 100)}%` : '0%',
    absenteesSample: absentList.slice(0, 25),
    absenteesTotal: absentList,
    absenteesByDept,
    presentSample: presentList.slice(0, 10),
  };
}

/**
 * 6. Leaves & Vacations Analytics Tool
 */
export function getLeavesReport(upcomingDays: number = 30) {
  const leaves = d1Database.getCollection('timesheetLeaves') || [];

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const futureTarget = new Date();
  futureTarget.setDate(futureTarget.getDate() + upcomingDays);
  const futureTargetStr = futureTarget.toISOString().slice(0, 10);

  const currentlyOnLeave: any[] = [];
  const returningSoon: any[] = [];
  const overdueReturn: any[] = [];

  leaves.forEach((l: any) => {
    const startDate = l.startDate || '';
    const endDate = l.endDate || '';
    const status = String(l.status || '').toLowerCase();

    const isOngoing = (startDate <= todayStr && (!endDate || endDate >= todayStr)) || status === 'approved' || status === 'active';

    let daysRemaining: number | null = null;
    if (endDate) {
      const endD = new Date(endDate);
      const diffMs = endD.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    const item = {
      id: l.id,
      employeeId: l.employeeId || l.badgeId || '-',
      name: l.nameAr || l.name || 'عامل',
      leaveType: l.type || 'سنوية',
      startDate: startDate || '-',
      endDate: endDate || '-',
      daysRemaining: daysRemaining,
      status: l.status || 'معتمدة',
    };

    if (isOngoing) {
      currentlyOnLeave.push(item);
    }

    if (endDate && endDate >= todayStr && endDate <= futureTargetStr) {
      returningSoon.push(item);
    }

    if (endDate && endDate < todayStr && status !== 'completed' && status !== 'returned') {
      overdueReturn.push(item);
    }
  });

  returningSoon.sort((a, b) => (a.endDate > b.endDate ? 1 : -1));

  return {
    today: todayStr,
    totalLeavesRegistered: leaves.length,
    currentlyOnLeaveCount: currentlyOnLeave.length,
    returningSoonCount: returningSoon.length,
    overdueReturnCount: overdueReturn.length,
    upcomingDaysWindow: upcomingDays,
    returningSoonList: returningSoon.slice(0, 30),
    overdueReturnList: overdueReturn.slice(0, 15),
    currentlyOnLeaveSample: currentlyOnLeave.slice(0, 20),
  };
}

/**
 * 7. Worker Search & Info Tool
 */
export function searchWorkers(query: string) {
  const workers = d1Database.getCollection('workers') || [];
  const occupants = d1Database.getCollection('occupants') || [];
  const residences = d1Database.getCollection('residences') || [];

  const q = (query || '').toLowerCase().trim();
  if (!q) return [];

  const matched = workers.filter((w: any) => {
    if (!w) return false;
    const name = String(w.name || '').toLowerCase();
    const nameAr = String(w.nameAr || '').toLowerCase();
    const idNumber = String(w.idNumber || w.iqamaNumber || '').toLowerCase();
    const empId = String(w.employeeId || w.badgeId || w.id || '').toLowerCase();
    const role = String(w.role || w.profession || w.jobTitle || w.occupation || '').toLowerCase();
    const comp = String(w.company || '').toLowerCase();

    return (
      name.includes(q) ||
      nameAr.includes(q) ||
      idNumber.includes(q) ||
      empId.includes(q) ||
      role.includes(q) ||
      comp.includes(q)
    );
  });

  const results = matched.slice(0, 10).map((w: any) => {
    const occ = occupants.find((o: any) => o && (o.workerId === w.id || o.workerId === `w_${w.employeeId}` || o.workerId === w.employeeId || o.workerId === `w_iq_${w.idNumber}`));
    let housingInfo = 'غير مسكن حالياً';
    if (occ) {
      const res = residences.find((r: any) => r.id === occ.residenceId);
      const resName = res?.nameAr || res?.name || occ.residenceName || 'مجمع سكني';
      const bldg = occ.buildingName || occ.buildingId || '';
      const room = occ.roomName || occ.roomId || '';
      housingInfo = `${resName}${bldg ? ` - مبنى ${bldg}` : ''}${room ? ` - غرفة ${room}` : ''}`;
    }

    return {
      id: w.id,
      name: w.nameAr || w.name,
      employeeId: w.employeeId || w.badgeId || '-',
      idNumber: w.idNumber || w.iqamaNumber || '-',
      role: w.occupation || w.role || w.profession || 'عامل',
      company: w.company || 'SACODECO',
      department: w.department || '-',
      project: w.project || '-',
      nationality: w.nationality || w.nationaliy || 'غير محدد',
      housing: housingInfo,
    };
  });

  return results;
}

/**
 * 8. Comprehensive Contracts & Expiry Analytics Tool
 */
export function getContractsAndFinancialSummary() {
  const contractsV2 = d1Database.getCollection('contractsV2') || [];
  const invoices = d1Database.getCollection('contractInvoices') || d1Database.getCollection('invoices') || [];

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const activeContracts: any[] = [];
  const expiringContracts: any[] = [];
  const expiredContracts: any[] = [];

  let totalContractValue = 0;
  let totalBedsContracted = 0;

  const parsedContracts = contractsV2.map((c: any) => {
    const status = String(c.status || '').toLowerCase();
    const isActive = status === 'active' || status === 'approved' || !c.status;
    const endDateRaw = c.endDate ? String(c.endDate).slice(0, 10) : null;
    
    let daysUntilExpiry: number | null = null;
    let isExpired = false;
    let isExpiringSoon = false;

    if (endDateRaw) {
      const endD = new Date(endDateRaw);
      const diffMs = endD.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 0) {
        isExpired = true;
      } else if (daysUntilExpiry <= 90) {
        isExpiringSoon = true;
      }
    }

    const item = {
      id: c.id,
      contractNumber: c.contractNumber || c.code || c.id,
      title: c.title || 'عقد',
      partyName: c.partyName || c.clientName || c.companyName || 'الطرف الثاني',
      partyType: c.partyType || 'شركة',
      contractCategory: c.contractCategory === 'revenue' ? 'إيراد (تأجير)' : 'مصروف (استئجار)',
      billingRate: c.billingRate || 0,
      billingUnit: c.billingUnit || 'شهري',
      startDate: c.startDate ? String(c.startDate).slice(0, 10) : '-',
      endDate: endDateRaw || 'مفتوح / غير محدد',
      daysUntilExpiry,
      isExpired,
      isExpiringSoon,
      status: isExpired ? 'منتهي الصلاحية' : (c.status || 'ساري'),
      bedsCount: c.accommodationDetails?.bedsCount || c.bedsCount || 0,
      targetWorkersCount: c.accommodationDetails?.targetWorkersCount || 0,
      dailyRatePerWorker: c.accommodationDetails?.dailyRatePerWorker || 0,
      autoRenew: Boolean(c.autoRenew),
    };

    if (isActive && !isExpired) {
      activeContracts.push(item);
      totalContractValue += Number(c.billingRate || c.totalValue || c.monthlyRent || 0);
      totalBedsContracted += Number(item.bedsCount || 0);
    }
    if (isExpiringSoon && !isExpired) {
      expiringContracts.push(item);
    }
    if (isExpired) {
      expiredContracts.push(item);
    }

    return item;
  });

  // Sort expiring soon by nearest expiry date
  expiringContracts.sort((a, b) => (a.daysUntilExpiry || 0) - (b.daysUntilExpiry || 0));

  return {
    totalContracts: contractsV2.length,
    activeContractsCount: activeContracts.length,
    expiringContractsCount: expiringContracts.length,
    expiredContractsCount: expiredContracts.length,
    totalContractValue,
    totalBedsContracted,
    invoicesCount: invoices.length,
    expiringContractsList: expiringContracts,
    activeContractsList: activeContracts.slice(0, 20),
    allContractsSummary: parsedContracts.map(c => ({
      contractNumber: c.contractNumber,
      title: c.title,
      partyName: c.partyName,
      category: c.contractCategory,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      daysUntilExpiry: c.daysUntilExpiry,
      billingRate: c.billingRate,
    })),
  };
}

/**
 * 9. Worker Accommodation History & Timeline Tool
 */
export function getWorkerHistory(query: string) {
  const history = d1Database.getCollection('accommodationHistory') || [];
  const cleanQ = query.toLowerCase().trim();
  if (!cleanQ) return [];

  const matched = history.filter((h: any) => {
    if (!h) return false;
    const wId = String(h.workerId || '').toLowerCase();
    const wName = String(h.workerName || '').toLowerCase();
    return wId.includes(cleanQ) || wName.includes(cleanQ) || (cleanQ.startsWith('w_') && wId === cleanQ);
  });

  // Sort by actionDate desc
  matched.sort((a, b) => (b.actionDate || b.createdAt || '') > (a.actionDate || a.createdAt || '') ? 1 : -1);

  return matched.slice(0, 15).map((h: any) => ({
    id: h.id,
    workerId: h.workerId,
    workerName: h.workerName,
    actionType: h.actionType === 'CHECK_IN' ? 'تسكين (دخول)' : h.actionType === 'CHECK_OUT' ? 'إخلاء (خروج)' : 'نقل',
    actionDate: h.actionDate || String(h.createdAt).slice(0, 10),
    residenceName: h.residenceName || h.residenceId,
    buildingName: h.buildingName || '-',
    floorName: h.floorName || '-',
    roomName: h.roomName || '-',
    notes: h.notes || h.reason || '-',
    actionByName: h.actionByName || h.actionBy || 'النظام',
  }));
}

// --------------------------------------------------------------------------
// 2. High-Precision Semantic Understanding & Smart NLP Dispatcher
// --------------------------------------------------------------------------

/**
 * Parses user questions intelligently by detecting entity types (Badge numbers, IDs, Names, Complexes, Rooms)
 * and answering accurately according to user intent.
 */
function processSmartSemanticQuery(userMessage: string): { reply: string; category: CopilotResponse['category']; metrics?: any } {
  const rawMsg = userMessage.trim();
  const msg = rawMsg.toLowerCase();

  // Extract any 4-10 digit numbers (badge ID, employee ID, iqama number)
  const numberMatch = rawMsg.match(/\b\d{4,12}\b/);
  const targetId = numberMatch ? numberMatch[0] : null;

  // ------------------------------------------------------------------------
  // INTENT 1: Where does worker X live? (اين يسكن / وين ساكن / موقع سكن / غرفة فلان)
  // ------------------------------------------------------------------------
  const isWhereLivesQuery =
    msg.includes('اين يسكن') ||
    msg.includes('أين يسكن') ||
    msg.includes('وين يسكن') ||
    msg.includes('وين ساكن') ||
    msg.includes('فين ساكن') ||
    msg.includes('موقع سكن') ||
    msg.includes('مكان سكن') ||
    msg.includes('في اي مجمع') ||
    msg.includes('في أي مجمع') ||
    msg.includes('سكن العامل') ||
    msg.includes('غرفة العامل') ||
    (msg.includes('سكن') && (targetId !== null || rawMsg.split(' ').length <= 5)) ||
    (msg.includes('يسكن') && (targetId !== null || rawMsg.split(' ').length <= 5)) ||
    (msg.includes('ساكن') && (targetId !== null || rawMsg.split(' ').length <= 5));

  const targetIdentifier =
    targetId ||
    rawMsg
      .replace(/أين|اين|وين|فين|يسكن|ساكن|موقع|مكان|سكن|غرفة|العامل|الموظف|في|أي|اي|مجمع|بيانات|معلومات/gi, '')
      .trim();

  if (isWhereLivesQuery && targetIdentifier && targetIdentifier.length >= 2) {
    const result = findWorkerHousing(targetIdentifier);
    if (result && result.found) {
      const w = result.worker;
      const occ = result.occupant;

      let reply = `🏠 **بيانات سكن العامل [${w.employeeId || targetIdentifier}]:**\n\n`;
      reply += `👤 **الاسم:** **${w.name || w.nameAr || 'غير محدد'}**\n`;
      reply += `🆔 **الرقم الوظيفي:** \`${w.employeeId || targetIdentifier}\` | **رقم الإقامة:** \`${w.idNumber || '-'}\`\n`;
      reply += `💼 **المهنة / القسم:** ${w.occupation || w.role || 'عامل'} (${w.department || w.project || 'SACODECO'})\n\n`;

      if (result.isAccommodated) {
        reply += `🏢 **مجمع السكن:** **${result.residenceName}**\n`;
        reply += `🚪 **المبنى:** \`${result.buildingName}\` | **الدور:** \`${result.floorName}\` | **الغرفة:** **\`${result.roomName}\`**\n`;
        reply += `📅 **تاريخ التسكين:** ${result.since}\n`;
        if (result.notes && result.notes !== '-') {
          reply += `📝 **ملاحظات:** ${result.notes}\n`;
        }
      } else {
        reply += `⚠️ **حالة التسكين:** هذا العامل **غير مسجل في غرفة نشطة حالياً** (قد يكون تم عمل خروج أو في إجازة).\n`;
      }

      return { reply, category: 'workers', metrics: result };
    } else {
      return {
        reply: `🔍 لم يتم العثور على سجل تسكين نشط للعامل: \`${targetIdentifier}\`. يرجى التأكد من صحة الاسم أو الرقم الوظيفي.`,
        category: 'workers',
      };
    }
  }

  // ------------------------------------------------------------------------
  // INTENT 2: Worker Info Search by Name / ID (بيانات / معلومات / من هو / كشف)
  // ------------------------------------------------------------------------
  if (
    msg.startsWith('من هو') ||
    msg.startsWith('مين هو') ||
    msg.includes('بيانات العامل') ||
    msg.includes('معلومات العامل') ||
    msg.includes('رقم اقامة') ||
    msg.includes('رقم إقامة') ||
    (targetId && (msg.includes('عامل') || msg.includes('موظف') || msg.includes('بحث')))
  ) {
    const searchTarget = targetId || rawMsg.replace(/من هو|مين هو|بيانات|معلومات|عامل|موظف/gi, '').trim();
    const results = searchWorkers(searchTarget);

    if (results.length > 0) {
      let reply = `🔍 **بيانات العامل:**\n\n`;
      results.slice(0, 3).forEach((w) => {
        reply += `👤 **${w.name}**\n`;
        reply += `* **الرقم الوظيفي:** \`${w.employeeId}\` | **رقم الإقامة:** \`${w.idNumber}\`\n`;
        reply += `* **المهنة:** ${w.role} | **الشركة:** ${w.company} | **الجنسية:** ${w.nationality}\n`;
        reply += `* **المشروع / القسم:** ${w.project} (${w.department})\n`;
        reply += `* **موقع السكن الحالي:** 🏠 **${w.housing}**\n\n---\n\n`;
      });
      return { reply, category: 'workers', metrics: { count: results.length } };
    }
  }

  // ------------------------------------------------------------------------
  // INTENT 3: Specific Residence Query (e.g., كم ساكن في الرمال / إشغال مجمع الزاهر / العزيزية)
  // ------------------------------------------------------------------------
  const knownResidences = ['الرمال', 'أملج', 'املج', 'البحر الأحمر', 'البحر الاحمر', 'الزاهر', 'أم السلم', 'ام السلم', 'العزيزية', 'الجهيمي', 'إيواء جدة', 'ايواء جدة', 'الملز', 'القصيم', 'المدينة'];
  for (const resName of knownResidences) {
    if (msg.includes(resName.toLowerCase())) {
      const stats = getSpecificResidenceStats(resName);
      if (stats) {
        let reply = `🏢 **إحصائيات مجمع [${stats.name}]:**\n\n`;
        reply += `* **عدد الساكنين الحاليين:** \`${stats.occupiedCount.toLocaleString('ar-SA')}\` مقيم\n`;
        reply += `* **الطاقة الاستيعابية:** \`${stats.totalCapacity.toLocaleString('ar-SA')}\` سرير\n`;
        reply += `* **الأسرّة الشاغرة المتاحة:** \`${stats.freeBeds.toLocaleString('ar-SA')}\` سرير\n`;
        reply += `* **نسبة الإشغال في المجمع:** **${stats.occupancyRate}**\n`;
        reply += `* **عدد المباني:** ${stats.buildingsCount} | **عدد الغرف:** ${stats.roomsCount}\n`;
        return { reply, category: 'occupancy', metrics: stats };
      }
    }
  }

  // ------------------------------------------------------------------------
  // INTENT 4: Vacations & Returnees (المتبقي للعودة من إجازة / مين مسافر / الإجازات)
  // ------------------------------------------------------------------------
  if (
    msg.includes('اجاز') ||
    msg.includes('إجاز') ||
    msg.includes('عودة') ||
    msg.includes('مسافر') ||
    msg.includes('سفر') ||
    msg.includes('leave') ||
    msg.includes('vacation')
  ) {
    const leavesData = getLeavesReport(30);
    let reply = `✈️ **تقرير الإجازات وحركة عودة العمال:**\n\n`;
    reply += `* **العمال في إجازة حالياً:** \`${leavesData.currentlyOnLeaveCount.toLocaleString('ar-SA')}\` عامل\n`;
    reply += `* **المتوقع عودتهم خلال الـ 30 يوماً القادمة:** \`${leavesData.returningSoonCount.toLocaleString('ar-SA')}\` عامل\n`;
    reply += `* **المتأخرين عن موعد العودة:** \`${leavesData.overdueReturnCount.toLocaleString('ar-SA')}\` عامل\n\n`;

    if (leavesData.returningSoonList.length > 0) {
      reply += `🗓️ **قائمة العمال المتبقي لعودتهم من الإجازة قريباً:**\n\n`;
      reply += `| الرقم الوظيفي | الاسم | تاريخ العودة المتوقع | المتبقي |\n`;
      reply += `| :--- | :--- | :---: | :---: |\n`;
      leavesData.returningSoonList.forEach((worker) => {
        const daysText = worker.daysRemaining !== null ? (worker.daysRemaining <= 0 ? 'اليوم' : `${worker.daysRemaining} يوم`) : '-';
        reply += `| \`${worker.employeeId}\` | **${worker.name}** | ${worker.endDate} | **${daysText}** |\n`;
      });
    } else {
      reply += `ℹ️ لا توجد إجازات تنتهي خلال الفترة القريبة القادمة.\n`;
    }

    if (leavesData.overdueReturnList.length > 0) {
      reply += `\n⚠️ **تنبيه عمال متأخرين عن موعد العودة المجدول:**\n\n`;
      reply += `| الرقم الوظيفي | الاسم | تاريخ الانتهاء المجدول |\n`;
      reply += `| :--- | :--- | :---: |\n`;
      leavesData.overdueReturnList.slice(0, 5).forEach((worker) => {
        reply += `| \`${worker.employeeId}\` | **${worker.name}** | ${worker.endDate} |\n`;
      });
    }

    return { reply, category: 'leaves', metrics: leavesData };
  }

  // ------------------------------------------------------------------------
  // INTENT 5: Attendance & Absence (مين الغائب / كشف الحضور / التايم شيت)
  // ------------------------------------------------------------------------
  if (
    msg.includes('غائب') ||
    msg.includes('غياب') ||
    msg.includes('حاضر') ||
    msg.includes('حضور') ||
    msg.includes('تايم شيت') ||
    msg.includes('timesheet') ||
    msg.includes('absent') ||
    msg.includes('attendance')
  ) {
    const att = getAttendanceReport();
    let reply = `📋 **تقرير الحضور والغياب (تاريخ السجل: ${att.date}):**\n\n`;
    reply += `* **عدد الحاضرين:** \`${att.presentCount.toLocaleString('ar-SA')}\` موظف / عامل\n`;
    reply += `* **عدد الغائبين:** \`${att.absentCount.toLocaleString('ar-SA')}\` موظف / عامل\n`;
    reply += `* **المتأخرين:** \`${att.lateCount.toLocaleString('ar-SA')}\`\n`;
    reply += `* **نسبة الحضور:** **${att.attendanceRate}**\n\n`;

    if (att.absenteesSample.length > 0) {
      reply += `🚨 **قائمة بأبرز الغائبين اليوم:**\n\n`;
      reply += `| الرقم الوظيفي | الاسم | القسم / المشروع |\n`;
      reply += `| :--- | :--- | :--- |\n`;
      att.absenteesSample.slice(0, 15).forEach((worker) => {
        reply += `| \`${worker.employeeId}\` | **${worker.name}** | ${worker.department || worker.projectName} |\n`;
      });
      if (att.absentCount > 15) {
        reply += `\n*(تم عرض أول 15 غائب من إجمالي ${att.absentCount})*\n`;
      }
    } else {
      reply += `✅ **لا يوجد غياب مسجل لهذا التاريخ أو أن جميع الموظفين سجلوا حضورهم.**\n`;
    }

    return { reply, category: 'attendance', metrics: att };
  }

  // ------------------------------------------------------------------------
  // INTENT 6: Total Overall Occupancy (كم عدد الساكنين حاليا / نسبة الإشغال الإجمالية)
  // ------------------------------------------------------------------------
  if (
    msg.includes('كم عدد الساكنين') ||
    msg.includes('كم الساكنين') ||
    msg.includes('إجمالي الساكنين') ||
    msg.includes('اجمالي الساكنين') ||
    msg.includes('نسبة الإشغال') ||
    msg.includes('نسبة الاشغال') ||
    msg.includes('طاقة استيعابية') ||
    msg.includes('الأسرّة الشاغرة') ||
    msg.includes('الاسرة الشاغرة')
  ) {
    const stats = getOccupancyStats();
    let reply = `📊 **تقرير شؤون الإسكان والإشغال الحالي:**\n\n`;
    reply += `* **إجمالي عدد الساكنين حالياً:** \`${stats.totalOccupants.toLocaleString('ar-SA')}\` مقيم\n`;
    reply += `* **الطاقة الاستيعابية الإجمالية:** \`${stats.totalCapacity.toLocaleString('ar-SA')}\` سرير\n`;
    reply += `* **الأسرّة الشاغرة المتاحة:** \`${stats.totalFreeBeds.toLocaleString('ar-SA')}\` سرير\n`;
    reply += `* **نسبة الإشغال الإجمالية:** **${stats.overallOccupancyRate}**\n\n`;

    if (stats.topResidences.length > 0) {
      reply += `🏢 **توزيع الساكنين على المجمعات السكنية:**\n\n`;
      reply += `| المجمع السكني | عدد الساكنين | السعة | الأسرّة الشاغرة | نسبة الإشغال |\n`;
      reply += `| :--- | :---: | :---: | :---: | :---: |\n`;
      stats.topResidences.forEach((r) => {
        reply += `| **${r.name}** | ${r.occupied.toLocaleString('ar-SA')} | ${r.capacity.toLocaleString('ar-SA')} | ${r.freeBeds.toLocaleString('ar-SA')} | %${r.occupancyRate} |\n`;
      });
    }

    return { reply, category: 'occupancy', metrics: stats };
  }

  // ------------------------------------------------------------------------
  // INTENT 7: Contracts & Financials
  // ------------------------------------------------------------------------
  if (msg.includes('عقد') || msg.includes('عقود') || msg.includes('مالي') || msg.includes('فواتير') || msg.includes('contract')) {
    const contracts = getContractsAndFinancialSummary();
    let reply = `📑 **ملخص العقود والعمليات المالية:**\n\n`;
    reply += `* **إجمالي العقود المسجلة:** \`${contracts.totalContracts}\` عقد\n`;
    reply += `* **العقود السارية والنشطة:** \`${contracts.activeContractsCount}\` عقد\n`;
    reply += `* **إجمالي الأسرّة المتعاقد عليها:** \`${contracts.totalBedsContracted.toLocaleString('ar-SA')}\` سرير\n\n`;

    if (contracts.activeContractsList.length > 0) {
      reply += `🏢 **أحدث العقود النشطة:**\n\n`;
      reply += `| رقم العقد | العميل | فترة العقد | الحالة |\n`;
      reply += `| :--- | :--- | :---: | :---: |\n`;
      contracts.activeContractsList.slice(0, 5).forEach((c: any) => {
        reply += `| \`${c.contractNumber}\` | **${c.partyName}** | ${c.startDate} إلى ${c.endDate} | ${c.status} |\n`;
      });
    }

    return { reply, category: 'contracts', metrics: contracts };
  }

  // ------------------------------------------------------------------------
  // INTENT 8: Direct Worker Search by ID Number alone (e.g. User just types "40064")
  // ------------------------------------------------------------------------
  if (targetId) {
    const result = findWorkerHousing(targetId);
    if (result && result.found) {
      const w = result.worker;
      let reply = `👤 **بيانات العامل [${w.employeeId || targetId}]:**\n\n`;
      reply += `* **الاسم:** **${w.name || w.nameAr || 'غير محدد'}**\n`;
      reply += `* **المهنة:** ${w.occupation || w.role || 'عامل'} | **الشركة:** ${w.company || 'SACODECO'}\n`;
      reply += `* **المشروع:** ${w.project || '-'} | **القسم:** ${w.department || '-'}\n`;
      if (result.isAccommodated) {
        reply += `* **مقر السكن:** 🏠 **${result.residenceName}** (مبنى: \`${result.buildingName}\`، غرفة: **\`${result.roomName}\`**)\n`;
      } else {
        reply += `* **حالة السكن:** ⚠️ غير مسكن حالياً\n`;
      }
      return { reply, category: 'workers', metrics: result };
    }
  }

  // Default Assistant Response
  return {
    reply: `مرحباً بك! أنا **المساعد الذكي لإدارة مجمعات وعمال EstateCare** 🤖\n\nكيف يمكنني مساعدتك؟ يمكنك سؤالي عن:\n* 🏠 **موقع سكن أي عامل:** مثل *"اين يسكن 40064"* أو *"سكن نبيل خان"*\n* 🏢 **إحصائيات مجمع محدد:** مثل *"كم ساكن في الرمال"* أو *"إشغال مجمع الزاهر"*\n* 📋 **الحضور والغياب:** مثل *"مين الغائب اليوم"*\n* ✈️ **الإجازات والعودة:** مثل *"اعطيني قائمة بالمتبقي للعودة من اجازة"*\n* 📊 **الإشغال العام:** مثل *"كم عدد الساكنين حالياً؟"*`,
    category: 'general',
  };
}

/**
 * Main Entry Point for AI Copilot Chat
 */
export async function askEstateCopilot(userPrompt: string, history: CopilotMessage[] = []): Promise<CopilotResponse> {
  try {
    const rawMsg = userPrompt.trim();
    const numberMatch = rawMsg.match(/\b\d{4,12}\b/);
    const targetId = numberMatch ? numberMatch[0] : null;

    // Check if user is asking about a specific worker ID
    let specificWorkerContext = '';
    if (targetId) {
      const workerInfo = findWorkerHousing(targetId);
      if (workerInfo && workerInfo.found) {
        specificWorkerContext = `\nSPECIFIC WORKER LOOKUP FOUND FOR ID ${targetId}:\n${JSON.stringify(workerInfo)}\n`;
      }
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLEAI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (apiKey) {
      try {
        const occupancyStats = getOccupancyStats();
        const attendanceStats = getAttendanceReport();
        const leavesStats = getLeavesReport(30);
        const contractsStats = getContractsAndFinancialSummary();

        // If user is asking for worker search, residence search, or history, enrich context
        let extraContext = '';
        if (targetId) {
          const wInfo = findWorkerHousing(targetId);
          if (wInfo?.found) {
            extraContext += `\nSPECIFIC WORKER FOUND FOR ${targetId}:\n${JSON.stringify(wInfo, null, 2)}\n`;
          }
          const wHistory = getWorkerHistory(targetId);
          if (wHistory.length > 0) {
            extraContext += `\nWORKER ACCOMMODATION HISTORY TIMELINE FOR ${targetId}:\n${JSON.stringify(wHistory, null, 2)}\n`;
          }
        }

        const systemInstruction = `
أنت المساعد الذكي التوليدي الفعلي (EstateCare AI Copilot) لإدارة عمليات الإسكان والعمال والمشاريع.
أنت نموذج ذكاء اصطناعي حقيقي يعتمد على بيانات حية ومباشرة من قاعدة بيانات النظام (Cloudflare D1).
تتحدث باللغة العربية بأسلوب احترافي، دقيق، وواضح (وباللغة الإنجليزية إذا سألك المستخدم بالإنجليزية).
أجب عن أي سؤال جديد أو معقد أو استنتاجي أو تاريخي بناءً على البيانات الحية أدناه.

قاعدة البيانات الحية للنظام (Live System Data):
1. شؤون الإسكان والإشغال:
- إجمالي الساكنين حالياً: ${occupancyStats.totalOccupants}
- الطاقة الاستيعابية الإجمالية: ${occupancyStats.totalCapacity} سرير
- الأسرّة الشاغرة المتاحة: ${occupancyStats.totalFreeBeds}
- نسبة الإشغال الإجمالية: ${occupancyStats.overallOccupancyRate}
- تفصيل المجمعات السكنية: ${JSON.stringify(occupancyStats.topResidences)}

2. الحضور والغياب (تاريخ السجل: ${attendanceStats.date}):
- الحاضرون: ${attendanceStats.presentCount}
- الغائبون: ${attendanceStats.absentCount}
- المتأخرون: ${attendanceStats.lateCount}
- نسبة الحضور: ${attendanceStats.attendanceRate}
- عينة من الغائبين: ${JSON.stringify(attendanceStats.absenteesSample)}
- الغياب حسب القسم/المشروع: ${JSON.stringify(attendanceStats.absenteesByDept)}

3. الإجازات وحركة العودة:
- في إجازة حالياً: ${leavesStats.currentlyOnLeaveCount}
- المتوقع عودتهم خلال 30 يوم: ${leavesStats.returningSoonCount}
- المتأخرون عن موعد العودة: ${leavesStats.overdueReturnCount}
- قائمة العائدين قريباً: ${JSON.stringify(leavesStats.returningSoonList)}

4. العقود وتواريخ الانتهاء والمالية:
- إجمالي العقود المسجلة: ${contractsStats.totalContracts}
- العقود السارية: ${contractsStats.activeContractsCount}
- العقود التي تنتهي قريباً (خلال 90 يوم): ${contractsStats.expiringContractsCount}
- العقود المنتهية: ${contractsStats.expiredContractsCount}
- قائمة تفصيلية بكافة العقود وتواريخ انتهائها وأطرافها وقيمتها:
${JSON.stringify(contractsStats.allContractsSummary.slice(0, 50), null, 2)}

${extraContext}

تعليمات الإجابة:
- لديك الآن كافة تفاصيل وتواريخ انتهاء العقود وأطرافها، إذا سأل المستخدم عن تاريخ انتهاء العقود أو العقود التي تنتهي قريباً أو العقود السارية، اذكرها بالتفصيل من الجدول أعلاه.
- إذا سأل عن تاريخ أو سجل عامل أو متى سكن، اذكر سجله التاريخي.
- افهم قصد المستخدم بذكاء. إذا سأل عن مكان سكن عامل محدد، اذكر مجمعه وغرفته ودوره بدقة ولا تعرض جدول الإشغال العام.
- إذا طلب مقارنات أو اقتراحات أو خطط أو صياغة إيميلات أو تقارير، قم بتحليل البيانات وتقديم إجابة إبداعية واستنتاجية ذكية.
- نسق إجابتك باستخدام Markdown والجداول والنقاط العريضة عند الحاجة.
`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: [
              ...history.slice(-4).map((h) => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.content }],
              })),
              {
                role: 'user',
                parts: [{ text: userPrompt }],
              },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedText) {
            return {
              ok: true,
              reply: generatedText,
              sources: ['Google Gemini 2.5 Flash', 'Cloudflare D1 Live Database'],
            };
          }
        } else {
          const errData = await response.json();
          console.warn('[EstateCopilot] Gemini API response error:', errData);
        }
      } catch (llmErr) {
        console.warn('[EstateCopilot] LLM generation error, using fallback:', llmErr);
      }
    }

    // High-precision smart semantic processor
    const direct = processSmartSemanticQuery(userPrompt);
    return {
      ok: true,
      reply: direct.reply,
      category: direct.category,
      metrics: direct.metrics,
      sources: ['Cloudflare D1 Live Database'],
    };
  } catch (err: any) {
    console.error('[EstateCopilot] Error in askEstateCopilot:', err);
    return {
      ok: false,
      reply: 'عذراً، حدث خطأ أثناء معالجة الطلب. يرجى المحاولة مرة أخرى.',
      error: err.message || 'Unknown error',
    };
  }
}
