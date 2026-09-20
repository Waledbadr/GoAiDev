'use client';

import { useState, useEffect, useMemo, useDeferredValue, useCallback } from 'react';
import { d1Client } from '@/lib/d1-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { 
  Search, 
  Download, 
  MapPin, 
  CalendarDays, 
  User, 
  Briefcase, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  Users,
  Clock,
  Flame,
  AlertCircle,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle2,
  Building2,
  Tag,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { useLanguage } from '@/context/language-context';
import { useUsers } from '@/context/users-context';
import { useResidences } from '@/context/residences-context';
import { TimesheetProvider, useTimesheet } from '@/context/timesheet-context';
import { getFiscalMonthPeriod, getFiscalMonthForDate } from '@/lib/fiscal-month-utils';
import { HousingEmployee, HousingEmployeesProvider } from '@/context/housing-employees-context';
import { EmployeeProfileSheet } from '@/components/timesheet/employees/employee-profile-sheet';
import { getProjectFromDevice } from '@/constants/timesheet-devices';

// Custom profession ordering for Monthly Archive (Arabic labels)
const PROFESSION_ORDER: Record<string, number> = {
  'إداري': 1,
  'مسؤول سكن': 2,
  'مدخل بيانات': 3,
  'مشرف سكن': 4,
  'تسكين عمالة': 5,
  'فني صيانة': 6,
  'فني تكييف': 7,
  'سائق': 8,
  'سباك': 9,
  'بناء': 10,
  'حداد': 11,
  'كهربائي': 12,
  'عامل': 13,
  'عامل نظافة': 14,
};

interface TimesheetCacheData {
  timestamp: number;
  records: any[];
  leaves: any[];
  transfers?: any[];
  employeesMap: Record<string, any>;
}

const CACHE_PREFIX = 'timesheet_history_data_';
const MAX_CACHED_MONTHS = 4;

const TIMESHEET_EXPORT_HEADERS = [
  'C_number',
  'Name',
  'Department',
  'Project',
  'R_Hours',
  'OT_Hours',
  'CostDscrp',
  'Ppm_PrNam',
  'Ppm_PrNo',
  'Task_Nam',
  'Task_No',
  'Date',
  'Remarks',
];

const TIMESHEET_EXPORT_COLS = [
  { wch: 8 },
  { wch: 34 },
  { wch: 14 },
  { wch: 48 },
  { wch: 8 },
  { wch: 8 },
  { wch: 12 },
  { wch: 8 },
  { wch: 8 },
  { wch: 8 },
  { wch: 8 },
  { wch: 24 },
  { wch: 18 },
];

