'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { d1Client } from '@/lib/d1-client';
import { db } from '@/lib/firebase';
import { HousingEmployeesProvider, useHousingEmployees, HousingEmployee } from '@/context/housing-employees-context';
import { TimesheetProvider, useTimesheet } from '@/context/timesheet-context';
import { useLanguage } from '@/context/language-context';
import { useUsers, User } from '@/context/users-context';
import { useResidences } from '@/context/residences-context';
import { getFiscalMonthPeriod, getFiscalMonthForDate } from '@/lib/fiscal-month-utils';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

import {
  UserCircle,
  Search,
  Calendar,
  Clock,
  Briefcase,
  Building,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plane,
  ArrowLeftRight,
  Printer,
  Download,
  CalendarDays,
  TrendingUp,
  Award,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  MapPin,
  Laptop,
  Check,
  ShieldCheck,
  UserCheck,
  Lock,
  Filter,
  Users,
  ArrowUpDown
} from 'lucide-react';

import * as XLSX from 'xlsx';

// Master list fallback for names if not found in database
const EMPLOYEE_MASTER: Record<string, { nameAr: string; name: string; professionAr: string; profession: string }> = {
  '40097': { nameAr: 'محمد العبدلي', name: 'Mohammed Al-Abdali', professionAr: 'إداري', profession: 'Administrator' },
  '28590': { nameAr: 'صدر قريشي', name: 'Sadr Qureshi', professionAr: 'مسؤول سكن', profession: 'Camp Boss / Housing Officer' },
  '50541': { nameAr: 'عبدالرحمن بهاتي', name: 'Abdulrahman Bhatti', professionAr: 'تسكين عمالة', profession: 'Housing Coordinator' },
  '34187': { nameAr: 'بلال قاضي', name: 'Bilal Qazi', professionAr: 'سباك', profession: 'Plumber' },
  '45768': { nameAr: 'جيمانتور ساربين', name: 'Jimantor Sarbin', professionAr: 'حداد', profession: 'Steel Fixer' },
  '49491': { nameAr: 'سلمان خان', name: 'Salman Khan', professionAr: 'عامل', profession: 'Laborer' },
  '49498': { nameAr: 'محمد مبارك', name: 'Mohammed Mubarik', professionAr: 'عامل', profession: 'Laborer' },
  '49545': { nameAr: 'محمد يونس', name: 'Mohammad Yunus', professionAr: 'كهربائي', profession: 'Electrician' },
  '49112': { nameAr: 'محمد أيوب', name: 'Mohammed Ayub', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '51121': { nameAr: 'نظام الدين أحمد', name: 'Nizamudin Ahmad', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '51155': { nameAr: 'شاكيب شاكر', name: 'Shakib Shaker', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '49902': { nameAr: 'زبيل محمد', name: 'Zubail Mohammed', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '41099': { nameAr: 'محمد عبده', name: 'Mohammed Abdu', professionAr: 'مسؤول سكن', profession: 'Camp Boss / Housing Officer' },
  '35512': { nameAr: 'خالد أحمد', name: 'Khalid Ahmed', professionAr: 'مدخل بيانات', profession: 'Data Entry' },
  '48571': { nameAr: 'محمد توصيف', name: 'Mohammad Tauseef', professionAr: 'سائق', profession: 'Driver' },
  '36048': { nameAr: 'بارو ديبو', name: 'Baru Dibu', professionAr: 'حداد', profession: 'Steel Fixer' },
  '28824': { nameAr: 'ألطاف بسياتي', name: 'Altaf Basiyati', professionAr: 'تسكين عمالة', profession: 'Housing Coordinator' },
  '31524': { nameAr: 'شهزاد أحمد', name: 'Shahzad Ahmed', professionAr: 'فني صيانة', profession: 'Maintenance Technician' },
  '30556': { nameAr: 'أيوب خان', name: 'Ayub Khan', professionAr: 'كهربائي', profession: 'Electrician' },
  '48878': { nameAr: 'عابد محمد', name: 'Abid Mohammed', professionAr: 'بناء', profession: 'Mason' },
  '49646': { nameAr: 'كمران محمود', name: 'Kamran Mahmoud', professionAr: 'بناء', profession: 'Mason' },
  '50210': { nameAr: 'ألطاف رفيق', name: 'Altaf Rafik', professionAr: 'عامل', profession: 'Laborer' },
  '29820': { nameAr: 'إعجاز عبدالرحمن', name: 'Ijaz Abdulrahman', professionAr: 'سائق', profession: 'Driver' },
  '49546': { nameAr: 'ريحان خان', name: 'Rehan Khan', professionAr: 'كهربائي', profession: 'Electrician' },
  '50271': { nameAr: 'عاقب حسين', name: 'Aakib Hussain', professionAr: 'عامل', profession: 'Laborer' },
  '49502': { nameAr: 'محمد عمران', name: 'Mohammed Imran', professionAr: 'عامل', profession: 'Laborer' },
  '49916': { nameAr: 'نديم شريف', name: 'Nadeem Sharif', professionAr: 'فني تكييف', profession: 'AC Technician' },
  '39710': { nameAr: 'شرفي كشاف', name: 'Sharafi Kashaf', professionAr: 'مسؤول سكن', profession: 'Camp Boss / Housing Officer' },
  '39988': { nameAr: 'أحمد الزهراني', name: 'Ahmed Al-Zahrani', professionAr: 'مدخل بيانات', profession: 'Data Entry' },
  '29541': { nameAr: 'خالد علي', name: 'Khalid Ali', professionAr: 'مشرف سكن', profession: 'Housing Supervisor' },
  '32888': { nameAr: 'محسن سيل', name: 'Mohsen Sail', professionAr: 'سائق', profession: 'Driver' },
  '31628': { nameAr: 'أبوبكر سلام', name: 'Abubakar Salam', professionAr: 'كهربائي', profession: 'Electrician' },
  '50083': { nameAr: 'خورشيد علم', name: 'Khurshed Alam', professionAr: 'سباك', profession: 'Plumber' },
  '51255': { nameAr: 'شاه رفيق', name: 'Shah Rafiq', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '49490': { nameAr: 'رباني جميل', name: 'Rabbanee Jamil', professionAr: 'عامل', profession: 'Laborer' },
  '37475': { nameAr: 'محمد غافر', name: 'Mohammed Ghafir', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '30807': { nameAr: 'محمد دايار', name: 'Mohammed Dayar', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '51256': { nameAr: 'عابد خان', name: 'Abid Khan', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '29778': { nameAr: 'محمد الدين', name: 'Mohammed Aldin', professionAr: 'مشرف سكن', profession: 'Housing Supervisor' },
  '49481': { nameAr: 'محمد فرمان', name: 'Mohammad Farman', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '49484': { nameAr: 'شاهنواز إرشاد', name: 'Sahanwaj Irsad', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '48969': { nameAr: 'ظهير علي', name: 'Zaheer Ali', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '49485': { nameAr: 'محمد إسرائيل', name: 'Mohd Israil', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '27990': { nameAr: 'محمد عريف', name: 'Mohammed Arif', professionAr: 'مشرف سكن', profession: 'Housing Supervisor' },
  '40666': { nameAr: 'محمد أبوعاصي', name: 'Mohammed Abu Asi', professionAr: 'مسؤول سكن', profession: 'Camp Boss / Housing Officer' },
  '34207': { nameAr: 'محمد سيكا', name: 'Mohammed Sika', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '49237': { nameAr: 'أسلم علي', name: 'Aslam Ali', professionAr: 'عامل', profession: 'Laborer' },
  '30239': { nameAr: 'محمد حسين', name: 'Mohammed Hussain', professionAr: 'مدخل بيانات', profession: 'Data Entry' },
  '48891': { nameAr: 'شير خان', name: 'Sher Khan', professionAr: 'سائق', profession: 'Driver' },
  '49776': { nameAr: 'نظام علي', name: 'Nizam Ali', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '34238': { nameAr: 'ذاكر رفيق', name: 'Jakir Rafiq', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '50874': { nameAr: 'هيثم إبراهيم', name: 'Haysam Ibrahim', professionAr: 'مسؤول سكن', profession: 'Camp Boss / Housing Officer' },
  '51537': { nameAr: 'محمد حمودة', name: 'Mohamed Hamouda', professionAr: 'مدخل بيانات', profession: 'Data Entry' },
  '49975': { nameAr: 'يسري علي', name: 'Yusri Ali', professionAr: 'فني تكييف', profession: 'AC Technician' },
  '32886': { nameAr: 'عبدالحكيم الغنامي', name: 'Abdulhakim Al-Ghanami', professionAr: 'كهربائي', profession: 'Electrician' },
  '51499': { nameAr: 'نبيل أبو الفتوح', name: 'Nabil Abu Al-Fotouh', professionAr: 'سباك', profession: 'Plumber' },
  '50674': { nameAr: 'جابر خان', name: 'Jabir Khan', professionAr: 'عامل', profession: 'Laborer' },
  '51183': { nameAr: 'سونو أحمد', name: 'Sonu Ahmed', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '51120': { nameAr: 'سمير حسين', name: 'Sameer Husain', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '50675': { nameAr: 'سهيل شريف', name: 'Sohel Sarif', professionAr: 'عامل', profession: 'Laborer' },
  '33412': { nameAr: 'أمين ديورا', name: 'Amin Dewra', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '51254': { nameAr: 'فهيم أحمد', name: 'Faheem Ahmad', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '51101': { nameAr: 'عبدالرؤوف علي', name: 'Abdul Rauf Ali', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '14192': { nameAr: 'شكور محمد', name: 'Shakur Mohammed', professionAr: 'تسكين عمالة', profession: 'Housing Coordinator' },
};

// Helper to determine if an employee belongs to the residences (assignedResidences) of a user or a selected residence filter
function isEmployeeInUserResidences(
  emp: any,
  user: User | null,
  allResidences: any[],
  selectedResFilter: string = 'ALL',
  projectToResidenceMap: Record<string, string> = {}
): boolean {
  if (!user) return true;

  let targetResKeys: string[] = [];

  if (selectedResFilter && selectedResFilter !== 'ALL') {
    if (user.role !== 'Admin') {
      const userAssigned = user.assignedResidences || [];
      if (
        !userAssigned.includes('ALL') &&
        !userAssigned.includes('*') &&
        !userAssigned.includes(selectedResFilter)
      ) {
        return false;
      }
    }
    targetResKeys = [selectedResFilter];
  } else if (user.role === 'Admin') {
    return true; // Admin with ALL filter selected sees all employees
  } else {
    targetResKeys = user.assignedResidences || [];
  }

  if (targetResKeys.length === 0) {
    return false;
  }

  if (targetResKeys.includes('ALL') || targetResKeys.includes('*')) {
    return true;
  }

  // Build match Set from targetResKeys and allResidences
  const allowedIdSet = new Set<string>();
  const allowedNameSet = new Set<string>();

  targetResKeys.forEach((key) => {
    if (!key) return;
    const norm = String(key).trim().toLowerCase();
    allowedIdSet.add(norm);

    const foundRes = allResidences.find(
      (r) =>
        String(r.id || '').trim().toLowerCase() === norm ||
        String(r.name || '').trim().toLowerCase() === norm ||
        String(r.nameAr || '').trim().toLowerCase() === norm ||
        String(r.nameEn || '').trim().toLowerCase() === norm
    );

    if (foundRes) {
      if (foundRes.id) allowedIdSet.add(String(foundRes.id).trim().toLowerCase());
      if (foundRes.name) allowedNameSet.add(String(foundRes.name).trim().toLowerCase());
      if (foundRes.nameAr) allowedNameSet.add(String(foundRes.nameAr).trim().toLowerCase());
      if (foundRes.nameEn) allowedNameSet.add(String(foundRes.nameEn).trim().toLowerCase());
      if (foundRes.title) allowedNameSet.add(String(foundRes.title).trim().toLowerCase());
    } else {
      allowedNameSet.add(norm);
    }
  });

  // Check employee's direct residenceId
  const empResId = String(emp.residenceId || '').trim().toLowerCase();
  if (empResId && allowedIdSet.has(empResId)) {
    return true;
  }

  // Extract candidate project/residence properties (excluding general department or job role)
  const candidates = [
    emp.projectName,
    emp.project,
    emp.residenceName,
    emp.residence,
    emp.residenceLocation,
    emp.building,
    emp.location
  ]
    .filter(Boolean)
    .map((v) => String(v).trim());

  if (candidates.length === 0) {
    return false;
  }

  for (const cand of candidates) {
    const candNorm = cand.toLowerCase();

    // 1. Check mapped residence ID from projectToResidenceMap
    const mappedResId = projectToResidenceMap[cand] || projectToResidenceMap[candNorm];
    if (mappedResId && allowedIdSet.has(String(mappedResId).trim().toLowerCase())) {
      return true;
    }

    // 2. Direct ID or Name match
    if (allowedIdSet.has(candNorm) || allowedNameSet.has(candNorm)) {
      return true;
    }

    // 3. Substring match for residence names
    for (const name of allowedNameSet) {
      if (name.length >= 3 && (candNorm.includes(name) || name.includes(candNorm))) {
        return true;
      }
    }
  }

  return false;
}

function EmployeeReportInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';

  const { currentUser, users } = useUsers();
  const { residences } = useResidences();
  const { employees, loading: empLoading } = useHousingEmployees();
  const { timesheetEvents, employeeSchedules, projectToResidenceMap } = useTimesheet();

  // Selected Employee & Filter State
  const initialBadge = searchParams.get('badgeId') || searchParams.get('employeeId') || '';
  const initialMonth = searchParams.get('month') || getFiscalMonthForDate(new Date());

  const [selectedBadge, setSelectedBadge] = useState<string>(initialBadge);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>(initialMonth);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('matrix');
  const [selectedResidenceFilter, setSelectedResidenceFilter] = useState<string>('ALL');
  const [adminSelectedUserId, setAdminSelectedUserId] = useState<string>('ALL');

  // Fetched Data for Employee
  const [loading, setLoading] = useState<boolean>(false);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [punchesSortOrder, setPunchesSortOrder] = useState<'desc' | 'asc'>('desc');

  // Sorted attendance records (default: newest date on top, excluding future dates)
  const sortedAttendanceRecords = useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    return [...attendanceRecords]
      .filter((r) => !r.date || r.date <= todayStr)
      .sort((a, b) => {
        const dateA = String(a.date || '');
        const dateB = String(b.date || '');
        if (dateA !== dateB) {
          return punchesSortOrder === 'desc'
            ? dateB.localeCompare(dateA)
            : dateA.localeCompare(dateB);
        }
        const timeA = String(a.checkIn || a.time || '');
        const timeB = String(b.checkIn || b.time || '');
        return punchesSortOrder === 'desc'
          ? timeB.localeCompare(timeA)
          : timeA.localeCompare(timeB);
      });
  }, [attendanceRecords, punchesSortOrder]);

  // Generate Months List (Current fiscal month and 18 previous fiscal months)
  const availableMonths = useMemo(() => {
    const months: string[] = [];
    const currentM = getFiscalMonthForDate(new Date());
    let [y, m] = currentM.split('-').map(Number);
    for (let i = 0; i < 18; i++) {
      const monthStr = `${y}-${String(m).padStart(2, '0')}`;
      months.push(monthStr);
      if (m === 1) {
        y -= 1;
        m = 12;
      } else {
        m -= 1;
      }
    }
    return months;
  }, []);

  // Map of all employees combined (Context + Master lookup)
  const combinedEmployeesMap = useMemo(() => {
    const map: Record<string, any> = {};

    // 1. Fill from Master
    Object.keys(EMPLOYEE_MASTER).forEach((b) => {
      map[b] = {
        id: b,
        employeeId: b,
        badgeId: b,
        name: EMPLOYEE_MASTER[b].name,
        nameAr: EMPLOYEE_MASTER[b].nameAr,
        profession: EMPLOYEE_MASTER[b].profession,
        professionAr: EMPLOYEE_MASTER[b].professionAr,
        department: EMPLOYEE_MASTER[b].professionAr || 'عامل',
        projectName: 'المشروع الرئيسي',
        dailyHours: 8,
        monthlySalary: 3000,
        status: 'Active'
      };
    });

    // 2. Override / enrich from housingEmployees
    employees.forEach((emp) => {
      const k = String(emp.employeeId || emp.badgeId || emp.id || '').trim();
      if (k) {
        map[k] = {
          ...map[k],
          ...emp,
          id: emp.id || k,
          employeeId: emp.employeeId || k,
          badgeId: emp.badgeId || k,
          name: emp.name || map[k]?.name || 'Unknown',
          nameAr: emp.nameAr || map[k]?.nameAr || emp.name || 'غير معروف',
          profession: emp.profession || map[k]?.profession || 'Worker',
          professionAr: emp.professionAr || map[k]?.professionAr || 'عامل',
          department: emp.department || map[k]?.department || '',
          projectName: emp.projectName || map[k]?.projectName || 'الموقع العام',
          dailyHours: emp.dailyHours || 8,
          monthlySalary: emp.monthlySalary || 0,
          status: emp.status || 'Active'
        };
      }
    });

    return map;
  }, [employees]);

  // User Allowed Residences for Dropdown & Scope
  const userAllowedResidences = useMemo(() => {
    let effectiveUser = currentUser;
    if (currentUser?.role === 'Admin' && adminSelectedUserId && adminSelectedUserId !== 'ALL') {
      const found = users.find((u) => u.id === adminSelectedUserId);
      if (found) effectiveUser = found;
    }

    if (!effectiveUser) return [];

    if (effectiveUser.role === 'Admin') {
      return residences;
    }

    const assignedIds = effectiveUser.assignedResidences || [];
    if (assignedIds.includes('ALL') || assignedIds.includes('*')) {
      return residences;
    }

    return residences.filter((r) => assignedIds.includes(r.id));
  }, [currentUser, adminSelectedUserId, users, residences]);

  // User Assigned Residence Names for UI Banner
  const userAssignedResNames = useMemo(() => {
    if (!currentUser) return [];

    let targetUser = currentUser;
    if (currentUser.role === 'Admin' && adminSelectedUserId && adminSelectedUserId !== 'ALL') {
      const found = users.find((u) => u.id === adminSelectedUserId);
      if (found) targetUser = found;
    }

    if (targetUser.role === 'Admin') return [isAr ? 'جميع السكنات' : 'All Residences'];

    const resIds = targetUser.assignedResidences || [];
    if (resIds.length === 0) return [];
    if (resIds.includes('ALL') || resIds.includes('*')) {
      return [isAr ? 'جميع السكنات' : 'All Residences'];
    }
    return resIds.map((idOrName) => {
      const found = residences.find(
        (r) =>
          r.id === idOrName ||
          r.name === idOrName ||
          r.nameAr === idOrName ||
          r.nameEn === idOrName
      );
      return found ? (isAr ? found.nameAr || found.name : found.nameEn || found.name) : idOrName;
    });
  }, [currentUser, adminSelectedUserId, users, residences, isAr]);

  // Allowed employees filtered strictly by assigned residences or residence filter
  const userAllowedEmployees = useMemo(() => {
    const list = Object.values(combinedEmployeesMap);

    if (currentUser?.role === 'Admin' && adminSelectedUserId && adminSelectedUserId !== 'ALL') {
      const targetUser = users.find((u) => u.id === adminSelectedUserId);
      if (targetUser) {
        return list.filter((emp) =>
          isEmployeeInUserResidences(
            emp,
            targetUser,
            residences,
            selectedResidenceFilter,
            projectToResidenceMap
          )
        );
      }
    }

    return list.filter((emp) =>
      isEmployeeInUserResidences(
        emp,
        currentUser,
        residences,
        selectedResidenceFilter,
        projectToResidenceMap
      )
    );
  }, [
    combinedEmployeesMap,
    currentUser,
    residences,
    selectedResidenceFilter,
    adminSelectedUserId,
    users,
    projectToResidenceMap
  ]);

  // List of filtered employee options for combobox/search
  const employeeOptions = useMemo(() => {
    if (!searchTerm) return userAllowedEmployees;
    const term = searchTerm.toLowerCase();
    return userAllowedEmployees.filter(
      (e: any) =>
        e.name?.toLowerCase().includes(term) ||
        e.nameAr?.includes(term) ||
        String(e.employeeId || e.badgeId || '').toLowerCase().includes(term) ||
        e.profession?.toLowerCase().includes(term) ||
        e.professionAr?.includes(term)
    );
  }, [userAllowedEmployees, searchTerm]);

  // Auto-select first allowed employee if current selected is invalid or empty
  useEffect(() => {
    if (userAllowedEmployees.length > 0) {
      const isCurrentValid = userAllowedEmployees.some(
        (e: any) => String(e.employeeId || e.badgeId || e.id) === String(selectedBadge)
      );
      if (!selectedBadge || !isCurrentValid) {
        const first = userAllowedEmployees[0];
        setSelectedBadge(String(first.employeeId || first.badgeId || first.id));
      }
    } else {
      setSelectedBadge('');
    }
  }, [userAllowedEmployees, selectedBadge]);

  // Find latest known project from attendance records (based on employee's last biometric check-in)
  const latestProjectFromPunches = useMemo(() => {
    if (!attendanceRecords || attendanceRecords.length === 0) return null;
    const sorted = [...attendanceRecords].sort((a, b) => {
      const dateA = String(a.date || '');
      const dateB = String(b.date || '');
      return dateB.localeCompare(dateA); // Newest first
    });

    for (const rec of sorted) {
      if (
        rec.projectName &&
        rec.projectName !== 'Unassigned / Outside' &&
        rec.projectName !== '-' &&
        rec.checkInDevice !== 'System Generated'
      ) {
        return rec.projectName;
      }
    }
    return null;
  }, [attendanceRecords]);

  // Current selected employee details
  const currentEmp = useMemo(() => {
    const base = combinedEmployeesMap[selectedBadge] || null;
    if (!base) return null;
    return {
      ...base,
      projectName: latestProjectFromPunches || base.projectName || 'الموقع العام'
    };
  }, [combinedEmployeesMap, selectedBadge, latestProjectFromPunches]);

  // Fetch Attendance, Leaves, Transfers & Exceptions whenever employee or month changes
  useEffect(() => {
    if (!selectedBadge) return;

    let isSubscribed = true;
    setLoading(true);

    const fetchData = async () => {
      try {
        const empKey = String(selectedBadge).trim();

        // Fetch all relevant collections from Cloudflare D1
        const [allAttendance, allLeaves, allTransfers, allExceptions] = await Promise.all([
          d1Client.getDocs<any>('attendanceRecords'),
          d1Client.getDocs<any>('timesheetLeaves'),
          d1Client.getDocs<any>('timesheetTransfers'),
          d1Client.getDocs<any>('timesheetExceptions'),
        ]);

        if (!isSubscribed) return;

        const attList = (allAttendance || []).filter((r: any) => String(r.employeeId).trim() === empKey);
        const lList = (allLeaves || []).filter((l: any) => String(l.employeeId).trim() === empKey || String(l.badgeId).trim() === empKey || l.employeeDocId === empKey);
        const tList = (allTransfers || []).filter((t: any) => String(t.employeeId).trim() === empKey || String(t.badgeId).trim() === empKey);
        const eList = (allExceptions || []).filter((e: any) => String(e.employeeId).trim() === empKey || String(e.badgeId).trim() === empKey);

        setAttendanceRecords(attList);
        setLeaves(lList);
        setTransfers(tList);
        setExceptions(eList);
      } catch (err) {
        console.error('Error fetching employee timesheet details:', err);
      } finally {
        if (isSubscribed) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isSubscribed = false;
    };
  }, [selectedBadge, filterMonth]);

  // Calculate days in selected fiscal month using company standard (e.g. 21/07 to 20/08 for 2026-08)
  const { startDate, endDate, daysInMonth, periodLabel } = useMemo(() => {
    if (!filterMonth) return { startDate: new Date(), endDate: new Date(), daysInMonth: [], periodLabel: '' };

    const period = getFiscalMonthPeriod(filterMonth);
    const start = period.startDate;
    const end = period.endDate;

    const days: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      const yyyy = current.getUTCFullYear();
      const mm = String(current.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(current.getUTCDate()).padStart(2, '0');
      days.push(`${yyyy}-${mm}-${dd}`);
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return {
      startDate: start,
      endDate: end,
      daysInMonth: days,
      periodLabel: isAr ? period.labelAr : period.labelEn
    };
  }, [filterMonth, isAr]);

  // Process Daily Matrix for the Selected Month
  const dailyMatrix = useMemo(() => {
    const matrix: Record<string, any> = {};
    const daysSet = new Set(daysInMonth);

    // Indexed attendance records by date (merging multiple records and preserving real biometric punches)
    const attByDate: Record<string, any> = {};
    attendanceRecords.forEach((r) => {
      if (!r.date || !daysSet.has(r.date)) return;
      const existing = attByDate[r.date];
      if (!existing) {
        attByDate[r.date] = r;
      } else {
        const existingHasPunches = (existing.punches && existing.punches.length > 0) || existing.checkIn || (existing.totalHours || 0) > 0;
        const newHasPunches = (r.punches && r.punches.length > 0) || r.checkIn || (r.totalHours || 0) > 0;

        if (!existingHasPunches && newHasPunches) {
          attByDate[r.date] = r;
        } else if (existingHasPunches && newHasPunches) {
          const allPunches = Array.from(new Set([...(existing.punches || []), ...(r.punches || [])])).sort();
          const checkIn = existing.checkIn && r.checkIn ? (existing.checkIn < r.checkIn ? existing.checkIn : r.checkIn) : (existing.checkIn || r.checkIn);
          const checkOut = existing.checkOut && r.checkOut ? (existing.checkOut > r.checkOut ? existing.checkOut : r.checkOut) : (existing.checkOut || r.checkOut);
          const totalHours = Math.max(existing.totalHours || 0, r.totalHours || 0);
          const regularHours = Math.max(existing.regularHours || 0, r.regularHours || 0);
          const overtimeHours = Math.max(existing.overtimeHours || 0, r.overtimeHours || 0);
          attByDate[r.date] = {
            ...existing,
            ...r,
            checkIn,
            checkOut,
            totalHours,
            regularHours,
            overtimeHours,
            punches: allPunches,
            projectName: r.projectName && r.projectName !== 'Unassigned / Outside' ? r.projectName : existing.projectName,
            checkInDevice: r.checkInDevice && r.checkInDevice !== 'System Generated' ? r.checkInDevice : existing.checkInDevice,
          };
        }
      }
    });

    // Check move-out / transfer date for 'T' status
    const moveOutDates = transfers
      .filter((t) => {
        const type = String(t?.type || '').toLowerCase().trim();
        return (
          type === 'move out' ||
          type === 'move-out' ||
          type === 'exit' ||
          type === 'transfer' ||
          type.includes('خروج') ||
          type.includes('نقل')
        );
      })
      .map((t) => String(t.date || t.transferDate || ''))
      .filter((d) => d && d.includes('-'));

    let moveOutDate = moveOutDates.length > 0 ? moveOutDates.sort().reverse()[0] : currentEmp?.transferDate;

    daysInMonth.forEach((dateStr) => {
      const dayOfWeek = new Date(dateStr).getDay();
      const isFriday = dayOfWeek === 5; // Friday
      const todayStr = new Date().toISOString().substring(0, 10);
      const isFuture = dateStr > todayStr;

      // Do not include future dates in the report
      if (isFuture) return;

      const attRecord = attByDate[dateStr];

      // Check Leaves on this date
      const activeLeave = leaves.find(
        (l) => l.startDate && l.endDate && dateStr >= l.startDate && dateStr <= l.endDate
      );

      // Check Exceptions on this date
      const activeException = exceptions.find(
        (e) => e.startDate && e.endDate && dateStr >= e.startDate && dateStr <= e.endDate
      );

      // Check Event/Holiday
      const activeEvent = (timesheetEvents || []).find(
        (e) => dateStr >= e.startDate && dateStr <= e.endDate
      );

      let status = 'Absent';
      let checkIn = attRecord?.checkIn || null;
      let checkOut = attRecord?.checkOut || null;
      let totalHours = attRecord?.totalHours || 0;
      let regularHours = attRecord?.regularHours || 0;
      let overtimeHours = attRecord?.overtimeHours || 0;
      let punches: string[] = attRecord?.punches || [];
      let deviceName = attRecord?.checkInDevice || attRecord?.deviceName || '-';
      let projectName = attRecord?.projectName || currentEmp?.projectName || '-';

      if (attRecord && attRecord.status && attRecord.status !== 'Incomplete') {
        status = attRecord.status;
      } else if (attRecord && (totalHours > 0 || regularHours > 0 || (punches && punches.length > 0))) {
        status = 'Present';
      } else if (activeEvent) {
        status = activeEvent.type === 'holiday' ? 'Holiday' : 'Reduced';
        regularHours = activeEvent.requiredHours || 8;
      } else if (isFriday) {
        status = 'Weekend';
        regularHours = 8;
      } else {
        status = 'Absent';
      }

      // Overrides (Local real-time evaluation over stale backend status)
      if (activeLeave && (!attRecord || totalHours === 0 || status === 'Absent' || status === 'Leave' || status === 'On Leave' || status === 'Sick Leave')) {
        status = (activeLeave.type === 'Sick' || activeLeave.type === 'مرضية') ? 'Sick Leave' : 
                 (activeLeave.type === 'Permission' || activeLeave.type === 'استئذان' ? 'Permission' : 'On Leave');
        if (totalHours === 0) {
           regularHours = 8;
        }
      } else if (activeException && (!attRecord || totalHours === 0 || status === 'Absent')) {
        status = 'Exception';
      } else if (moveOutDate && dateStr >= moveOutDate && (!attRecord || totalHours === 0 || status === 'Absent')) {
        status = 'Transferred';
      }

      matrix[dateStr] = {
        date: dateStr,
        dayName: new Date(dateStr).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'short' }),
        status,
        checkIn,
        checkOut,
        totalHours,
        regularHours,
        overtimeHours,
        punches,
        deviceName,
        projectName,
        leaveType: activeLeave?.type || activeLeave?.leaveType,
        exceptionType: activeException?.type || activeException?.exceptionType,
        isFriday
      };
    });

    return matrix;
  }, [daysInMonth, attendanceRecords, leaves, exceptions, transfers, timesheetEvents, currentEmp, filterMonth, isAr]);

  // Monthly Summary Calculation
  const monthlyStats = useMemo(() => {
    let daysWorked = 0;
    let daysAbsent = 0;
    let daysLeave = 0;
    let daysTransferred = 0;
    let daysWeekend = 0;
    let totalRH = 0;
    let totalOT = 0;
    let expectedRH = 0;
    let expectedDays = 0;

    Object.values(dailyMatrix).forEach((d: any) => {
      if (d.status === 'Future') return;
      expectedDays++;
      
      let dayExpectedRH = currentEmp?.dailyHours || 8;
      const isThu = new Date(d.date).getDay() === 4;
      if ((currentEmp?.dailyHours === 8.5 || !currentEmp?.dailyHours) && isThu) {
         dayExpectedRH = 5.5;
      }
      
      if (d.status === 'Leave' || d.status === 'On Leave' || d.status === 'Sick Leave' || d.status === 'Permission' || d.status === 'Weekend' || d.status === 'Holiday') {
          dayExpectedRH = 8;
      }

      if (d.status !== 'Transferred') {
         expectedRH += dayExpectedRH;
      }

      if (d.status === 'Present' || d.status === 'Permission') {
        daysWorked++;
        totalRH += d.regularHours || 0;
        totalOT += d.overtimeHours || 0;
      } else if (d.status === 'Absent') {
        daysAbsent++;
      } else if (d.status === 'Leave' || d.status === 'On Leave' || d.status === 'Sick Leave') {
        daysLeave++;
        totalRH += 8;
      } else if (d.status === 'Transferred') {
        daysTransferred++;
      } else if (d.status === 'Weekend' || d.status === 'Holiday') {
        daysWeekend++;
        totalRH += 8;
      } else if (d.status === 'Exception') {
        daysWorked++;
        totalRH += d.regularHours || 8;
      }
    });

    const attendanceRate = expectedRH > 0 ? Math.round((totalRH / expectedRH) * 100) : 0;
    const baseSalary = currentEmp?.monthlySalary || 3000;
    const hourlyRate = baseSalary / 240; // ~240 hrs/month
    const otAmount = totalOT * hourlyRate * 1.5;
    const estimatedPayable = Math.round(baseSalary + otAmount);

    return {
      expectedDays,
      daysWorked,
      daysAbsent,
      daysLeave,
      daysTransferred,
      daysWeekend,
      totalRH: Math.round(totalRH * 10) / 10,
      totalOT: Math.round(totalOT * 10) / 10,
      attendanceRate,
      estimatedPayable,
      baseSalary,
      otAmount: Math.round(otAmount)
    };
  }, [dailyMatrix, currentEmp]);

  // Handle Month Switcher Shortcuts
  const goToPrevMonth = () => {
    const idx = availableMonths.indexOf(filterMonth);
    if (idx < availableMonths.length - 1) {
      setFilterMonth(availableMonths[idx + 1]);
    }
  };

  const goToNextMonth = () => {
    const idx = availableMonths.indexOf(filterMonth);
    if (idx > 0) {
      setFilterMonth(availableMonths[idx - 1]);
    }
  };

  // Export Employee Log to Excel
  const handleExportExcel = () => {
    if (!currentEmp) return;

    const rows = [
      ['تقرير دوام الموظف الشامل / Employee Timesheet Report'],
      [`الموظف: ${currentEmp.nameAr} (${currentEmp.name})`, `رقم الوظيفي: ${currentEmp.employeeId || currentEmp.badgeId}`],
      [`المهنة: ${currentEmp.professionAr || currentEmp.profession}`, `الفترة: ${periodLabel} (${filterMonth})`],
      [''],
      ['التاريخ', 'اليوم', 'الحالة', 'وقت الدخول', 'وقت الخروج', 'ساعات عادية (RH)', 'ساعات إضافية (OT)', 'إجمالي الساعات', 'الموقع/الجهاز']
    ];

    Object.values(dailyMatrix).forEach((d: any) => {
      rows.push([
        d.date,
        d.dayName,
        d.status,
        d.checkIn || '-',
        d.checkOut || '-',
        d.regularHours || 0,
        d.overtimeHours || 0,
        d.totalHours || 0,
        d.deviceName || '-'
      ]);
    });

    rows.push([]);
    rows.push(['الملخص الشهري:']);
    rows.push(['إجمالي أيام الحضور', monthlyStats.daysWorked]);
    rows.push(['إجمالي أيام الغياب', monthlyStats.daysAbsent]);
    rows.push(['إجمالي أيام الإجازات', monthlyStats.daysLeave]);
    rows.push(['ساعات العمل العادية (RH)', monthlyStats.totalRH]);
    rows.push(['ساعات العمل الإضافية (OT)', monthlyStats.totalOT]);
    rows.push(['نسبة الالتزام والدوام', `${monthlyStats.attendanceRate}%`]);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employee Log');
    XLSX.writeFile(workbook, `employee-timesheet-${selectedBadge}-${filterMonth}.xlsx`);
  };

  // Print Employee Report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto print:p-0">
      {/* 1. Header & Navigation Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UserCheck className="h-7 w-7 text-blue-600" />
            {isAr ? 'تقرير وبطاقة الموظف الشاملة' : 'Employee Timesheet & Analytics'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr
              ? 'استعراض سجل الدخول والخروج، ساعات العمل، الإجازات، والبيانات الشخصية لموظف في صفحة واحدة'
              : 'Detailed check-in/out records, work hours, leaves, and profile analytics on a single dashboard'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2 text-emerald-600" />
            {isAr ? 'تصدير Excel' : 'Export Excel'}
          </Button>
          <Button variant="default" size="sm" onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
            <Printer className="w-4 h-4 mr-2" />
            {isAr ? 'طباعة التقرير' : 'Print Report'}
          </Button>
        </div>
      </div>

      {/* User Scope & Access Indicator Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-blue-50/80 dark:bg-blue-950/40 p-3 rounded-lg border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          <Building className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="font-medium">
            {currentUser?.role === 'Admin' ? (
              isAr
                ? `صلاحيات مسؤول النظام (${currentUser?.name || 'Admin'}): يتم عرض عمالة كافة السكنات (${userAllowedEmployees.length} موظف)`
                : `System Admin Permissions (${currentUser?.name || 'Admin'}): Viewing workers across all residences (${userAllowedEmployees.length} total)`
            ) : (
              isAr
                ? `السكنات المسندة إليك [ ${userAssignedResNames.join('، ') || 'غير مسند'} ]: يتم عرض عمالة هذه السكنات فقط (${userAllowedEmployees.length} موظف)`
                : `Your Assigned Residences [ ${userAssignedResNames.join(', ') || 'None'} ]: Showing employees of assigned residences only (${userAllowedEmployees.length} total)`
            )}
          </span>
        </div>

        {/* Filters: Residence & User */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Residence Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline font-medium text-muted-foreground">
              {isAr ? 'السكن:' : 'Residence:'}
            </span>
            <Select value={selectedResidenceFilter} onValueChange={setSelectedResidenceFilter}>
              <SelectTrigger className="h-8 text-xs w-[170px] bg-white dark:bg-gray-900">
                <SelectValue placeholder={isAr ? 'جميع السكنات' : 'All Residences'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {isAr ? 'جميع السكنات المسندة' : 'All Assigned Residences'}
                </SelectItem>
                {userAllowedResidences.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {isAr ? r.nameAr || r.name : r.nameEn || r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Admin option to filter scope by user */}
          {currentUser?.role === 'Admin' && users && users.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline font-medium text-muted-foreground">
                {isAr ? 'المستخدم:' : 'User:'}
              </span>
              <Select value={adminSelectedUserId} onValueChange={setAdminSelectedUserId}>
                <SelectTrigger className="h-8 text-xs w-[170px] bg-white dark:bg-gray-900">
                  <SelectValue placeholder={isAr ? 'جميع العمالة' : 'All Employees'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{isAr ? 'جميع المستخدمين (كافة السكنات)' : 'All Users'}</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {userAllowedEmployees.length === 0 && (
        <Card className="border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-6 text-center print:hidden">
          <Building className="h-8 w-8 text-amber-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-amber-800 dark:text-amber-200">
            {isAr ? 'لا توجد عمالة تابعة للسكنات المسندة لحسابك' : 'No Workers Found in Assigned Residences'}
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 max-w-lg mx-auto">
            {isAr
              ? 'حساب المستخدم الحالي مرتبط بسكنات لا تحتوي على عمالة مسجلة حالياً، أو لم يتم إسناد سكنات لحسابك بعد. يرجى التواصل مع مدير النظام لإسناد السكنات الخاضعة لإشرافك أو مراجعة بيانات العمالة في السكن.'
              : 'Your account is linked to residences with no active workers, or no residences are assigned to your profile yet. Please contact the system administrator to update your assigned residences.'}
          </p>
        </Card>
      )}

      {/* 2. Employee Selector & Month Picker Bar */}
      <Card className="border shadow-sm bg-gradient-to-r from-blue-50/50 via-white to-slate-50/50 dark:from-gray-900 dark:to-gray-950 print:hidden">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Employee Combobox Search */}
          <div className="flex-1 w-full flex items-center">
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full md:w-[400px] justify-between bg-white dark:bg-gray-900 font-normal hover:bg-slate-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2 truncate">
                    <UserCircle className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="truncate">
                      {selectedBadge && currentEmp
                        ? `${currentEmp.nameAr || currentEmp.name} (#${currentEmp.employeeId || currentEmp.badgeId})`
                        : (isAr ? 'ابحث واختر الموظف...' : 'Search and select employee...')}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder={isAr ? 'ابحث بالاسم أو الرقم الوظيفي...' : 'Search by name or badge...'} 
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>{isAr ? 'لم يتم العثور على موظف.' : 'No employee found.'}</CommandEmpty>
                    <CommandGroup>
                      {employeeOptions.map((emp: any) => {
                        const empId = String(emp.employeeId || emp.badgeId || emp.id);
                        return (
                          <CommandItem
                            key={empId}
                            value={`${emp.nameAr} ${emp.name} ${empId}`}
                            onSelect={() => {
                              setSelectedBadge(empId);
                              setComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                String(selectedBadge) === empId ? "opacity-100 text-blue-600" : "opacity-0"
                              )}
                            />
                            <div className="flex items-center justify-between gap-2 w-full text-right flex-1 truncate">
                              <span className="font-semibold truncate">{emp.nameAr || emp.name}</span>
                              <span className="text-xs text-muted-foreground font-mono shrink-0">
                                #{empId}
                              </span>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Month Switcher Controls */}
          <div className="flex flex-col items-end gap-1 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPrevMonth} title={isAr ? 'الشهر السابق' : 'Previous Month'}>
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-[180px] bg-white dark:bg-gray-900 font-medium">
                  <CalendarDays className="w-4 h-4 mr-2 text-blue-600" />
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((m) => (
                    <SelectItem key={m} value={m}>
                      {new Date(m + '-01').toLocaleString(isAr ? 'ar-SA' : 'en-US', {
                        month: 'long',
                        year: 'numeric'
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={goToNextMonth} title={isAr ? 'الشهر التالي' : 'Next Month'}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            {periodLabel && (
              <span className="text-[11px] text-blue-700 dark:text-blue-300 font-mono font-semibold bg-blue-100/80 dark:bg-blue-950/80 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900 dir-ltr">
                {periodLabel}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Employee Profile Spotlight Banner */}
      {currentEmp ? (
        <Card className="border shadow-md overflow-hidden bg-white dark:bg-gray-900 print:hidden">
          <div className="h-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500" />
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              {/* Profile Avatar & Primary Data */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 md:h-20 md:w-20 border-2 border-blue-500 shadow-sm bg-blue-100 text-blue-700">
                  <AvatarFallback className="text-xl font-bold bg-blue-100 text-blue-800">
                    {currentEmp.nameAr?.charAt(0) || currentEmp.name?.charAt(0) || 'E'}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {currentEmp.nameAr}
                    </h2>
                    <span className="text-sm font-medium text-muted-foreground dir-ltr">
                      ({currentEmp.name})
                    </span>
                    <Badge variant={currentEmp.status === 'Active' ? 'default' : 'secondary'} className="bg-emerald-500 text-white">
                      {currentEmp.status || 'Active'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs md:text-sm text-muted-foreground mt-1 flex-wrap">
                    <span className="flex items-center gap-1 font-mono font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded">
                      #{currentEmp.employeeId || currentEmp.badgeId}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-gray-500" />
                      {currentEmp.professionAr || currentEmp.profession}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-gray-500" />
                      {currentEmp.projectName || 'المشروع الرئيسي'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Attendance Rating Ring / Badge */}
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-gray-800/60 p-4 rounded-xl border w-full md:w-auto justify-between md:justify-end">
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">{isAr ? 'معدل الالتزام والدوام' : 'Attendance Rate'}</span>
                  <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                    {monthlyStats.attendanceRate}%
                  </span>
                  <span className="text-[11px] text-emerald-600 block">
                    {monthlyStats.daysWorked} {isAr ? 'يوم عمل من' : 'days worked of'} {monthlyStats.expectedDays}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-blue-500 flex items-center justify-center bg-blue-50 dark:bg-blue-950">
                  <Award className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Quick Secondary Specs Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t text-xs">
              <div className="flex flex-col">
                <span className="text-muted-foreground">{isAr ? 'الراتب الأساسي' : 'Basic Salary'}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-200 mt-0.5">
                  {monthlyStats.baseSalary.toLocaleString()} {isAr ? 'ريال' : 'SAR'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">{isAr ? 'بدل الإضافي المستحق' : 'Overtime Allowance'}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  +{monthlyStats.otAmount.toLocaleString()} {isAr ? 'ريال' : 'SAR'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">{isAr ? 'إجمالي الاستحقاق المقدر' : 'Estimated Total'}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  {monthlyStats.estimatedPayable.toLocaleString()} {isAr ? 'ريال' : 'SAR'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">{isAr ? 'ساعات الدوام اليومية' : 'Daily Shift Hours'}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-200 mt-0.5">
                  {currentEmp.dailyHours || 8} {isAr ? 'ساعات' : 'hrs/day'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 4. Monthly High-Level Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        {/* Card 1: Days Worked */}
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{isAr ? 'أيام الحضور والعمل' : 'Days Worked'}</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{monthlyStats.daysWorked}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isAr ? 'من إجمالي' : 'out of'} {monthlyStats.expectedDays} {isAr ? 'يوم' : 'days'}
              </p>
            </div>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Total Worked Hours */}
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{isAr ? 'إجمالي الساعات (RH / OT)' : 'Total Hours'}</p>
              <h3 className="text-2xl font-bold text-blue-600 mt-1">
                {monthlyStats.totalRH} <span className="text-xs text-orange-600">+{monthlyStats.totalOT} OT</span>
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isAr ? 'ساعات العمل الفعلية المسجلة' : 'Recorded active hours'}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-950/50 text-blue-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Absences */}
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{isAr ? 'أيام الغياب' : 'Absences'}</p>
              <h3 className={`text-2xl font-bold mt-1 ${monthlyStats.daysAbsent > 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                {monthlyStats.daysAbsent}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {monthlyStats.daysAbsent === 0 ? (isAr ? 'التزام كامل بدون غياب' : 'No absences') : (isAr ? 'أيام غياب بدون إذن' : 'Unexcused absences')}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${monthlyStats.daysAbsent > 0 ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600' : 'bg-gray-100 text-gray-500'}`}>
              <XCircle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Leaves & Exceptions */}
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{isAr ? 'الإجازات والعطلات' : 'Leaves & Weekends'}</p>
              <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                {monthlyStats.daysLeave + monthlyStats.daysWeekend}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {monthlyStats.daysLeave} {isAr ? 'إجازة /' : 'leave /'} {monthlyStats.daysWeekend} {isAr ? 'عطلة' : 'weekend'}
              </p>
            </div>
            <div className="p-3 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 rounded-xl">
              <Plane className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. Interactive Comprehensive Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full print:hidden">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full bg-slate-100 dark:bg-gray-900 p-1 rounded-xl">
          <TabsTrigger value="matrix" className="text-xs md:text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {isAr ? 'جدول الحضور اليومي' : 'Daily Punch Matrix'}
          </TabsTrigger>
          <TabsTrigger value="punches" className="text-xs md:text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {isAr ? 'سجل البصمات الخام' : 'Raw Biometric Logs'}
          </TabsTrigger>
          <TabsTrigger value="leaves" className="text-xs md:text-sm flex items-center gap-2">
            <Plane className="w-4 h-4" />
            {isAr ? 'الإجازات والتنقلات' : 'Leaves & Transfers'}
          </TabsTrigger>
          <TabsTrigger value="stats" className="text-xs md:text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {isAr ? 'التحليل البياني' : 'Monthly Analytics'}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Daily Punch Matrix Table */}
        <TabsContent value="matrix" className="mt-4">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span>{isAr ? 'جدول الدوام والبصمات للفترة:' : 'Daily Attendance Log for Period:'} <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{periodLabel}</span></span>
                <span className="text-xs font-normal text-muted-foreground">
                  {Object.keys(dailyMatrix).length} {isAr ? 'يوم' : 'days'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold border-b">
                    <th className="p-3 border-l">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="p-3 border-l">{isAr ? 'اليوم' : 'Day'}</th>
                    <th className="p-3 border-l">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="p-3 border-l">{isAr ? 'وقت الدخول' : 'Check-In'}</th>
                    <th className="p-3 border-l">{isAr ? 'وقت الخروج' : 'Check-Out'}</th>
                    <th className="p-3 border-l text-center">{isAr ? 'ساعات RH' : 'RH'}</th>
                    <th className="p-3 border-l text-center">{isAr ? 'إضافي OT' : 'OT'}</th>
                    <th className="p-3 border-l">{isAr ? 'شريط البصمات' : 'Punches Log'}</th>
                    <th className="p-3">{isAr ? 'الجهاز / الموقع' : 'Device / Location'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {Object.values(dailyMatrix).map((d: any) => {
                    const isWeekend = d.isFriday;
                    return (
                      <tr
                        key={d.date}
                        className={`hover:bg-slate-50 dark:hover:bg-gray-900 ${
                          isWeekend ? 'bg-sky-50/40 dark:bg-sky-950/20' : ''
                        }`}
                      >
                        <td className="p-3 font-mono font-medium border-l">{d.date}</td>
                        <td className="p-3 border-l font-semibold">{d.dayName}</td>
                        <td className="p-3 border-l">
                          {d.status === 'Present' && (
                            <Badge className="bg-emerald-500 text-white">{isAr ? 'حاضر' : 'Present'}</Badge>
                          )}
                          {d.status === 'Absent' && (
                            <Badge variant="destructive">{isAr ? 'غائب' : 'Absent'}</Badge>
                          )}
                          {(d.status === 'Leave' || d.status === 'On Leave') && (
                            <Badge className="bg-indigo-500 text-white">{isAr ? 'إجازة' : 'Leave'}</Badge>
                          )}
                          {d.status === 'Sick Leave' && (
                            <Badge className="bg-pink-500 text-white">{isAr ? 'مرضي' : 'Sick Leave'}</Badge>
                          )}
                          {d.status === 'Permission' && (
                            <Badge className="bg-cyan-600 text-white">{isAr ? 'استئذان' : 'Permission'}</Badge>
                          )}
                          {d.status === 'Exception' && (
                            <Badge className="bg-amber-500 text-white">{isAr ? 'استثناء' : 'Exception'}</Badge>
                          )}
                          {d.status === 'Transferred' && (
                            <Badge variant="outline" className="text-gray-500 border-dashed">{isAr ? 'منقول (T)' : 'Transferred'}</Badge>
                          )}
                          {d.status === 'Weekend' && (
                            <Badge className="bg-sky-500 text-white">{isAr ? 'عطلة أسبوعية' : 'Weekend'}</Badge>
                          )}
                          {d.status === 'Holiday' && (
                            <Badge className="bg-purple-500 text-white">{isAr ? 'عطلة رسمية' : 'Holiday'}</Badge>
                          )}
                          {d.status === 'Future' && (
                            <span className="text-gray-400 opacity-60">-</span>
                          )}
                        </td>
                        <td className="p-3 border-l font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                          {d.checkIn || '-'}
                        </td>
                        <td className="p-3 border-l font-mono text-blue-700 dark:text-blue-400 font-semibold">
                          {d.checkOut || '-'}
                        </td>
                        <td className="p-3 border-l text-center font-bold">
                          {d.regularHours > 0 ? d.regularHours : '-'}
                        </td>
                        <td className="p-3 border-l text-center font-bold text-orange-600">
                          {d.overtimeHours > 0 ? `+${d.overtimeHours}` : '-'}
                        </td>
                        <td className="p-3 border-l">
                          {d.punches && d.punches.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {d.punches.map((p: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-mono bg-slate-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground opacity-50">-</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground text-[11px] truncate max-w-[150px]" title={d.deviceName}>
                          {d.deviceName}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Raw Biometric Logs */}
        <TabsContent value="punches" className="mt-4">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b">
              <div>
                <CardTitle className="text-base font-semibold">
                  {isAr ? 'سجل البصمات التفصيلي المسجل من أجهزة البصمة' : 'Raw Biometric Terminal Punches'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isAr
                    ? 'عرض جميع حركات البصمات المسجلة لهذا الموظف مرتبة حسب التاريخ (الأحدث في الأعلى)'
                    : 'All raw timestamped biometric logs for this employee sorted by date (newest first)'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 font-medium border-border/80"
                  onClick={() => setPunchesSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  {isAr
                    ? punchesSortOrder === 'desc'
                      ? 'الأحدث في الأعلى ↓'
                      : 'الأقدم في الأعلى ↑'
                    : punchesSortOrder === 'desc'
                    ? 'Newest First ↓'
                    : 'Oldest First ↑'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {sortedAttendanceRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {isAr ? 'لا توجد بصمات مسجلة في النظام لهذا الموظف' : 'No biometric records found for this employee.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedAttendanceRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 rounded-lg border bg-slate-50/50 dark:bg-gray-900 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 rounded-md font-bold font-mono">
                          {rec.date}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {isAr ? 'الدخول:' : 'In:'} <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{rec.checkIn || '-'}</span> |{' '}
                            {isAr ? 'الخروج:' : 'Out:'} <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{rec.checkOut || '-'}</span>
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            {rec.checkInDevice || rec.deviceName || 'جهاز البصمة'} - {rec.projectName || 'الموقع'}
                          </div>
                        </div>
                      </div>

                      {/* Punches sequence preview */}
                      {rec.punches && rec.punches.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] text-muted-foreground mr-1">{isAr ? 'البصمات:' : 'Punches:'}</span>
                          {rec.punches.map((p: string, idx: number) => (
                            <span key={idx} className="text-[10px] font-mono bg-background px-1.5 py-0.5 rounded border">
                              {p}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          RH: {rec.regularHours || 0} hrs
                        </Badge>
                        {(rec.overtimeHours || 0) > 0 && (
                          <Badge className="bg-orange-500 text-white font-mono">
                            OT: +{rec.overtimeHours} hrs
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Leaves, Exceptions & Transfers */}
        <TabsContent value="leaves" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Leaves List */}
            <Card className="border shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Plane className="w-5 h-5 text-indigo-600" />
                  {isAr ? 'سجل الإجازات المسجلة' : 'Approved Leaves History'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {leaves.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    {isAr ? 'لا توجد إجازات مسجلة' : 'No recorded leaves'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {leaves.map((l) => (
                      <div key={l.id} className="p-2.5 rounded-lg border bg-indigo-50/30 dark:bg-indigo-950/20 text-xs">
                        <div className="flex items-center justify-between font-semibold">
                          <span>{l.type || l.leaveType || 'إجازة سنوية'}</span>
                          <span className="font-mono text-indigo-600">{l.startDate} ➔ {l.endDate}</span>
                        </div>
                        {l.reason && <p className="text-muted-foreground text-[11px] mt-1">{l.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transfers List */}
            <Card className="border shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-purple-600" />
                  {isAr ? 'سجل التنقلات والمغادرة (T)' : 'Transfers & Move-Out History'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {transfers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    {isAr ? 'لا توجد تنقلات مسجلة' : 'No recorded transfers'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {transfers.map((t) => (
                      <div key={t.id} className="p-2.5 rounded-lg border bg-purple-50/30 dark:bg-purple-950/20 text-xs">
                        <div className="flex items-center justify-between font-semibold">
                          <span>{t.type || 'نقل موقع'}</span>
                          <span className="font-mono text-purple-600">{t.date || t.transferDate}</span>
                        </div>
                        {t.location && <p className="text-muted-foreground text-[11px] mt-1">{t.location}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: Monthly Visual Analytics */}
        <TabsContent value="stats" className="mt-4">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">
                {isAr ? 'التحليل البياني لساعات العمل ونسب الحضور' : 'Monthly Performance & Work Hours Visualizer'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
              {/* Progress Bar 1: Attendance Ratio */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span>{isAr ? 'نسبة الالتزام بالدوام الحقيقي' : 'Attendance Compliance Rate'}</span>
                  <span className="text-blue-600">{monthlyStats.attendanceRate}%</span>
                </div>
                <Progress value={monthlyStats.attendanceRate} className="h-3" />
              </div>

              {/* Attendance Distribution Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t text-center text-xs">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200">
                  <span className="text-muted-foreground block">{isAr ? 'أيام عمل رسمية' : 'Worked Days'}</span>
                  <span className="text-xl font-bold text-emerald-600">{monthlyStats.daysWorked}</span>
                </div>
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200">
                  <span className="text-muted-foreground block">{isAr ? 'أيام غياب' : 'Absent Days'}</span>
                  <span className="text-xl font-bold text-rose-600">{monthlyStats.daysAbsent}</span>
                </div>
                <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200">
                  <span className="text-muted-foreground block">{isAr ? 'إجازات معتمدة' : 'Leave Days'}</span>
                  <span className="text-xl font-bold text-indigo-600">{monthlyStats.daysLeave}</span>
                </div>
                <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200">
                  <span className="text-muted-foreground block">{isAr ? 'عطلات أسبوعية' : 'Weekends'}</span>
                  <span className="text-xl font-bold text-sky-600">{monthlyStats.daysWeekend}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PRINT-ONLY OFFICIAL A4 REPORT TEMPLATE */}
      <div className="hidden print:block text-black bg-white dir-rtl w-full">
        <style jsx global>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 4mm 5mm 4mm 5mm !important;
            }
            html, body {
              background: #ffffff !important;
              color: #000000 !important;
              font-family: Arial, 'Segoe UI', Tahoma, sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
            }
            .print\\:hidden {
              display: none !important;
            }
            .print\\:block {
              display: block !important;
            }
          }
        `}</style>

        {currentEmp ? (
          <div className="flex flex-col justify-between h-full space-y-2 text-xs">
            {/* 1. Official Document Header */}
            <div className="grid grid-cols-3 items-center border-b-2 border-slate-800 pb-3 mb-2">
              <div className="text-right space-y-1">
                <h1 className="text-sm font-black text-slate-900">الشركة السعودية للإنماء العمراني (ساكوديكو)</h1>
                <p className="text-[10px] text-slate-600 font-bold">إدارة السكنات - قسم الحضور والانصراف</p>
              </div>

              <div className="flex justify-center">
                 <div className="px-5 py-1.5 bg-slate-900 text-white rounded-md border-b-2 border-slate-700 shadow-sm">
                   <h2 className="font-bold text-[12px] tracking-wide">تقرير كشف حضور وانصراف موظف</h2>
                 </div>
              </div>

              <div className="text-left text-[9px] text-slate-700 space-y-1">
                <p><span className="font-bold text-slate-900">تاريخ الطباعة:</span> <span className="font-mono">{new Date().toLocaleDateString('ar-SA')} - {new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span></p>
                <p><span className="font-bold text-slate-900">الفترة المالية:</span> <span className="font-mono font-bold text-slate-900">{periodLabel} ({filterMonth})</span></p>
                <p><span className="font-bold text-slate-900">رقم المستند:</span> <span className="font-mono">TS-{selectedBadge}-{filterMonth}</span></p>
              </div>
            </div>

            {/* 2. Employee Metadata Grid Table */}
            <div className="border border-slate-400 rounded bg-slate-50 p-2 text-[10px] leading-tight">
              <div className="grid grid-cols-4 gap-x-4 gap-y-1">
                <div>
                  <span className="text-gray-500 block text-[9px]">اسم الموظف / Employee Name:</span>
                  <span className="font-bold text-gray-900 text-[11px]">{currentEmp.nameAr}</span>
                  {currentEmp.name && <span className="text-[9px] text-gray-600 block dir-ltr text-right">({currentEmp.name})</span>}
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">الرقم الوظيفي / Badge ID:</span>
                  <span className="font-mono font-bold text-blue-900 text-[11px]">#{currentEmp.employeeId || currentEmp.badgeId}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">المهنة / Profession:</span>
                  <span className="font-semibold text-gray-900">{currentEmp.professionAr || currentEmp.profession || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">السكن / المشروع Residence:</span>
                  <span className="font-semibold text-gray-900">{currentEmp.projectName || currentEmp.residenceName || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">الحالة / Operating Status:</span>
                  <span className="font-bold text-emerald-700">{currentEmp.status || 'Active'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">ساعات الدوام Daily Shift:</span>
                  <span className="font-semibold text-gray-900">{currentEmp.dailyHours || 8} ساعات/يوم</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">الراتب الأساسي / Basic Salary:</span>
                  <span className="font-bold text-gray-900">{monthlyStats.baseSalary.toLocaleString()} ريال</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">الاستحقاق التقديري / Total Payable:</span>
                  <span className="font-bold text-blue-900 text-[11px]">{monthlyStats.estimatedPayable.toLocaleString()} ريال</span>
                </div>
              </div>
            </div>

            {/* 3. Monthly Metrics Summary Strip */}
            <div className="grid grid-cols-6 gap-1 text-center text-[9px]">
              <div className="p-1 border border-emerald-300 bg-emerald-50 rounded">
                <span className="text-gray-600 block">أيام العمل (Worked)</span>
                <span className="font-bold text-emerald-800 text-[11px]">{monthlyStats.daysWorked}</span>
              </div>
              <div className="p-1 border border-rose-300 bg-rose-50 rounded">
                <span className="text-gray-600 block">أيام الغياب (Absent)</span>
                <span className="font-bold text-rose-800 text-[11px]">{monthlyStats.daysAbsent}</span>
              </div>
              <div className="p-1 border border-indigo-300 bg-indigo-50 rounded">
                <span className="text-gray-600 block">إجازات/عطلات (Leave/Wknd)</span>
                <span className="font-bold text-indigo-800 text-[11px]">{monthlyStats.daysLeave + monthlyStats.daysWeekend}</span>
              </div>
              <div className="p-1 border border-blue-300 bg-blue-50 rounded">
                <span className="text-gray-600 block">ساعات عادية (RH)</span>
                <span className="font-bold text-blue-900 text-[11px]">{monthlyStats.totalRH} hr</span>
              </div>
              <div className="p-1 border border-orange-300 bg-orange-50 rounded">
                <span className="text-gray-600 block">ساعات إضافية (OT)</span>
                <span className="font-bold text-orange-800 text-[11px]">+{monthlyStats.totalOT} hr</span>
              </div>
              <div className="p-1 border border-blue-400 bg-blue-100 rounded">
                <span className="text-gray-600 block">نسبة الالتزام (Compliance)</span>
                <span className="font-bold text-blue-950 text-[11px]">{monthlyStats.attendanceRate}%</span>
              </div>
            </div>

            {/* 4. Split 2-Column Daily Attendance Matrix (Side-by-side tables for 1-page fit) */}
            {(() => {
              const days = Object.values(dailyMatrix);
              const half = Math.ceil(days.length / 2);
              const col1 = days.slice(0, half);
              const col2 = days.slice(half);

              const renderTable = (items: any[]) => (
                <table className="w-full text-[8.5px] border-collapse border border-gray-400">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-bold border-b border-gray-400">
                      <th className="p-0.5 border-l border-gray-300 text-center w-16">التاريخ</th>
                      <th className="p-0.5 border-l border-gray-300 text-center w-10">اليوم</th>
                      <th className="p-0.5 border-l border-gray-300 text-center w-14">الحالة</th>
                      <th className="p-0.5 border-l border-gray-300 text-center w-11">دخول</th>
                      <th className="p-0.5 border-l border-gray-300 text-center w-11">خروج</th>
                      <th className="p-0.5 border-l border-gray-300 text-center w-8">RH</th>
                      <th className="p-0.5 text-center w-8">OT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300">
                    {items.map((d: any) => {
                      const isWknd = d.isFriday;
                      const isAbs = d.status === 'Absent';
                      return (
                        <tr
                          key={d.date}
                          className={isWknd ? 'bg-sky-50' : isAbs ? 'bg-rose-50/60' : 'hover:bg-gray-50'}
                        >
                          <td className="p-0.5 border-l border-gray-300 font-mono text-center font-semibold">{d.date?.substring(5)}</td>
                          <td className="p-0.5 border-l border-gray-300 text-center">{d.dayName}</td>
                          <td className="p-0.5 border-l border-gray-300 text-center">
                            {d.status === 'Present' && <span className="text-emerald-700 font-bold">حاضر</span>}
                            {d.status === 'Absent' && <span className="text-rose-700 font-bold">غائب</span>}
                            {(d.status === 'Leave' || d.status === 'On Leave') && <span className="text-indigo-700 font-bold">إجازة</span>}
                            {d.status === 'Sick Leave' && <span className="text-indigo-700 font-bold">مرضي</span>}
                            {d.status === 'Permission' && <span className="text-indigo-700 font-bold">استئذان</span>}
                            {d.status === 'Exception' && <span className="text-amber-700 font-bold">استثناء</span>}
                            {d.status === 'Transferred' && <span className="text-gray-600 font-bold">منقول</span>}
                            {d.status === 'Weekend' && <span className="text-sky-700 font-bold">عطلة</span>}
                            {d.status === 'Holiday' && <span className="text-purple-700 font-bold">رسمية</span>}
                            {d.status === 'Future' && <span className="text-gray-400">-</span>}
                          </td>
                          <td className="p-0.5 border-l border-gray-300 font-mono text-emerald-800 text-center font-bold">
                            {d.checkIn || '-'}
                          </td>
                          <td className="p-0.5 border-l border-gray-300 font-mono text-blue-800 text-center font-bold">
                            {d.checkOut || '-'}
                          </td>
                          <td className="p-0.5 border-l border-gray-300 text-center font-semibold">
                            {d.regularHours > 0 ? d.regularHours : '-'}
                          </td>
                          <td className="p-0.5 text-center font-bold text-orange-700">
                            {d.overtimeHours > 0 ? `+${d.overtimeHours}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );

              return (
                <div className="grid grid-cols-2 gap-2">
                  <div>{renderTable(col1)}</div>
                  <div>{renderTable(col2)}</div>
                </div>
              );
            })()}

            {/* 5. Official Approvals & Signatures Box */}
            <div className="border border-gray-400 rounded p-2 bg-slate-50 mt-1">
              <div className="grid grid-cols-3 gap-4 text-center text-[9px]">
                <div>
                  <p className="font-bold text-gray-900 mb-4">توقيع الموظف (Employee Signature)</p>
                  <p className="text-gray-400">________________________</p>
                  <p className="text-[8px] text-gray-500 mt-1">التاريخ: ____ / ____ / ________</p>
                </div>
                <div>
                  <p className="font-bold text-gray-900 mb-4">مشرف الموقع / السكن (Site Supervisor)</p>
                  <p className="text-gray-400">________________________</p>
                  <p className="text-[8px] text-gray-500 mt-1">التاريخ: ____ / ____ / ________</p>
                </div>
                <div>
                  <p className="font-bold text-gray-900 mb-4">اعتماد الموارد البشرية (HR Approval)</p>
                  <p className="text-gray-400">________________________</p>
                  <p className="text-[8px] text-gray-500 mt-1">التاريخ: ____ / ____ / ________</p>
                </div>
              </div>
              <div className="text-[8px] text-center text-gray-500 border-t border-gray-300 pt-1 mt-2">
                هذا التقرير مستخرج آلياً من نظام إدارة السكنات والدوام الذكي - شركة مساكن العمالية للخدمات المسانده - معتمد برقم TS-{selectedBadge}-{filterMonth}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            يرجى اختيار الموظف لعرض التقرير القابل للطباعة
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmployeeReportPage() {
  return (
    <HousingEmployeesProvider>
      <TimesheetProvider>
        <Suspense fallback={<div className="p-12 text-center text-muted-foreground">Loading employee report...</div>}>
          <EmployeeReportInner />
        </Suspense>
      </TimesheetProvider>
    </HousingEmployeesProvider>
  );
}
