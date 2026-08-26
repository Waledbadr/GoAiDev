'use client';

import { useState, useEffect, useMemo } from 'react';
import { d1Client } from '@/lib/d1-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Plus,
  Search,
  UserCircle,
  Briefcase,
  Clock,
  FileText,
  RefreshCw,
  UserCheck,
  ArrowLeftRight,
  Users,
  Calendar,
  MapPin,
} from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { AddEmployeeDialog } from '@/components/timesheet/employees/add-employee-dialog';
import { EmployeeProfileSheet } from '@/components/timesheet/employees/employee-profile-sheet';
import { HousingEmployeesProvider, useHousingEmployees, HousingEmployee } from '@/context/housing-employees-context';

// Master list provided by housing admin for core employees
// Maps badge ID to Arabic/English names and professions
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
  '45914': { nameAr: '(بدون اسم)', name: '(No Name)', professionAr: 'فني تكييف', profession: 'AC Technician' },
  '48571': { nameAr: 'محمد توصيف', name: 'Mohammad Tauseef', professionAr: 'سائق', profession: 'Driver' },
  '36048': { nameAr: 'بارو ديبو', name: 'Baru Dibu', professionAr: 'حداد', profession: 'Steel Fixer' },
  '28824': { nameAr: 'ألطاف بسياتي', name: 'Altaf Basiyati', professionAr: 'تسكين عمالة', profession: 'Housing Coordinator' },
  '31524': { nameAr: 'شهزاد أحمد', name: 'Shahzad Ahmed', professionAr: 'فني صيانة', profession: 'Maintenance Technician' },
  '30556': { nameAr: 'أيوب خان', name: 'Ayub Khan', professionAr: 'كهربائي', profession: 'Electrician' },
  '50156': { nameAr: '(بدون اسم)', name: '(No Name)', professionAr: 'سباك', profession: 'Plumber' },
  '49499': { nameAr: '(بدون اسم)', name: '(No Name)', professionAr: 'عامل', profession: 'Laborer' },
  '48878': { nameAr: 'عابد محمد', name: 'Abid Mohammed', professionAr: 'بناء', profession: 'Mason' },
  '49646': { nameAr: 'كمران محمود', name: 'Kamran Mahmoud', professionAr: 'بناء', profession: 'Mason' },
  '50210': { nameAr: 'ألطاف رفيق', name: 'Altaf Rafik', professionAr: 'عامل', profession: 'Laborer' },
  '51153': { nameAr: 'عديل أحمد', name: 'Adeel Ahmed', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '51068': { nameAr: 'يوميد أكرم', name: 'Yumid Akram', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '30739': { nameAr: 'أكبر بسياتي', name: 'Akbar Basiyati', professionAr: 'عامل نظافة', profession: 'Cleaner' },
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
  '50082': { nameAr: '(بدون اسم)', name: '(No Name)', professionAr: 'فني تكييف', profession: 'AC Technician' },
  '50083': { nameAr: 'خورشيد علم', name: 'Khurshed Alam', professionAr: 'سباك', profession: 'Plumber' },
  '51255': { nameAr: 'شاه رفيق', name: 'Shah Rafiq', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '49490': { nameAr: 'رباني جميل', name: 'Rabbanee Jamil', professionAr: 'عامل', profession: 'Laborer' },
  '37475': { nameAr: 'محمد غافر', name: 'Mohammed Ghafir', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '30807': { nameAr: 'محمد دايار', name: 'Mohammed Dayar', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '51256': { nameAr: 'عابد خان', name: 'Abid Khan', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '29778': { nameAr: 'محمد الدين', name: 'Mohammed Aldin', professionAr: 'مشرف سكن', profession: 'Housing Supervisor' },
  '51096': { nameAr: '(بدون اسم)', name: '(No Name)', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '51098': { nameAr: '(بدون اسم)', name: '(No Name)', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '49481': { nameAr: 'محمد فرمان', name: 'Mohammad Farman', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '49484': { nameAr: 'شاهنواز إرشاد', name: 'Sahanwaj Irsad', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '48969': { nameAr: 'ظهير علي', name: 'Zaheer Ali', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '49485': { nameAr: 'محمد إسرائيل', name: 'Mohd Israil', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '27990': { nameAr: 'محمد عريف', name: 'Mohammed Arif', professionAr: 'مشرف سكن', profession: 'Housing Supervisor' },
  '40666': { nameAr: 'محمد أبوعاصي', name: 'Mohammed Abu Asi', professionAr: 'مسؤول سكن', profession: 'Camp Boss / Housing Officer' },
  '34207': { nameAr: 'محمد سيكا', name: 'Mohammed Sika', professionAr: 'عامل نظافة', profession: 'Cleaner' },
  '49237': { nameAr: 'أسلم علي', name: 'Aslam Ali', professionAr: 'عامل', profession: 'Laborer' },
  '50079': { nameAr: '(بدون اسم)', name: '(No Name)', professionAr: 'فني تكييف', profession: 'AC Technician' },
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

function TimesheetEmployeesContent() {
  const { dict, locale } = useLanguage();
  const isAr = locale === 'ar';
  const { employees, loading, updateEmployee } = useHousingEmployees();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<HousingEmployee | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [transfersList, setTransfersList] = useState<any[]>([]);

  // Fetch transfer records to enrich employee transfer info
  useEffect(() => {
    d1Client.getDocs<any>('timesheetTransfers').then((res) => {
      setTransfersList(res || []);
    }).catch(console.error);
  }, []);

  // Map latest transfer per employee
  const employeeTransfersMap = useMemo(() => {
    const map: Record<string, any> = {};
    (transfersList || []).forEach((t) => {
      const k = String(t.employeeId || t.badgeId || '').trim();
      if (k) {
        if (!map[k] || (t.date && t.date > (map[k].date || ''))) {
          map[k] = t;
        }
      }
    });
    return map;
  }, [transfersList]);

  // Filtered employees by search term
  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name?.toLowerCase().includes(term) ||
        emp.nameAr?.includes(term) ||
        String(emp.employeeId || emp.id || '').toLowerCase().includes(term) ||
        emp.profession?.toLowerCase().includes(term) ||
        emp.professionAr?.includes(term)
    );
  }, [employees, searchTerm]);

  // Split into Active (On-Duty / Regular) vs Transferred
  const { activeEmployees, transferredEmployees } = useMemo(() => {
    const active: HousingEmployee[] = [];
    const transferred: HousingEmployee[] = [];

    filteredEmployees.forEach((emp) => {
      const empId = String(emp.employeeId || emp.id).trim();
      const tr = employeeTransfersMap[empId];
      const isMarkedTransferred =
        emp.status === 'Transferred' ||
        emp.residenceStatus === 'Outside' ||
        (tr && (tr.type === 'Move Out' || tr.type === 'Exit' || String(tr.type || '').includes('خروج') || String(tr.type || '').includes('نقل')));

      if (isMarkedTransferred) {
        transferred.push(emp);
      } else {
        active.push(emp);
      }
    });

    return { activeEmployees: active, transferredEmployees: transferred };
  }, [filteredEmployees, employeeTransfersMap]);

  const handleSyncFromRecords = async () => {
    try {
      setSyncing(true);
      const records = await d1Client.getDocs<any>('attendanceRecords');
      const uniqueMap = new Map<string, any>();
      (records || []).forEach((data) => {
        if (data.employeeId && !uniqueMap.has(data.employeeId)) {
          uniqueMap.set(data.employeeId, {
            employeeId: data.employeeId,
            name: data.firstName || 'Unknown',
            nameAr: data.firstName || 'غير معروف',
            department: data.department || '',
            projectName: data.projectName || '',
            profession: data.department || 'Worker',
            professionAr: data.department || 'عامل',
            dailyHours: 8,
            monthlySalary: 0,
            status: 'Active',
          });
        }
      });

      let addedCount = 0;
      for (const [empId, empData] of uniqueMap.entries()) {
        const existing = employees.find((e) => e.employeeId === empId);
        if (!existing) {
          const docId = `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await d1Client.setDoc('housingEmployees', docId, {
            id: docId,
            ...empData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          addedCount++;
        }
      }

      toast({
        title: isAr ? 'اكتملت المزامنة' : 'Sync Complete',
        description: isAr
          ? `تم بنجاح استيراد ${addedCount} موظف جديد من سجلات البصمات.`
          : `Successfully imported ${addedCount} new employees from attendance records.`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: isAr ? 'فشلت المزامنة' : 'Sync failed', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleApplyMasterData = async () => {
    try {
      let updated = 0;
      for (const [badgeId, data] of Object.entries(EMPLOYEE_MASTER)) {
        const emp = employees.find((e) => e.employeeId === badgeId);
        if (!emp) continue;
        await updateEmployee(emp.id, {
          nameAr: data.nameAr,
          name: data.name,
          professionAr: data.professionAr,
          profession: data.profession,
        } as Partial<HousingEmployee>);
        updated++;
      }
      toast({
        title: isAr ? 'تم تطبيق البيانات الرئيسية' : 'Master data applied',
        description: isAr
          ? `تم تحديث ${updated} موظفاً من السجل المعتمد.`
          : `Updated ${updated} employees from provided list.`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: isAr ? 'فشل التحديث' : 'Update failed', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Top Header & Global Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            {isAr ? 'إدارة موظفي الدوام والسكن' : 'Employees Management'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr
              ? 'إدارة ملفات الموظفين، ساعات العمل، الرواتب، وتتبع سجلات النقل والتحويل'
              : 'Manage employee profiles, salaries, shifts, and track transferred workforce'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleSyncFromRecords} disabled={syncing} className="h-9 gap-1.5 text-xs font-medium">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {isAr ? 'مزامنة من البصمات' : 'Sync from Records'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleApplyMasterData} className="h-9 gap-1.5 text-xs font-medium">
            <FileText className="h-3.5 w-3.5 text-indigo-600" />
            {isAr ? 'تطبيق الأسماء المعتمدة' : 'Apply Master Names'}
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)} className="h-9 gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" />
            {isAr ? 'إضافة موظف' : 'Add Employee'}
          </Button>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={isAr ? 'البحث بالاسم، الرقم الوظيفي، أو المهنة...' : 'Search by name, ID, or profession...'}
          className="pl-9 bg-card border-border/80"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* CARD 1: Active / Current Employees Directory */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                {isAr ? 'دليل الموظفين على رأس العمل' : 'Active & Current Employees Directory'}
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 text-[11px] font-mono">
                  {activeEmployees.length} {isAr ? 'موظف' : 'employees'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                {isAr ? 'الموظفون الحاليون المسجلون على رأس العمل والإجازات' : 'Current active workforce and regular personnel'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[700px]">
            <thead className="bg-slate-100/70 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 font-semibold border-b">
              <tr>
                <th className="px-4 py-3">{isAr ? 'الموظف / الاسم' : 'Employee Name'}</th>
                <th className="px-4 py-3">{isAr ? 'المهنة' : 'Profession'}</th>
                <th className="px-4 py-3">{isAr ? 'ساعات الدوام (RH)' : 'Daily Hours'}</th>
                <th className="px-4 py-3">{isAr ? 'الراتب الأساسي' : 'Basic Salary'}</th>
                <th className="px-4 py-3">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3 text-right">{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {isAr ? 'جاري تحميل الموظفين...' : 'Loading employees...'}
                  </td>
                </tr>
              ) : activeEmployees.length > 0 ? (
                activeEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-gray-900 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserCircle className="h-8 w-8 text-blue-500/70 shrink-0" />
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{emp.nameAr}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {emp.name} (#{emp.employeeId || emp.id})
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{emp.professionAr || emp.profession || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 font-mono">
                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                        <span>{emp.dailyHours || 8} hrs</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                      {(emp.monthlySalary || 0).toLocaleString()} SR
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          emp.status === 'Active'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : emp.status === 'On Leave'
                            ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {emp.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" asChild className="h-7 text-xs font-medium text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950">
                          <Link href={`/timesheet/employee-report?badgeId=${emp.employeeId || emp.id}`}>
                            <UserCheck className="w-3.5 h-3.5 mr-1" />
                            {isAr ? 'تقرير الدوام' : 'Timesheet'}
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedEmployee(emp)}>
                          {isAr ? 'تعديل' : 'Edit'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {isAr ? 'لا يوجد موظفون مطابقون لبحثك.' : 'No matching active employees found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* CARD 2: Transferred Employees Directory (سجل الموظفين المنقولين) */}
      <Card className="border border-amber-200/80 dark:border-amber-900/60 shadow-sm overflow-hidden bg-amber-50/20 dark:bg-amber-950/10">
        <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-amber-200/60 dark:border-amber-900/50 bg-amber-100/40 dark:bg-amber-950/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-950 dark:text-amber-200">
                {isAr ? 'سجل الموظفين المنقولين (المتحولين)' : 'Transferred Employees Directory'}
                <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-400 dark:border-amber-700 text-[11px] font-mono">
                  {transferredEmployees.length} {isAr ? 'منقول' : 'transferred'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-amber-800/80 dark:text-amber-300/70">
                {isAr ? 'الموظفون الذين تم نقلهم أو تغيير موقع سكنهم/مشروعهم' : 'Employees transferred out or relocated to other sites/outside camps'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[700px]">
            <thead className="bg-amber-100/50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold border-b border-amber-200/50">
              <tr>
                <th className="px-4 py-3">{isAr ? 'الموظف / الاسم' : 'Employee Name'}</th>
                <th className="px-4 py-3">{isAr ? 'المهنة' : 'Profession'}</th>
                <th className="px-4 py-3">{isAr ? 'تاريخ التحويل / الملاحظات' : 'Transfer Date / Details'}</th>
                <th className="px-4 py-3">{isAr ? 'موقع التحويل / السكن' : 'Destination / Residence'}</th>
                <th className="px-4 py-3">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3 text-right">{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/40 dark:divide-amber-900/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {isAr ? 'جاري التحميل...' : 'Loading...'}
                  </td>
                </tr>
              ) : transferredEmployees.length > 0 ? (
                transferredEmployees.map((emp) => {
                  const empId = String(emp.employeeId || emp.id).trim();
                  const tr = employeeTransfersMap[empId];
                  return (
                    <tr key={emp.id} className="hover:bg-amber-100/40 dark:hover:bg-amber-950/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserCircle className="h-8 w-8 text-amber-600/70 shrink-0" />
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{emp.nameAr}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {emp.name} (#{emp.employeeId || emp.id})
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{emp.professionAr || emp.profession || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                        {tr?.date ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-amber-600" />
                            <span>{tr.date}</span>
                            {tr.reason && <span className="text-[10px] text-muted-foreground">({tr.reason})</span>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-600" />
                          <span>{tr?.location || emp.residenceLocation || emp.residenceStatus || 'خارج السكن'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-amber-500 text-white font-medium text-[11px]">
                          {isAr ? 'منقول / تحويل' : 'Transferred'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" asChild className="h-7 text-xs font-medium text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100/60 dark:hover:bg-amber-950/60">
                            <Link href={`/timesheet/employee-report?badgeId=${emp.employeeId || emp.id}`}>
                              <UserCheck className="w-3.5 h-3.5 mr-1" />
                              {isAr ? 'تقرير الدوام' : 'Timesheet'}
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedEmployee(emp)}>
                            {isAr ? 'تعديل' : 'Edit'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {isAr ? 'لا يوجد موظفون منقولون حالياً.' : 'No transferred employees found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <AddEmployeeDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <EmployeeProfileSheet
        open={!!selectedEmployee}
        onOpenChange={(open) => !open && setSelectedEmployee(null)}
        employee={selectedEmployee}
      />
    </div>
  );
}

export default function TimesheetEmployeesPage() {
  return (
    <HousingEmployeesProvider>
      <TimesheetEmployeesContent />
    </HousingEmployeesProvider>
  );
}