function toExportDateTime(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

function formatExportHours(value?: number | null) {
  if (value === undefined || value === null || value === 0) return '';
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function getEmployeeKeyFromAny(obj: any): string | null {
  if (!obj) return null;
  const candidates = [
    obj.employeeId,
    obj.badgeId,
    obj.badgeNumber,
    obj.cNumber,
    obj.C_number,
    obj.empId,
    obj.id,
  ]
    .map((v) => (v === undefined || v === null ? '' : String(v).trim()))
    .filter(Boolean);
  return candidates[0] || null;
}

function generateAvailableMonths(endMonth: string): string[] {
  const startYearMonth = '2026-03';
  const months: string[] = [];
  let current = endMonth;
  
  let iterations = 0;
  while (current >= startYearMonth && iterations < 120) {
    months.push(current);
    
    const [yStr, mStr] = current.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10);
    
    if (m === 1) {
      y -= 1;
      m = 12;
    } else {
      m -= 1;
    }
    current = `${y}-${String(m).padStart(2, '0')}`;
    iterations++;
  }
  return months;
}

function readMonthlyCache(monthStr: string): TimesheetCacheData | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(`${CACHE_PREFIX}${monthStr}`);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveMonthlyCache(monthStr: string, records: any[], leaves: any[], employeesMap: Record<string, any>, transfers: any[] = []) {
  if (typeof window === 'undefined') return;
  try {
    const cacheData: TimesheetCacheData = {
      timestamp: Date.now(),
      records,
      leaves,
      transfers,
      employeesMap,
    };
    localStorage.setItem(`${CACHE_PREFIX}${monthStr}`, JSON.stringify(cacheData));
    
    const keys: { key: string; timestamp: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          if (item.timestamp) {
            keys.push({ key, timestamp: item.timestamp });
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    }
    
    keys.sort((a, b) => a.timestamp - b.timestamp);
    if (keys.length > MAX_CACHED_MONTHS) {
      const toRemove = keys.length - MAX_CACHED_MONTHS;
      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(keys[i].key);
      }
    }
  } catch (e) {
    console.warn('Failed to write timesheet history cache:', e);
  }
}

const getProfessionRank = (profession?: string) => {
  if (!profession) return 999;
  const key = profession.trim();
  return PROFESSION_ORDER[key] ?? 999;
};

interface BadgeChangeLink {
  oldBadge: string;
  newBadge: string;
  primaryBadge: string;
  changeDate: string;
  reason?: string;
}

function TimesheetHistoryContent() {
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const { currentUser } = useUsers();
  const { residences, loadResidences } = useResidences();
  const { projectToResidenceMap, timesheetEvents, employeeSchedules, deviceToProjectMap } = useTimesheet();
  
  const [records, setRecords] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [employeesMap, setEmployeesMap] = useState<Record<string, any>>({});
  
  const today = new Date();
  const defaultMonth = getFiscalMonthForDate(today);
  const [filterMonth, setFilterMonth] = useState<string>(defaultMonth);
  const [availableMonths, setAvailableMonths] = useState<string[]>(() => generateAvailableMonths(defaultMonth));
  
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedResidence, setSelectedResidence] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'badge_changed' | 'transferred' | 'absent'>('all');
  
  // Collapsible Projects state
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  // Employee profile sheet state (for quick Add Leave / Permission)
  const [selectedEmployee, setSelectedEmployee] = useState<HousingEmployee | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDefaultDate, setProfileDefaultDate] = useState<string | null>(null);

  const toggleProjectCollapse = (projectName: string) => {
    setCollapsedProjects(prev => ({
      ...prev,
      [projectName]: !prev[projectName]
    }));
  };

  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    availableProjectNames.forEach(p => { allCollapsed[p] = true; });
    setCollapsedProjects(allCollapsed);
  };

  const expandAll = () => {
    setCollapsedProjects({});
  };

  const goToNextMonth = () => {
    const currentIndex = availableMonths.indexOf(filterMonth);
    if (currentIndex > 0) {
      setFilterMonth(availableMonths[currentIndex - 1]);
    }
  };

  const goToPrevMonth = () => {
    const currentIndex = availableMonths.indexOf(filterMonth);
    if (currentIndex !== -1 && currentIndex < availableMonths.length - 1) {
      setFilterMonth(availableMonths[currentIndex + 1]);
    }
  };

  // Calculate days in selected fiscal month using company standard
  const { startDate, endDate, daysArray } = useMemo(() => {
    if (!filterMonth) return { startDate: new Date(), endDate: new Date(), daysArray: [] };

    const period = getFiscalMonthPeriod(filterMonth);
    const start = period.startDate;
    const end = period.endDate;

    const days = [];
    const current = new Date(start);
    while (current <= end) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      days.push(`${yyyy}-${mm}-${dd}`);
      current.setDate(current.getDate() + 1);
    }

    return { startDate: start, endDate: end, daysArray: days };
  }, [filterMonth]);

  const fetchData = useCallback(async (force = false) => {
    try {
      if (force) setIsRefreshing(true);

      const [d1Emps, d1Leaves, d1Exceptions, d1Transfers, d1Records] = await Promise.all([
        d1Client.getDocs<any>('housingEmployees'),
        d1Client.getDocs<any>('timesheetLeaves'),
        d1Client.getDocs<any>('timesheetExceptions'),
        d1Client.getDocs<any>('timesheetTransfers'),
        d1Client.getDocs<any>('attendanceRecords'),
      ]);

      const emps: Record<string, any> = {};
      if (d1Emps) {
        d1Emps.forEach(data => {
          const key = getEmployeeKeyFromAny(data) || data.id;
          emps[key] = { id: data.id, ...data };
          if (data.id && data.id !== key) {
            emps[data.id] = emps[key];
          }
        });
      }

      const fetchedLeaves = d1Leaves || [];
      const fetchedExceptions = d1Exceptions || [];
      const allRecords = d1Records || [];
      const dateStartStr = daysArray[0];
      const dateEndStr = daysArray[daysArray.length - 1];
      const fetchedRecords = daysArray.length > 0
        ? allRecords.filter(r => r.date >= dateStartStr && r.date <= dateEndStr)
        : allRecords;
      const fetchedTransfers = d1Transfers || [];

      setEmployeesMap(emps);
      setLeaves(fetchedLeaves);
      setExceptions(fetchedExceptions);
      setRecords(fetchedRecords);
      setTransfers(fetchedTransfers);

      saveMonthlyCache(filterMonth, fetchedRecords, fetchedLeaves, emps, fetchedTransfers);
      setLoading(false);
      setIsRefreshing(false);
    } catch (error) {
      console.error('Error fetching history data:', error);
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [daysArray, filterMonth]);

  useEffect(() => {
    if (!filterMonth) return;

    const dynamicMonths = generateAvailableMonths(defaultMonth);
    setAvailableMonths(dynamicMonths);

    const cached = readMonthlyCache(filterMonth);
    if (cached) {
      setRecords(cached.records);
      setLeaves(cached.leaves);
      if (cached.transfers) setTransfers(cached.transfers);
      setEmployeesMap(cached.employeesMap);
      setLoading(false);
    } else {
      setLoading(true);
    }

    loadResidences();
    fetchData();
  }, [defaultMonth, filterMonth, fetchData, loadResidences]);

  // 1. Build Badge ID Change Mapping Engine
  const badgeChangeMap = useMemo(() => {
    const map = new Map<string, BadgeChangeLink>();

    // Detect from timesheetTransfers
    transfers.forEach(t => {
      const type = String(t.type || '').toLowerCase().trim();
      const loc = String(t.location || '');
      const reason = String(t.reason || '');
      if (type.includes('change') || loc.includes('تغيير') || reason.includes('تغيير')) {
        const oldBadge = String(t.badgeId || t.employeeId || '').trim();
        const numMatch = loc.match(/\b\d{4,6}\b/);
        const newBadge = numMatch ? numMatch[0] : '';
        const changeDate = String(t.date || t.transferDate || '');
        if (oldBadge && newBadge && oldBadge !== newBadge) {
          const link: BadgeChangeLink = {
            oldBadge,
            newBadge,
            primaryBadge: newBadge,
            changeDate,
            reason: t.reason || 'نقل كفالة / تغيير رقم وظيفي'
          };
          map.set(oldBadge, link);
          map.set(newBadge, link);
        }
      }
    });

    // Detect from housingEmployees residenceLocation / transferDate
    Object.values(employeesMap).forEach(e => {
      const loc = String(e.residenceLocation || '');
      if (loc.includes('تغيير') && loc.includes('رقم')) {
        const oldBadge = String(e.employeeId || e.badgeId || '').trim();
        const numMatch = loc.match(/\b\d{4,6}\b/);
        const newBadge = numMatch ? numMatch[0] : '';
        const changeDate = String(e.transferDate || '');
        if (oldBadge && newBadge && oldBadge !== newBadge && !map.has(oldBadge)) {
          const link: BadgeChangeLink = {
            oldBadge,
            newBadge,
            primaryBadge: newBadge,
            changeDate,
            reason: 'تغيير رقم وظيفي'
          };
          map.set(oldBadge, link);
          map.set(newBadge, link);
        }
      }
    });

    return map;
  }, [transfers, employeesMap]);

  // Helper to resolve canonical employee profile details
  const getCanonicalEmpDetails = useCallback((badge: string) => {
    const changeInfo = badgeChangeMap.get(badge);
    const primaryBadge = changeInfo ? changeInfo.primaryBadge : badge;
    const oldBadge = changeInfo ? changeInfo.oldBadge : undefined;
    
    const empPrimary = employeesMap[primaryBadge] || {};
    const empOld = oldBadge ? (employeesMap[oldBadge] || {}) : {};
    
    const isDummyName = (n?: string) => !n || n === 'Unknown' || n === 'غير معروف' || n === '(بدون اسم)' || n === '(No Name)';
    const isDummyProf = (p?: string) => !p || p === 'HOUSING' || p === 'Worker' || p === '-';

    const name = (!isDummyName(empPrimary.name) ? empPrimary.name : (!isDummyName(empOld.name) ? empOld.name : (empPrimary.name || empOld.name || primaryBadge)));
    const nameAr = (!isDummyName(empPrimary.nameAr) ? empPrimary.nameAr : (!isDummyName(empOld.nameAr) ? empOld.nameAr : (empPrimary.nameAr || empOld.nameAr || name)));
    
    const profession = (!isDummyProf(empPrimary.profession) ? empPrimary.profession : (!isDummyProf(empOld.profession) ? empOld.profession : (empPrimary.profession || empOld.profession || '-')));
    const professionAr = (!isDummyProf(empPrimary.professionAr) ? empPrimary.professionAr : (!isDummyProf(empOld.professionAr) ? empOld.professionAr : (empPrimary.professionAr || empOld.professionAr || profession)));
    
    const department = empPrimary.department || empOld.department || 'HOUSING';
    const projectName = empPrimary.projectName || empOld.projectName || empPrimary.project || empOld.project;

    return {
      primaryBadge,
      oldBadge,
      isBadgeChanged: !!changeInfo,
      changeDate: changeInfo?.changeDate,
      changeReason: changeInfo?.reason,
      name,
      nameAr,
      profession,
      professionAr,
      department,
      projectName,
      rawProfile: Object.keys(empPrimary).length > 0 ? empPrimary : empOld
    };
  }, [badgeChangeMap, employeesMap]);

  // Group data by Residence (projectName) -> Employee
  const groupedData = useMemo(() => {
    // Stage 1: Collect everything by Canonical Employee Key
    const empRawGroup: Record<string, {
      canonicalKey: string;
      oldBadge?: string;
      changeDate?: string;
      allRecords: any[];
      primaryRes: string;
      residenceCounts: Record<string, number>;
    }> = {};

    // Get the allowed project names for non-admin users
    const userResidences = currentUser?.assignedResidences || [];
    let allowedProjectNames: string[] = [];
    if (currentUser?.role !== 'Admin') {
      const allowedNames = userResidences.flatMap(id => {
        const res = residences.find(r => r.id === id);
        return [
          res?.name?.toLowerCase(), 
          res?.nameAr?.toLowerCase(), 
          res?.nameEn?.toLowerCase()
        ].filter(Boolean);
      }) as string[];
      allowedProjectNames = Array.from(new Set(allowedNames));
    }

    records.forEach(record => {
      if (!record.date) return;
      if (!daysArray.includes(record.date)) return;

      const rawKey = getEmployeeKeyFromAny(record) || 'Unknown ID';
      const changeInfo = badgeChangeMap.get(rawKey);
      const canonicalKey = changeInfo ? changeInfo.primaryBadge : rawKey;

      if (!empRawGroup[canonicalKey]) {
        empRawGroup[canonicalKey] = { 
          canonicalKey,
          oldBadge: changeInfo?.oldBadge,
          changeDate: changeInfo?.changeDate,
          allRecords: [], 
          primaryRes: '', 
          residenceCounts: {} 
        };
      }
      
      empRawGroup[canonicalKey].allRecords.push(record);
      
      const rawDevice = record.checkInDevice || record.deviceName;
      const isRealDevice = rawDevice && rawDevice !== 'System Generated' && rawDevice !== 'Unknown' && rawDevice !== 'غير معروف';
      const mappedProj = isRealDevice ? (deviceToProjectMap?.[rawDevice] || getProjectFromDevice(rawDevice)) : null;
      const proj = mappedProj || record.projectName || 'Unassigned / Outside';
      empRawGroup[canonicalKey].residenceCounts[proj] = (empRawGroup[canonicalKey].residenceCounts[proj] || 0) + 1;
    });

    // Determine primary residence for each canonical employee
    Object.keys(empRawGroup).forEach(canonicalKey => {
      const counts = empRawGroup[canonicalKey].residenceCounts;
      let topProj = '';
      let maxCount = -1;
      
      Object.entries(counts).forEach(([proj, count]) => {
        if (count > maxCount) {
          maxCount = count;
          topProj = proj;
        }
      });
      
      const details = getCanonicalEmpDetails(canonicalKey);
      if (details.projectName && counts[details.projectName]) {
        topProj = details.projectName;
      }

      empRawGroup[canonicalKey].primaryRes = topProj || details.projectName || 'Unassigned / Outside';
    });

    const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

    // Stage 2: Create Grouped Structure
    const grouped: Record<string, Record<string, any>> = {};
    const employeeDailyProjects: Record<string, Record<string, string[]>> = {};

    Object.entries(empRawGroup).forEach(([canonicalKey, data]) => {
      const empDetails = getCanonicalEmpDetails(canonicalKey);
      const primaryRes = data.primaryRes || empDetails.projectName || 'Unassigned / Outside';

      // Clean check: Only assign to primary residence unless there is an official inter-camp transfer
      const assignedProjects = [primaryRes];

      assignedProjects.forEach(proj => {
        if (currentUser?.role !== 'Admin') {
          const mappedResidenceId = projectToResidenceMap[proj];
          if (mappedResidenceId) {
            if (!userResidences.includes(mappedResidenceId)) return;
          } else {
            const projLower = (proj || '').toLowerCase();
            if (!projLower || !allowedProjectNames.includes(projLower)) return;
          }
        }

        if (!grouped[proj]) grouped[proj] = {};
        if (!grouped[proj][canonicalKey]) {
          grouped[proj][canonicalKey] = {
            name: isAr ? empDetails.nameAr : empDetails.name,
            nameAr: empDetails.nameAr,
            nameEn: empDetails.name,
            profession: isAr ? empDetails.professionAr : empDetails.profession,
            professionAr: empDetails.professionAr,
            department: empDetails.department,
            canonicalBadge: canonicalKey,
            oldBadge: data.oldBadge,
            isBadgeChanged: !!data.oldBadge,
            changeDate: data.changeDate,
            daily: {},
            totalRH: 0,
            totalOT: 0,
            absences: 0
          };
        }

        // Process records for this employee
        data.allRecords.forEach(record => {
          const dateStr = record.date;
          const isFutureDate = dateStr > todayStr;
          const hasActualPunches = !!((record.punches && record.punches.length > 0) || (record.checkIn && record.checkOut));

          // If employee had a badge change, only use matching record based on transition date
          if (data.oldBadge && data.changeDate) {
            const recKey = getEmployeeKeyFromAny(record);
            if (dateStr < data.changeDate && recKey === data.canonicalKey && hasActualPunches === false) {
              // Ignore empty dummy record generated for the new badge before transition date
              return;
            }
            if (dateStr >= data.changeDate && recKey === data.oldBadge && hasActualPunches === false) {
              // Ignore empty dummy record generated for the old badge after transition date
              return;
            }
          }

          let sanitizedRecord = record;
          if (isFutureDate && !hasActualPunches) {
            sanitizedRecord = {
              ...record,
              status: 'Future',
              regularHours: 0,
              overtimeHours: 0,
              totalHours: 0
            };
          }

          const rawDevice = sanitizedRecord.checkInDevice || sanitizedRecord.deviceName;
          const isRealDevice = rawDevice && rawDevice !== 'System Generated' && rawDevice !== 'Unknown' && rawDevice !== 'غير معروف';
          const mappedProj = isRealDevice ? (deviceToProjectMap?.[rawDevice] || getProjectFromDevice(rawDevice)) : null;
          const recProj = mappedProj || sanitizedRecord.projectName || 'Unassigned / Outside';
          const isCrossLocation = hasActualPunches && recProj !== proj;

          const prevRecord = grouped[proj][canonicalKey].daily[dateStr];

          if (!prevRecord) {
            grouped[proj][canonicalKey].daily[dateStr] = {
              ...sanitizedRecord,
              hasOtherResidence: isCrossLocation,
              otherProjectNames: isCrossLocation ? [recProj] : []
            };
          } else {
            // Keep the record with the most hours/actual punches
            const prevHours = prevRecord.totalHours || prevRecord.regularHours || 0;
            const newHours = sanitizedRecord.totalHours || sanitizedRecord.regularHours || 0;
            if (newHours >= prevHours) {
              grouped[proj][canonicalKey].daily[dateStr] = {
                ...sanitizedRecord,
                hasOtherResidence: prevRecord.hasOtherResidence || isCrossLocation,
                otherProjectNames: Array.from(new Set([
                  ...(prevRecord.otherProjectNames || []),
                  ...(isCrossLocation ? [recProj] : [])
                ]))
              };
            }
          }

          // Flag badge change transition day
          if (data.oldBadge && data.changeDate && dateStr === data.changeDate) {
            if (grouped[proj][canonicalKey].daily[dateStr]) {
              grouped[proj][canonicalKey].daily[dateStr].isBadgeChangeDate = true;
              grouped[proj][canonicalKey].daily[dateStr].oldBadge = data.oldBadge;
              grouped[proj][canonicalKey].daily[dateStr].newBadge = data.canonicalKey;
            }
          }

          // Track cross-device punches
          if (hasActualPunches) {
            if (!employeeDailyProjects[canonicalKey]) employeeDailyProjects[canonicalKey] = {};
            if (!employeeDailyProjects[canonicalKey][dateStr]) employeeDailyProjects[canonicalKey][dateStr] = [];
            if (!employeeDailyProjects[canonicalKey][dateStr].includes(recProj)) {
              employeeDailyProjects[canonicalKey][dateStr].push(recProj);
            }
          }
        });
      });
    });

    // Populate Leaves with Deduplication
    leaves.forEach(l => {
      const rawBadge = l.badgeId || l.employeeId;
      if (!rawBadge || !l.startDate || !l.endDate) return;

      const changeInfo = badgeChangeMap.get(rawBadge);
      const canonicalBadge = changeInfo ? changeInfo.primaryBadge : rawBadge;
      const empDetails = getCanonicalEmpDetails(canonicalBadge);

      const primaryRes = empRawGroup[canonicalBadge]?.primaryRes || empDetails.projectName || 'Unassigned / Outside';

      if (currentUser?.role !== 'Admin') {
        const resId = projectToResidenceMap[primaryRes];
        if (resId && !userResidences.includes(resId)) return;
      }

      daysArray.forEach(dateStr => {
        if (dateStr >= l.startDate && dateStr <= l.endDate) {
          if (!grouped[primaryRes]) grouped[primaryRes] = {};
          if (!grouped[primaryRes][canonicalBadge]) {
            grouped[primaryRes][canonicalBadge] = {
              name: isAr ? empDetails.nameAr : empDetails.name,
              nameAr: empDetails.nameAr,
              nameEn: empDetails.name,
              profession: isAr ? empDetails.professionAr : empDetails.profession,
              professionAr: empDetails.professionAr,
              department: empDetails.department,
              canonicalBadge,
              daily: {},
              totalRH: 0,
              totalOT: 0,
              absences: 0
            };
          }

          const existing = grouped[primaryRes][canonicalBadge].daily[dateStr];
          if (!existing || existing.status === 'Absent' || !existing.checkIn) {
            grouped[primaryRes][canonicalBadge].daily[dateStr] = {
              status: 'Leave',
              leaveType: l.type || 'Leave',
              reason: l.reason || '',
              date: dateStr,
              regularHours: 8,
              overtimeHours: 0,
              totalHours: 8
            };
          }
        }
      });
    });

    // Populate Exceptions
    exceptions.forEach(ex => {
      const rawBadge = ex.badgeId || ex.employeeId;
      if (!rawBadge || !ex.startDate || !ex.endDate) return;

      const changeInfo = badgeChangeMap.get(rawBadge);
      const canonicalBadge = changeInfo ? changeInfo.primaryBadge : rawBadge;
      const empDetails = getCanonicalEmpDetails(canonicalBadge);

      const primaryRes = empRawGroup[canonicalBadge]?.primaryRes || empDetails.projectName || 'Unassigned / Outside';

      if (currentUser?.role !== 'Admin') {
        const resId = projectToResidenceMap[primaryRes];
        if (resId && !userResidences.includes(resId)) return;
      }

      daysArray.forEach(dateStr => {
        if (dateStr >= ex.startDate && dateStr <= ex.endDate) {
          if (!grouped[primaryRes]) grouped[primaryRes] = {};
          if (!grouped[primaryRes][canonicalBadge]) {
            grouped[primaryRes][canonicalBadge] = {
              name: isAr ? empDetails.nameAr : empDetails.name,
              nameAr: empDetails.nameAr,
              nameEn: empDetails.name,
              profession: isAr ? empDetails.professionAr : empDetails.profession,
              professionAr: empDetails.professionAr,
              department: empDetails.department,
              canonicalBadge,
              daily: {},
              totalRH: 0,
              totalOT: 0,
              absences: 0
            };
          }

          const existing = grouped[primaryRes][canonicalBadge].daily[dateStr];
          if (!existing || existing.status === 'Absent') {
            grouped[primaryRes][canonicalBadge].daily[dateStr] = {
              status: 'Exception',
              exceptionType: ex.type || 'Exception',
              reason: ex.reason || '',
              exceptionHours: ex.hours || 0,
              regularHours: ex.hours || 0,
              totalHours: ex.hours || 0,
              date: dateStr
            };
          }
        }
      });
    });

    // Process Friday Rest Allowance, Holiday Allowance, Transfers 'T', and Totals
    Object.keys(grouped).forEach(proj => {
      Object.keys(grouped[proj]).forEach(canonicalBadge => {
        const empData = grouped[proj][canonicalBadge];
        const empDetails = getCanonicalEmpDetails(canonicalBadge);

        // 1. Process Fridays (بدل الراحة الأسبوعية)
        daysArray.forEach((dateStr, idx) => {
          if (dateStr > todayStr) return;
          const dateObj = new Date(dateStr);
          if (dateObj.getDay() === 5) { // Friday
            const prevDateStr = daysArray[idx - 1]; // Thursday
            let workedThursday = false;

            if (prevDateStr) {
              const thursRecord = empData.daily[prevDateStr];
              workedThursday = !!(
                thursRecord && (
                  thursRecord.status === 'Present' ||
                  thursRecord.status === 'Leave' ||
                  thursRecord.status === 'Exception' ||
                  (thursRecord.punches && thursRecord.punches.length > 0) ||
                  (thursRecord.totalHours || 0) > 0 ||
                  (thursRecord.regularHours || 0) > 0
                )
              );
            } else if (idx === 0) {
              // First day of cycle is Friday
              workedThursday = daysArray.slice(1, 7).some(d => {
                const r = empData.daily[d];
                return r && (r.status === 'Present' || (r.totalHours || 0) > 0);
              });
            }

            if (workedThursday) {
              const fridayRecord = empData.daily[dateStr];
              if (!fridayRecord || fridayRecord.status === 'Absent' || (!fridayRecord.punches?.length && !fridayRecord.checkIn && (fridayRecord.totalHours || 0) === 0)) {
                empData.daily[dateStr] = {
                  status: 'Weekend',
                  isVirtualWeekend: true,
                  regularHours: 8,
                  overtimeHours: 0,
                  totalHours: 8,
                  date: dateStr,
                };
              } else if (fridayRecord.status !== 'Leave') {
                const ci = fridayRecord.checkIn;
                const co = fridayRecord.checkOut;
                let actualWorked = 0;
                if (ci && co && ci !== co) {
                  const [h1, m1] = ci.split(':').map(Number);
                  let [h2, m2] = co.split(':').map(Number);
                  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                  if (diff < 0) diff += 24 * 60;
                  actualWorked = Number((Math.round(diff / 15) * 15 / 60).toFixed(2));
                }
                fridayRecord.regularHours = 8;
                fridayRecord.overtimeHours = actualWorked;
                fridayRecord.totalHours = Number((8 + actualWorked).toFixed(2));
                fridayRecord.isVirtualWeekend = true;
                fridayRecord.status = 'Weekend';
              }
            }
          }
        });

        // 2. Transfer Marker 'T': Strictly isolate days after Move Out and before Move In
        const empRecord = empDetails.rawProfile;
        const allEmpTransfers = transfers.filter(t => {
          const b = String(t.badgeId || t.employeeId || '').trim();
          return b === canonicalBadge || (empData.oldBadge && b === empData.oldBadge);
        });

        // Check Move Out / Exit
        const moveOutTransfers = allEmpTransfers.filter(t => {
          const tType = String(t?.type || '').toLowerCase().trim();
          return tType === 'move out' || tType === 'move-out' || tType === 'final exit' || tType === 'exit' || tType === 'transfer' || tType.includes('خروج') || tType.includes('انهاء');
        });

        const moveOutDates = moveOutTransfers
          .map(t => String(t.date || t.transferDate || t.startDate || ''))
          .filter(d => d && d.includes('-'));

        let moveOutDate: string | undefined = undefined;
        if (moveOutDates.length > 0) {
          moveOutDates.sort((a, b) => b.localeCompare(a));
          moveOutDate = moveOutDates[0];
        } else if (empRecord?.transferDate && !empData.isBadgeChanged) {
          moveOutDate = String(empRecord.transferDate);
        } else if (empRecord?.moveOutDate) {
          moveOutDate = String(empRecord.moveOutDate);
        } else if (empRecord?.exitDate) {
          moveOutDate = String(empRecord.exitDate);
        }

        if (moveOutDate) {
          empData.isTransferred = true;
          empData.transferDate = moveOutDate;

          daysArray.forEach((dateStr) => {
            if (dateStr >= moveOutDate!) {
              const existing = empData.daily[dateStr];
              // If no punch or marked as Absent, mark as Transferred ('T')
              if (!existing || existing.status === 'Absent' || (existing.status !== 'Leave' && existing.status !== 'Exception' && existing.status !== 'Present' && (!existing.punches || existing.punches.length === 0) && (existing.totalHours || 0) === 0 && (existing.regularHours || 0) === 0)) {
                empData.daily[dateStr] = { status: 'Transferred', date: dateStr, isTransfer: true };
              }
            }
          });
        }

        // Check Move In / Join
        const moveInTransfers = allEmpTransfers.filter(t => {
          const tType = String(t?.type || '').toLowerCase().trim();
          return tType === 'move in' || tType === 'move-in' || tType === 'join' || tType.includes('دخول') || tType.includes('انضمام') || tType.includes('تسكين');
        });

        const moveInDates = moveInTransfers
          .map(t => String(t.date || t.transferDate || t.startDate || ''))
          .filter(d => d && d.includes('-'));

        let moveInDate: string | undefined = undefined;
        if (moveInDates.length > 0) {
          moveInDates.sort((a, b) => a.localeCompare(b));
          moveInDate = moveInDates[0];
        } else if (empRecord?.moveInDate) {
          moveInDate = String(empRecord.moveInDate);
        }

        if (moveInDate) {
          daysArray.forEach((dateStr) => {
            if (dateStr < moveInDate!) {
              const existing = empData.daily[dateStr];
              if (!existing || existing.status === 'Absent' || (existing.status !== 'Leave' && existing.status !== 'Exception' && existing.status !== 'Present' && (!existing.punches || existing.punches.length === 0) && (existing.totalHours || 0) === 0 && (existing.regularHours || 0) === 0)) {
                empData.daily[dateStr] = { status: 'Transferred', date: dateStr, isTransfer: true };
              }
            }
          });
        }

        // 3. Accumulate Accurate Totals (Excluding Transferred 'T' from Absences)
        empData.totalRH = 0;
        empData.totalOT = 0;
        empData.absences = 0;

        Object.values(empData.daily).forEach((record: any) => {
          if (record.isTransfer || record.status === 'Transferred' || record.status === 'Future' || record.status === 'Elsewhere') return;
          empData.totalRH += (record.regularHours !== undefined ? record.regularHours : (record.totalHours || 0));
          empData.totalOT += (record.overtimeHours || 0);
          
          if (record.status === 'Absent') {
            empData.absences += 1;
          }
        });
      });
    });

    // Remove employees who moved out in prior months and have 0 punches
    Object.keys(grouped).forEach(proj => {
      Object.keys(grouped[proj]).forEach(empId => {
        const emp = grouped[proj][empId];
        if (!emp.isTransferred) return;

        if (emp.transferDate && daysArray.length > 0 && emp.transferDate < daysArray[0]) {
          const hasPunch = Object.values(emp.daily).some(
            (r: any) => !r.isTransfer && r.status !== 'Absent' && (r.totalHours > 0 || r.regularHours > 0 || r.status === 'Present' || r.status === 'Weekend' || r.status === 'Holiday' || r.status === 'Leave')
          );
          if (!hasPunch) {
            delete grouped[proj][empId];
          }
        }
      });

      if (Object.keys(grouped[proj]).length === 0) {
        delete grouped[proj];
      }
    });

    return grouped;
  }, [records, daysArray, badgeChangeMap, deviceToProjectMap, getCanonicalEmpDetails, currentUser, residences, projectToResidenceMap, isAr, leaves, exceptions, transfers]);

  // Extract list of all available project names for dropdown
  const availableProjectNames = useMemo(() => {
    return Object.keys(groupedData).sort((a, b) => a.localeCompare(b));
  }, [groupedData]);

  // Calculate High-level KPI Summary Stats
  const summaryStats = useMemo(() => {
    let totalEmployees = 0;
    let totalRH = 0;
    let totalOT = 0;
    let totalAbsences = 0;
    let totalTransfers = 0;
    let totalBadgeChanges = 0;

    const seenEmps = new Set<string>();

    Object.values(groupedData).forEach((employees) => {
      Object.entries(employees).forEach(([empId, empData]: [string, any]) => {
        if (!seenEmps.has(empId)) {
          seenEmps.add(empId);
          totalEmployees += 1;
          totalRH += empData.totalRH || 0;
          totalOT += empData.totalOT || 0;
          totalAbsences += empData.absences || 0;
          if (empData.isTransferred) totalTransfers += 1;
          if (empData.isBadgeChanged) totalBadgeChanges += 1;
        }
      });
    });

    return {
      totalEmployees,
      totalRH: Number(totalRH.toFixed(1)),
      totalOT: Number(totalOT.toFixed(1)),
      totalAbsences,
      totalTransfers,
      totalBadgeChanges,
    };
  }, [groupedData]);

  // Filtered Grouped Data based on selectedResidence, statusFilter and search
  const filteredGroupedData = useMemo(() => {
    const result: Record<string, Record<string, any>> = {};

    Object.entries(groupedData).forEach(([project, employees]) => {
      if (selectedResidence !== 'all' && project !== selectedResidence) {
        return;
      }

      const filteredEmployees: Record<string, any> = {};

      Object.entries(employees).forEach(([empId, empData]: [string, any]) => {
        // Status filter
        if (statusFilter === 'active' && (empData.isTransferred || empData.absences > 4)) return;
        if (statusFilter === 'badge_changed' && !empData.isBadgeChanged) return;
        if (statusFilter === 'transferred' && !empData.isTransferred) return;
        if (statusFilter === 'absent' && empData.absences === 0) return;

        // Search term filter
        if (deferredSearchTerm) {
          const s = deferredSearchTerm.toLowerCase().trim();
          const matches =
            String(empData.name || '').toLowerCase().includes(s) ||
            String(empData.nameAr || '').toLowerCase().includes(s) ||
            String(empData.canonicalBadge || '').toLowerCase().includes(s) ||
            String(empData.oldBadge || '').toLowerCase().includes(s) ||
            String(empData.profession || '').toLowerCase().includes(s);
          if (!matches) return;
        }

        filteredEmployees[empId] = empData;
      });

      if (Object.keys(filteredEmployees).length > 0) {
        result[project] = filteredEmployees;
      }
    });

    return result;
  }, [groupedData, selectedResidence, statusFilter, deferredSearchTerm]);

  const handleExportMonthlySheet = () => {
    const rows: Array<(string | number)[]> = [];

    Object.entries(groupedData)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([project, employees]) => {
        Object.entries(employees)
          .sort(([, a], [, b]) => {
            const rankA = getProfessionRank(a.profession);
            const rankB = getProfessionRank(b.profession);
            if (rankA !== rankB) return rankA - rankB;
            return String(a.name || '').localeCompare(String(b.name || ''));
          })
          .forEach(([empId, empData]) => {
            daysArray.forEach((dateStr) => {
              const record = empData.daily?.[dateStr];
              if (!record) return;

              const hasExportableHours =
                (record.regularHours || 0) > 0 ||
                (record.overtimeHours || 0) > 0 ||
                (record.totalHours || 0) > 0 ||
                record.status === 'Present' ||
                record.status === 'Weekend' ||
                record.status === 'Holiday';

              if (!hasExportableHours) return;
              if (record.isTransfer || record.status === 'Transferred' || record.status === 'Absent' || record.status === 'Elsewhere') return;

              let remarks = String(record.reason || record.leaveType || '');
              if (empData.oldBadge && dateStr < (empData.changeDate || '')) {
                remarks = remarks ? `${remarks} (Old ID: ${empData.oldBadge})` : `Old ID: ${empData.oldBadge}`;
              } else if (record.isBadgeChangeDate) {
                remarks = remarks ? `${remarks} (ID Changed)` : `ID Changed from ${empData.oldBadge} to ${empData.canonicalBadge}`;
              }

              rows.push([
                String(empData.canonicalBadge || empId || ''),
                String(empData.name || record.firstName || ''),
                String(empData.department || record.department || 'HOUSING'),
                String(project || record.projectName || 'Unassigned / Outside'),
                formatExportHours(record.regularHours ?? record.totalHours),
                formatExportHours(record.overtimeHours),
                String(record.costDescription || 'Housing'),
                '',
                '',
                '',
                '',
                toExportDateTime(dateStr),
                remarks,
              ]);
            });
          });
      });

    if (rows.length === 0) return;

    const worksheet = XLSX.utils.aoa_to_sheet([TIMESHEET_EXPORT_HEADERS, ...rows]);
    worksheet['!cols'] = TIMESHEET_EXPORT_COLS;
    worksheet['!autofilter'] = { ref: `A1:M${rows.length + 1}` };
    worksheet['!rows'] = [{ hpt: 31.5 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    const fileName = `timesheet-${filterMonth}.xlsx`;
    XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', cellStyles: true, type: 'array', compression: true });
  };

  const handleCellDoubleClick = (empId: string, dateStr: string) => {
    const details = getCanonicalEmpDetails(empId);
    const emp = details.rawProfile;
    if (!emp) return;
    setSelectedEmployee(emp as HousingEmployee);
    setProfileDefaultDate(dateStr);
    setProfileOpen(true);
  };

  const renderCell = (record: any, empId: string, dateStr: string) => {
    if (!record) return <div className="text-gray-300 dark:text-gray-700 select-none">-</div>;
    
    let checkIn = record.checkIn;
    let checkOut = record.checkOut;

    if (checkIn && !checkOut) {
      const punchHour = parseInt(checkIn.split(':')[0], 10);
      if (!isNaN(punchHour) && punchHour >= 12) {
        checkOut = checkIn;
        checkIn = null;
      }
    }

    const isAbsent = record.status === 'Absent';
    const isPresent = record.status === 'Present';
    const isLeave = record.status === 'Leave' || record.status === 'On Leave' || record.status === 'Sick Leave' || record.status === 'Permission';
    const isException = record.status === 'Exception';
    const isElsewhere = record.status === 'Elsewhere';
    const isFuture = record.status === 'Future';
    const isTransferred = record.status === 'Transferred' || record.isTransfer;
    const isBadgeChangeDate = !!record.isBadgeChangeDate;
    const hasHours = (record.regularHours || 0) > 0 || (record.overtimeHours || 0) > 0 || (record.totalHours || 0) > 0;
    
    const isMissingPunch = (!checkIn || !checkOut) && !isAbsent && !isLeave && !isException && !record.isVirtualWeekend && !isTransferred && !isElsewhere && !isFuture && hasHours === false;
    
    const formatNumber = (num: number) => {
      if (!num) return '0';
      return Number.isInteger(num) ? num.toString() : num.toFixed(1);
    };

    let content: React.ReactNode = '-';
    let tooltip = '';

    if (isFuture) {
      content = <span className="opacity-30 text-gray-400 select-none">-</span>;
      tooltip = isAr ? 'تاريخ مستقبلي' : 'Upcoming Date';
    } else if (isElsewhere) {
      content = <span className="opacity-30 select-none">-</span>;
      tooltip = isAr 
        ? `تم تسجيل العمل في: ${record.otherProjectNames.join(', ')}`
        : `Work recorded in: ${record.otherProjectNames.join(', ')}`;
    } else if (isTransferred) {
      content = <span className="font-bold text-gray-500 dark:text-gray-400">T</span>;
      tooltip = isAr ? 'منقول / خروج نهائي (لا يحتسب غياباً)' : 'Transferred / Moved Out (Excluded from absences)';
    } else if (isLeave) {
      if (record.leaveType === 'Sick' || record.leaveType === 'مرضية' || record.status === 'Sick Leave') {
        content = 'S';
      } else if (record.leaveType === 'Permission' || record.leaveType === 'استئذان' || record.status === 'Permission') {
        content = 'P';
      } else {
        content = 'L';
      }
      tooltip = isAr 
        ? `إجازة: ${record.leaveType || record.status || 'معتمدة'}\nملاحظات: ${record.reason || '-'}`
        : `Leave: ${record.leaveType || record.status || 'Approved'}\nNotes: ${record.reason || '-'}`;
    } else if (isException) {
      content = 'Ex';
      tooltip = isAr 
        ? `استثناء: ${record.exceptionType || 'معتمد'}${record.exceptionHours ? ` (${record.exceptionHours} ساعة)` : ''}\nملاحظات: ${record.reason || '-'}`
        : `Exception: ${record.exceptionType || 'Approved'}${record.exceptionHours ? ` (${record.exceptionHours} hrs)` : ''}\nNotes: ${record.reason || '-'}`;
    } else if (isAbsent) {
      content = 'A';
      tooltip = isAr ? 'غياب غير مبرر' : 'Status: Absent';
    } else if (record.isHoliday && (!hasHours || record.overtimeHours === 0)) {
      content = (
        <div className="flex flex-col items-center justify-center leading-none">
          <span className="text-purple-600 dark:text-purple-400 font-bold">8</span>
        </div>
      );
      tooltip = isAr ? 'بدل إجازة رسمية (8 ساعات)' : 'Official Holiday Allowance (8 hours)';
    } else if (record.isVirtualWeekend && (!hasHours || record.overtimeHours === 0)) {
      content = (
        <div className="flex flex-col items-center justify-center leading-none">
          <span className="font-bold">8</span>
        </div>
      );
      tooltip = isAr ? 'بدل راحة أسبوعية (8 ساعات)' : 'Weekly Rest Allowance (8 hours)';
    } else if (hasHours) {
      const rh = record.regularHours !== undefined ? record.regularHours : (record.totalHours || 0);
      const ot = record.overtimeHours || 0;
      
      content = (
        <div className="flex flex-col items-center justify-center leading-none">
          <span>{formatNumber(rh)}</span>
          {ot > 0 && <span className="text-[8px] md:text-[9px] font-bold text-orange-600 dark:text-orange-400">+{formatNumber(ot)}</span>}
        </div>
      );
      tooltip = record.isHoliday
        ? (isAr ? `بدل إجازة رسمية (8 س) + عمل إضافي\nدخول: ${checkIn || '-'} | خروج: ${checkOut || '-'}` : `Holiday Allowance (8h) + Overtime\nIn: ${checkIn || '-'} | Out: ${checkOut || '-'}`)
        : record.isVirtualWeekend
        ? (isAr ? `بدل راحة أسبوعية (8 س) + عمل إضافي\nدخول: ${checkIn || '-'} | خروج: ${checkOut || '-'}` : `Weekly Rest Allowance (8h) + Overtime\nIn: ${checkIn || '-'} | Out: ${checkOut || '-'}`)
        : `In: ${checkIn || '-'} | Out: ${checkOut || '-'}`;
    } else if (isMissingPunch) {
      content = '1';
      tooltip = isAr ? `بصمة مفردة ناقصة\nدخول: ${checkIn || 'مفقود'} | خروج: ${checkOut || 'مفقود'}` : `Missing Punch\nIn: ${checkIn || 'Missed'} | Out: ${checkOut || 'Missed'}`;
    } else if (isPresent) {
      content = 'P';
      tooltip = `In: ${checkIn || '-'} | Out: ${checkOut || '-'}`;
    }

    if (isBadgeChangeDate) {
      tooltip = `${isAr ? `★ تاريخ تغيير الرقم الوظيفي من ${record.oldBadge} إلى ${record.newBadge}\n` : `★ Badge changed from ${record.oldBadge} to ${record.newBadge}\n`}${tooltip}`;
    }

    return (
      <div 
        title={tooltip + (record.hasOtherResidence ? `\n• ${isAr ? 'تم تسجيل العمل في:' : 'Also recorded in:'} ${record.otherProjectNames.join(', ')}` : '')}
        className={`w-6 h-6 md:w-8 md:h-8 flex flex-col items-center justify-center rounded text-[10px] md:text-xs font-bold mx-auto cursor-help relative transition-all
        ${isTransferred ? 'bg-gray-100 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400 opacity-70 border border-dashed border-gray-300 dark:border-gray-700' : ''}
        ${(isPresent && !isMissingPunch && !record.isVirtualWeekend && !record.isHoliday) || (hasHours && !record.isVirtualWeekend && !record.isHoliday) ? 'bg-emerald-100/70 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 shadow-sm' : ''}
        ${record.isHoliday ? 'bg-purple-100/70 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : ''}
        ${record.isVirtualWeekend && !record.isHoliday ? 'bg-sky-100/70 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300' : ''}
        ${isAbsent && !record.isHoliday ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : ''}
        ${isLeave ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : ''}
        ${isException ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : ''}
        ${isMissingPunch && !isLeave && !isException && !record.isHoliday ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : ''}
        ${isBadgeChangeDate ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
      `}
        onDoubleClick={() => handleCellDoubleClick(empId, dateStr)}
      >
        {record.hasOtherResidence && (
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border border-white dark:border-gray-900 z-20" title={`${isAr ? 'بصمة في سكن آخر:' : 'Punch at:'} ${record.otherProjectNames.join(', ')}`} />
        )}
        {isBadgeChangeDate && (
          <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 bg-purple-600 rounded-full border border-white dark:border-gray-900 z-20" title={isAr ? 'تاريخ تغيير الرقم الوظيفي' : 'ID Change Date'} />
        )}
        {content}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-[1600px] mx-auto w-full">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 bg-white dark:bg-gray-900 p-5 rounded-2xl border shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                {isAr ? 'أرشيف كشف الحضور الشهري' : 'Monthly Attendance Archive'}
              </h1>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                {isAr 
                  ? 'مصفوفة الحضور والغياب الشهرية منظمة حسب المساكن والمشاريع مع توحيد الأرقام الوظيفية والتحويلات.'
                  : 'Monthly attendance matrix organized by residences with unified employee badge IDs and transfers.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            className="h-10"
            title={isAr ? "تحديث البيانات من السيرفر" : "Refresh from server"}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isAr ? 'تحديث' : 'Refresh'}
          </Button>

          <Button 
            variant="default" 
            size="sm"
            onClick={handleExportMonthlySheet} 
            disabled={Object.keys(groupedData).length === 0}
            className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Download className="mr-1.5 h-4 w-4" />
            {isAr ? 'تصدير إكسيل الرواتب' : 'Export Monthly Sheet'}
          </Button>
        </div>
      </div>

      {/* KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <Card className="shadow-sm border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">{isAr ? 'إجمالي الموظفين' : 'Total Employees'}</p>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{summaryStats.totalEmployees}</h3>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">{isAr ? 'ساعات العمل العادية' : 'Regular Hours'}</p>
              <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{summaryStats.totalRH}</h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">{isAr ? 'ساعات الإضافي' : 'Overtime Hours'}</p>
              <h3 className="text-xl font-bold text-orange-600 dark:text-orange-400 mt-1">{summaryStats.totalOT}</h3>
            </div>
            <div className="p-2.5 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-xl">
              <Flame className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">{isAr ? 'أيام الغياب' : 'Total Absences'}</p>
              <h3 className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">{summaryStats.totalAbsences}</h3>
            </div>
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
              <AlertCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md col-span-2 sm:col-span-1">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">{isAr ? 'تغيير أرقام / نقل' : 'ID Changes / Move'}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xl font-bold text-purple-600 dark:text-purple-400">{summaryStats.totalBadgeChanges}</span>
                <span className="text-xs text-gray-400">/</span>
                <span className="text-sm font-semibold text-gray-500">{summaryStats.totalTransfers} {isAr ? 'نقل' : 'move'}</span>
              </div>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Control Bar */}
      <div className="flex flex-col gap-3 bg-white dark:bg-gray-900 p-4 rounded-2xl border shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={goToPrevMonth}
              disabled={availableMonths.indexOf(filterMonth) >= availableMonths.length - 1}
              title={isAr ? "الشهر السابق" : "Previous Month"}
              className="h-10 w-10 shrink-0"
            >
              {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="h-10 min-w-[190px] font-medium">
                <CalendarDays className="w-4 h-4 mr-2 text-blue-600" />
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(month => (
                  <SelectItem key={month as string} value={month as string}>
                    {new Date((month as string) + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              size="icon" 
              onClick={goToNextMonth}
              disabled={availableMonths.indexOf(filterMonth) <= 0}
              title={isAr ? "الشهر التالي" : "Next Month"}
              className="h-10 w-10 shrink-0"
            >
              {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>

          {/* Residence Selector */}
          <div className="flex-1 max-w-xs">
            <Select value={selectedResidence} onValueChange={setSelectedResidence}>
              <SelectTrigger className="h-10 font-medium">
                <Building2 className="w-4 h-4 mr-2 text-gray-500" />
                <SelectValue placeholder={isAr ? "جميع المساكن" : "All Residences"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isAr ? "جميع المساكن / المشاريع" : "All Residences / Camps"}</SelectItem>
                {availableProjectNames.map(p => (
                  <SelectItem key={p} value={p}>
                    {p} ({Object.keys(groupedData[p] || {}).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder={isAr ? "بحث بالاسم، الرقم الوظيفي، السابق..." : "Search name, badge ID, previous..."}
              className="pl-9 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Collapse/Expand Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" onClick={expandAll} className="h-10 text-xs font-medium">
              <ChevronDown className="w-3.5 h-3.5 mr-1" />
              {isAr ? 'فرد الكل' : 'Expand All'}
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll} className="h-10 text-xs font-medium">
              <ChevronUp className="w-3.5 h-3.5 mr-1" />
              {isAr ? 'طي الكل' : 'Collapse All'}
            </Button>
          </div>
        </div>

        {/* Quick Filter Status Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            {isAr ? 'فلترة سريعة:' : 'Filter by:'}
          </span>

          {[
            { id: 'all', labelAr: 'الكل', labelEn: 'All' },
            { id: 'active', labelAr: 'النشطون', labelEn: 'Active' },
            { id: 'badge_changed', labelAr: 'تم تغيير الرقم الوظيفي ★', labelEn: 'ID Changed ★' },
            { id: 'transferred', labelAr: 'المنقولون (T)', labelEn: 'Transferred (T)' },
            { id: 'absent', labelAr: 'يوجد غياب (A)', labelEn: 'Has Absences' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {isAr ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Legend Bar */}
      <div className="bg-white/60 dark:bg-gray-900/60 p-3 rounded-xl border flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600 dark:text-gray-300">
        <span className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1">
          <Tag className="w-3.5 h-3.5 text-blue-600" />
          {isAr ? 'دليل الرموز:' : 'Legend:'}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">8</span>
          <span>{isAr ? 'دوام فعلي' : 'Present'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-[10px]">8</span>
          <span>{isAr ? 'راحة أسبوعية (جمعة)' : 'Friday Rest'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-purple-100 text-purple-800 font-bold flex items-center justify-center text-[10px]">8</span>
          <span>{isAr ? 'إجازة رسمية' : 'Official Holiday'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-[10px] border border-dashed border-gray-400">T</span>
          <span>{isAr ? 'منقول / خروج' : 'Transferred'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px]">L</span>
          <span>{isAr ? 'إجازة سنوية / مرضية' : 'Leave (L/S/P)'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[10px]">Ex</span>
          <span>{isAr ? 'استثناء معتمد' : 'Exception'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-rose-100 text-rose-700 font-bold flex items-center justify-center text-[10px]">A</span>
          <span>{isAr ? 'غياب' : 'Absent'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-[10px]">1</span>
          <span>{isAr ? 'بصمة ناقصة' : 'Single Punch'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
          <span>{isAr ? 'بصمة في سكن آخر' : 'Cross-Location Punch'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
          <span>{isAr ? 'تاريخ تغيير الرقم الوظيفي' : 'ID Change Date'}</span>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-24 text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{isAr ? 'جاري تحميل مصفوفة الحضور ومعالجة التحويلات...' : 'Loading attendance matrix and resolving transfers...'}</p>
        </div>
      ) : Object.keys(filteredGroupedData).length === 0 ? (
        <div className="py-20 text-center border rounded-2xl bg-white dark:bg-gray-950 shadow-sm">
          <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-300 font-medium text-base">
            {isAr ? 'لا توجد سجلات مطابقة للشروط المحددة في هذا الشهر.' : 'No records match the selected criteria for this month.'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {isAr ? 'جرب تغيير خيارات الفلترة أو اختيار سكن آخر.' : 'Try changing your filter criteria or selecting another residence.'}
          </p>
        </div>
      ) : (
        Object.entries(filteredGroupedData).sort(([a], [b]) => a.localeCompare(b)).map(([project, employees]) => {
          const isCollapsed = !!collapsedProjects[project];
          const empCount = Object.keys(employees).length;

          return (
            <Card key={project} className="overflow-hidden shadow-sm border border-gray-200/90 dark:border-gray-800 rounded-2xl transition-all">
              <CardHeader 
                className="bg-gray-50/80 dark:bg-gray-900/80 border-b py-3.5 px-4 cursor-pointer select-none hover:bg-gray-100/70 dark:hover:bg-gray-850 transition-colors"
                onClick={() => toggleProjectCollapse(project)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <CardTitle className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                      {project}
                      <span className="text-xs font-medium text-gray-500 bg-gray-200/80 dark:bg-gray-800 px-2.5 py-0.5 rounded-full">
                        {empCount} {isAr ? 'موظف' : 'Employees'}
                      </span>
                    </CardTitle>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500">
                      {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {!isCollapsed && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-100/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold border-r sticky left-0 bg-gray-100 dark:bg-gray-800 min-w-[220px] z-10 w-52 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.1)] text-xs">
                          {isAr ? 'الموظف' : 'Employee'}
                        </th>
                        <th className="px-3 py-2.5 font-semibold border-r sticky left-52 bg-gray-50 dark:bg-gray-800/95 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] min-w-[130px] max-w-[160px] text-xs">
                          {isAr ? 'المهنة' : 'Profession'}
                        </th>
                        {daysArray.map((dateStr) => {
                          const dayStr = dateStr.split('-')[2];
                          const isWeekend = new Date(dateStr).getDay() === 5;
                          return (
                            <th 
                              key={dateStr} 
                              className={`px-1 py-1 font-medium text-center border-r min-w-[34px] text-[10px] md:text-xs ${
                                isWeekend ? 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 font-bold' : ''
                              }`}
                            >
                              {dayStr}
                            </th>
                          );
                        })}
                        <th className="px-2.5 py-2.5 font-bold text-center border-r text-gray-700 dark:text-gray-200 text-xs shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                          {isAr ? 'عادية (RH)' : 'Total RH'}
                        </th>
                        <th className="px-2.5 py-2.5 font-bold text-center border-r text-orange-600 dark:text-orange-400 text-xs shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                          {isAr ? 'إضافي (OT)' : 'Total OT'}
                        </th>
                        <th className="px-2.5 py-2.5 font-bold text-center border-r text-rose-600 dark:text-rose-400 text-xs shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                          {isAr ? 'الغياب' : 'Absences'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {Object.entries(employees).sort(([, a], [, b]) => {
                        const rankA = getProfessionRank(a.profession);
                        const rankB = getProfessionRank(b.profession);
                        if (rankA !== rankB) return rankA - rankB;
                        return String(a.name || '').localeCompare(String(b.name || ''));
                      }).map(([empId, empData]) => (
                        <tr key={empId} className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 bg-white dark:bg-gray-950 transition-colors">
                          {/* Employee Column */}
                          <td className="px-4 py-2 border-r sticky left-0 bg-white dark:bg-gray-950 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">
                            <div className="flex items-start gap-2">
                              <User className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                              <div className="truncate w-full min-w-[130px]">
                                <Link
                                  href={`/timesheet/employee-report?badgeId=${empData.canonicalBadge || empId}&month=${filterMonth}`}
                                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-xs truncate flex items-center gap-1 group"
                                  title={isAr ? "عرض تقرير الموظف الشامل" : "View Employee Comprehensive Report"}
                                >
                                  <span className="truncate">{empData.name}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </Link>

                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                  <span className="text-[11px] font-mono text-gray-500 font-semibold">
                                    {empData.canonicalBadge || empId}
                                  </span>

                                  {/* Badge Change Tag */}
                                  {empData.isBadgeChanged && empData.oldBadge && (
                                    <Badge 
                                      variant="outline" 
                                      className="text-[9px] px-1 py-0 h-4 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200"
                                      title={isAr ? `تم تغيير الرقم في ${empData.changeDate || ''} (الرقم السابق: ${empData.oldBadge})` : `Changed on ${empData.changeDate || ''} (Previous: ${empData.oldBadge})`}
                                    >
                                      ★ {isAr ? `سابقاً: ${empData.oldBadge}` : `Prev: ${empData.oldBadge}`}
                                    </Badge>
                                  )}

                                  {/* Transferred Tag */}
                                  {empData.isTransferred && (
                                    <Badge 
                                      variant="outline" 
                                      className="text-[9px] px-1 py-0 h-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300"
                                      title={isAr ? `تاريخ النقل/الخروج: ${empData.transferDate || ''}` : `Transfer date: ${empData.transferDate || ''}`}
                                    >
                                      {isAr ? 'منقول' : 'Transferred'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Profession Column */}
                          <td className="px-3 py-2 border-r sticky left-52 bg-gray-50/50 dark:bg-gray-900/80 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] text-xs text-gray-600 dark:text-gray-300 min-w-[130px] max-w-[160px]">
                            <div className="flex items-start gap-1.5" title={empData.profession}>
                              <Briefcase className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
                              <span className="font-medium text-[11px] md:text-xs leading-tight line-clamp-2 break-words" title={empData.profession}>
                                {empData.profession}
                              </span>
                            </div>
                          </td>

                          {/* Daily Days Matrix */}
                          {daysArray.map(dateStr => {
                            const isWeekend = new Date(dateStr).getDay() === 5;
                            return (
                              <td 
                                key={dateStr} 
                                className={`px-0.5 py-1 border-r text-center align-middle ${
                                  isWeekend ? 'bg-sky-50/40 dark:bg-sky-950/10' : ''
                                }`}
                              >
                                {renderCell(empData.daily[dateStr], empId, dateStr)}
                              </td>
                            );
                          })}

                          {/* Total RH */}
                          <td className="px-2 py-2 text-center border-r font-bold text-gray-900 dark:text-gray-100 bg-gray-50/80 dark:bg-gray-900/50">
                            {empData.totalRH > 0 ? (Number.isInteger(empData.totalRH) ? empData.totalRH : empData.totalRH.toFixed(1)) : '-'}
                          </td>

                          {/* Total OT */}
                          <td className="px-2 py-2 text-center border-r font-bold text-orange-600 dark:text-orange-400 bg-orange-50/30 dark:bg-orange-900/10">
                            {empData.totalOT > 0 ? (Number.isInteger(empData.totalOT) ? empData.totalOT : empData.totalOT.toFixed(1)) : '-'}
                          </td>

                          {/* Absences */}
                          <td className="px-2 py-2 text-center border-r font-bold text-rose-600 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-900/10">
                            {empData.absences > 0 ? empData.absences : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })
      )}

      {/* Employee Profile Quick-sheet */}
      <EmployeeProfileSheet 
        open={profileOpen && !!selectedEmployee}
        onOpenChange={(open) => {
          setProfileOpen(open);
          if (!open) {
            setSelectedEmployee(null);
            setProfileDefaultDate(null);
          }
        }}
        employee={selectedEmployee}
        defaultDate={profileDefaultDate}
      />
    </div>
  );
}

export default function TimesheetHistoryPage() {
  return (
    <HousingEmployeesProvider>
      <TimesheetProvider>
        <TimesheetHistoryContent />
      </TimesheetProvider>
    </HousingEmployeesProvider>
  );
}
