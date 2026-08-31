"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAccommodation } from '@/context/accommodation-context';
import { useUsers } from '@/context/users-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileText,
  Calendar,
  Building2,
  Users,
  Printer,
  Download,
  Search,
  Filter,
  ArrowRight,
  RefreshCw,
  Clock,
  DollarSign,
  Briefcase,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Building,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  SlidersHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  LegacyBillingRow,
  DEFAULT_BILLING_REPORT_URL,
  AVAILABLE_YEARS,
  getMonthsForYear,
} from '@/lib/accommodation-billing-sync';
import { HistorySyncDialog } from '@/components/accommodation/history-sync-dialog';

export default function MonthlyBillingReportPage() {
  const { residences, contracts } = useAccommodation();
  const { currentUser } = useUsers();
  const { toast } = useToast();

  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonthId, setSelectedMonthId] = useState<string>('2026-08');
  const [showCustomDates, setShowCustomDates] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>('2026-07-21');
  const [endDate, setEndDate] = useState<string>('2026-08-20');
  const [dataSource, setDataSource] = useState<'database' | 'legacy'>('database');
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [rows, setRows] = useState<LegacyBillingRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [activeSourceLabel, setActiveSourceLabel] = useState<string>('cloudflare_d1_database');

  // Months of current selected year
  const currentYearMonths = useMemo(() => getMonthsForYear(selectedYear), [selectedYear]);

  // Filters
  const [selectedResidence, setSelectedResidence] = useState<string>('ALL');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [stayFilter, setStayFilter] = useState<'ALL' | 'FULL' | 'PARTIAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dailyRate, setDailyRate] = useState<number>(20); // Default standard accommodation daily rate in SAR

  const fetchBillingData = async (
    start: string = startDate,
    end: string = endDate,
    src: 'database' | 'legacy' = dataSource
  ) => {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/accommodation/billing-history?startDate=${start}&endDate=${end}&source=${src}`);
      const json = await res.json();
      if (json.ok) {
        setRows(json.rows || []);
        setSummary(json.summary || null);
        setActiveSourceLabel(json.source || src);
      } else {
        toast({
          title: '❌ خطأ أثناء جلب بيانات الفوترة',
          description: json.error || 'تعذر جلب البيانات',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '❌ فشل الاتصال',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleSelectYear = (year: number) => {
    setSelectedYear(year);
    const months = getMonthsForYear(year);
    const latestMonth = months[months.length - 1];
    setSelectedMonthId(latestMonth.id);
    setStartDate(latestMonth.startDate);
    setEndDate(latestMonth.endDate);
    fetchBillingData(latestMonth.startDate, latestMonth.endDate, dataSource);
  };

  const handleSelectMonth = (monthId: string) => {
    const found = currentYearMonths.find((m) => m.id === monthId);
    if (found) {
      setSelectedMonthId(found.id);
      setStartDate(found.startDate);
      setEndDate(found.endDate);
      fetchBillingData(found.startDate, found.endDate, dataSource);
    }
  };

  const handlePrevMonth = () => {
    const currentIndex = currentYearMonths.findIndex((m) => m.id === selectedMonthId);
    if (currentIndex > 0) {
      const prevMonth = currentYearMonths[currentIndex - 1];
      handleSelectMonth(prevMonth.id);
    }
  };

  const handleNextMonth = () => {
    const currentIndex = currentYearMonths.findIndex((m) => m.id === selectedMonthId);
    if (currentIndex < currentYearMonths.length - 1) {
      const nextMonth = currentYearMonths[currentIndex + 1];
      handleSelectMonth(nextMonth.id);
    }
  };

  useEffect(() => {
    fetchBillingData(startDate, endDate, dataSource);
  }, []);

  // Distinct company/sponsor options
  const companiesList = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.sponsor) set.add(r.sponsor);
    }
    return Array.from(set).sort();
  }, [rows]);

  // Distinct residence options
  const residencesList = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const name = r.targetResidenceName || r.houseName;
      if (name) set.add(name);
    }
    return Array.from(set).sort();
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return rows.filter((r) => {
      // Residence Filter
      const resName = r.targetResidenceName || r.houseName;
      if (selectedResidence !== 'ALL' && resName !== selectedResidence) return false;

      // Company Filter
      if (selectedCompany !== 'ALL' && r.sponsor !== selectedCompany) return false;

      // Stay Filter
      if (stayFilter === 'FULL' && r.days < 30) return false;
      if (stayFilter === 'PARTIAL' && r.days >= 30) return false;

      // Search Query
      if (query) {
        const matchEmp = (r.employeeId || '').toLowerCase().includes(query);
        const matchName = (r.employeeName || '').toLowerCase().includes(query);
        const matchRoom = (r.room || '').toLowerCase().includes(query);
        const matchBldg = (r.building || '').toLowerCase().includes(query);
        const matchNat = (r.nationality || '').toLowerCase().includes(query);
        const matchProf = (r.profession || '').toLowerCase().includes(query);
        if (!matchEmp && !matchName && !matchRoom && !matchBldg && !matchNat && !matchProf) return false;
      }

      return true;
    });
  }, [rows, selectedResidence, selectedCompany, stayFilter, searchQuery]);

  // Metrics for filtered dataset
  const metrics = useMemo(() => {
    let totalWorkers = filteredRows.length;
    let totalDays = 0;
    let fullMonthCount = 0;
    let partialCount = 0;

    for (const r of filteredRows) {
      totalDays += r.days;
      if (r.days >= 30) fullMonthCount++;
      else partialCount++;
    }

    const totalAmount = totalDays * dailyRate;

    return {
      totalWorkers,
      totalDays,
      fullMonthCount,
      partialCount,
      totalAmount,
    };
  }, [filteredRows, dailyRate]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (filteredRows.length === 0) return;

    const headers = [
      'م',
      'الرقم الوظيفي',
      'اسم العامل',
      'السكن',
      'المبنى',
      'الغرفة',
      'الشركة / الكفيل',
      'المهنة',
      'القسم',
      'تاريخ الدخول',
      'تاريخ الخروج',
      'عدد الأيام',
      'سعر اليوم (SAR)',
      'إجمالي المبلغ (SAR)',
      'الملاحظات',
    ];

    const exportRows = filteredRows.map((r, idx) => [
      String(idx + 1),
      r.employeeId,
      r.employeeName,
      r.targetResidenceName || r.houseName,
      r.building,
      r.room,
      r.sponsor,
      r.profession,
      r.department,
      r.dateIn,
      r.dateOut,
      String(r.days),
      String(dailyRate),
      String((r.days * dailyRate).toFixed(2)),
      r.remarks,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...exportRows.map((row) => row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `فاتورة_إشغال_العمالة_${startDate}_إلى_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto print:p-0 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-4 print:border-none">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/accommodation/reports"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 print:hidden"
            >
              <ArrowRight className="h-3 w-3" /> العودة للتقارير
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <CreditCard className="h-7 w-7 text-indigo-600 dark:text-indigo-400 print:hidden" />
              تقرير فاتورة إشغال العمالة الشهرية (In/Out Billing)
            </h1>
            <Badge
              variant="outline"
              className={`text-[11px] font-mono gap-1 py-0.5 print:hidden ${
                activeSourceLabel.includes('d1')
                  ? 'border-emerald-500/40 bg-emerald-50/40 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-blue-500/40 bg-blue-50/40 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
              }`}
            >
              {activeSourceLabel.includes('d1') ? '⚡ قاعدة بيانات D1 (محلي فوري)' : '🌐 مزامنة حية من المصدر الخارجي'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            احتساب عدد الأيام الفعلية التي قضاها كل عامل في السكن خلال الفترة المالية لإصدار ومطابقة الفواتير.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 print:hidden">
          <HistorySyncDialog />
          <Button variant="outline" size="sm" onClick={() => fetchBillingData(startDate, endDate)} disabled={loadingData} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
            <Download className="h-4 w-4" /> تصدير Excel (CSV)
          </Button>
          <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Printer className="h-4 w-4" /> طباعة الفاتورة
          </Button>
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="hidden print:block border-b-2 border-black pb-4 text-center">
        <h2 className="text-2xl font-bold">SACODECO | شركة مواد الإعمار السعودية</h2>
        <h3 className="text-lg font-semibold mt-1">
          فاتورة وكشف إشغال العمالة بالسكنات للفترة من: {startDate} إلى: {endDate}
        </h3>
        <div className="flex justify-between items-center text-xs mt-2 text-gray-600">
          <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</span>
          <span>إجمالي العمال: {metrics.totalWorkers.toLocaleString()} | إجمالي الأيام: {metrics.totalDays.toLocaleString()}</span>
        </div>
      </div>

      {/* Month Selection Buttons Ribbon */}
      <Card className="border border-border/80 shadow-sm print:hidden bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-4 space-y-4">
          {/* Header Row: Title, Year Selector & Prev/Next Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-bold">السنة المالية:</span>
              </div>

              {/* Year Dropdown */}
              <Select
                value={String(selectedYear)}
                onValueChange={(val) => handleSelectYear(Number(val))}
              >
                <SelectTrigger className="h-8 w-28 text-xs font-bold font-mono border-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)} className="font-mono text-xs">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs text-indigo-700 dark:text-indigo-300">
                    {currentYearMonths.find((m) => m.id === selectedMonthId)?.name || 'فترة مخصصة'}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  الفترة المالية المحددة: <span className="font-mono font-semibold">{startDate}</span> إلى{' '}
                  <span className="font-mono font-semibold">{endDate}</span>
                </div>
              </div>
            </div>

            {/* Quick Prev / Next & Custom Date Toggles */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevMonth}
                disabled={selectedMonthId === currentYearMonths[0]?.id}
                className="h-8 gap-1 text-xs"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                الشهر السابق
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
                disabled={selectedMonthId === currentYearMonths[currentYearMonths.length - 1]?.id}
                className="h-8 gap-1 text-xs"
              >
                الشهر التالي
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={showCustomDates ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowCustomDates((prev) => !prev)}
                className="h-8 gap-1 text-xs text-muted-foreground"
                title="تحديد تواريخ مخصصة يدوياً"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                تخصيص التواريخ
              </Button>
            </div>
          </div>

          {/* Month Buttons Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2">
            {currentYearMonths.map((m) => {
              const isActive = selectedMonthId === m.id && !showCustomDates;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMonth(m.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 font-bold scale-[1.02]'
                      : 'bg-muted/30 hover:bg-muted/70 border-border text-foreground'
                  }`}
                >
                  <span className="text-xs font-semibold">{m.name.split(' ')[0]}</span>
                  <span className={`text-[10px] font-mono mt-0.5 ${isActive ? 'text-indigo-100' : 'text-muted-foreground'}`}>
                    شهر {m.month}
                  </span>
                  <span
                    className={`text-[9px] font-mono mt-1 px-1 py-0.5 rounded ${
                      isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-background/80 text-muted-foreground'
                    }`}
                  >
                    {m.startDate.slice(5)} ⬅️ {m.endDate.slice(5)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Collapsible Custom Dates Form */}
          {showCustomDates && (
            <div className="p-3 bg-muted/20 border border-dashed border-border rounded-lg flex flex-wrap items-center gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold text-muted-foreground shrink-0">من:</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs font-mono w-36"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold text-muted-foreground shrink-0">إلى:</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs font-mono w-36"
                />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedMonthId('');
                  fetchBillingData(startDate, endDate, dataSource);
                }}
                className="h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                تطبيق الفترة المخصصة
              </Button>
            </div>
          )}

          {/* Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50">
            {/* Residence Filter */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">تصفية بالسكن</Label>
              <Select value={selectedResidence} onValueChange={setSelectedResidence}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="كل السكنات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">كل السكنات ({residencesList.length})</SelectItem>
                  {residencesList.map((res) => (
                    <SelectItem key={res} value={res}>
                      {res}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Company / Sponsor Filter */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">تصفية بالشركة / الكفيل</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="كل الشركات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">كل الشركات ({companiesList.length})</SelectItem>
                  {companiesList.map((comp) => (
                    <SelectItem key={comp} value={comp}>
                      {comp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stay Duration Filter */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">نوع الإشغال</Label>
              <Select value={stayFilter} onValueChange={(val: any) => setStayFilter(val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">جميع الحركات</SelectItem>
                  <SelectItem value="FULL">إشغال شهر كامل (30-31 يوم)</SelectItem>
                  <SelectItem value="PARTIAL">إشغال جزئي / خروج / دخول</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search, Source & Rate Settings */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/50">
            <div className="flex-1 max-w-md relative">
              <Search className="h-3.5 w-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث سريع: الرقم الوظيفي، اسم العامل، الغرفة، المهنة..."
                className="h-8 pr-8 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Data Source Selector */}
              <div className="flex items-center gap-1.5">
                <Label className="font-semibold text-muted-foreground shrink-0">مصدر البيانات:</Label>
                <Select
                  value={dataSource}
                  onValueChange={(val: 'database' | 'legacy') => {
                    setDataSource(val);
                    fetchBillingData(startDate, endDate, val);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="database">⚡ قاعدة بيانات D1 (فوري)</SelectItem>
                    <SelectItem value="legacy">🌐 المصدر الخارجي (مباشر)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Daily Rate Input */}
              <div className="flex items-center gap-1">
                <Label className="font-semibold text-muted-foreground shrink-0">سعر اليوم:</Label>
                <Input
                  type="number"
                  value={dailyRate}
                  onChange={(e) => setDailyRate(Number(e.target.value) || 0)}
                  className="h-8 w-16 text-xs font-mono text-center"
                />
                <span className="font-bold text-muted-foreground">ر.س</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="p-3 border border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
            <Users className="h-4 w-4" /> إجمالي العمال المفوترين
          </div>
          <div className="text-2xl font-bold mt-1 text-indigo-900 dark:text-indigo-100">
            {metrics.totalWorkers.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">سجل حركة إشغال</div>
        </Card>

        <Card className="p-3 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <Clock className="h-4 w-4 text-emerald-600" /> إجمالي الأيام المحسوبة
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {metrics.totalDays.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">يوم إشغال في السكنات</div>
        </Card>

        <Card className="p-3 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4 text-blue-600" /> إشغال شهر كامل
          </div>
          <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
            {metrics.fullMonthCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">عامل (31 يوماً كاملة)</div>
        </Card>

        <Card className="p-3 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <TrendingUp className="h-4 w-4 text-amber-600" /> إشغال جزئي / تنقلات
          </div>
          <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {metrics.partialCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">حالة دخول/خروج/نقل</div>
        </Card>

        <Card className="p-3 border border-border sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <DollarSign className="h-4 w-4 text-purple-600" /> إجمالي الفاتورة المقدرة
          </div>
          <div className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
            {metrics.totalAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} <span className="text-xs font-normal">ر.س</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">بحساب {dailyRate} ر.س/يوم</div>
        </Card>
      </div>

      {/* Main Billing Table */}
      <Card className="border border-border shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/60 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              كشف تفاصيل الأيام والفاتورة لكل عامل
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              عرض {filteredRows.length.toLocaleString()} سجل من إجمالي {rows.length.toLocaleString()} حركة
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loadingData ? (
            <div className="p-12 text-center text-muted-foreground space-y-3">
              <RefreshCw className="h-8 w-8 mx-auto animate-spin text-indigo-600" />
              <div className="text-sm font-semibold">جارِ تحميل وحساب بيانات الفاتورة...</div>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <Building className="h-10 w-10 mx-auto opacity-30" />
              <div className="text-base font-semibold">لا توجد سجلات مطابقة للخيارات المحددة</div>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <Table className="text-xs">
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-12 text-center font-bold">#</TableHead>
                    <TableHead className="w-24 font-bold">الرقم الوظيفي</TableHead>
                    <TableHead className="min-w-[180px] font-bold">اسم العامل</TableHead>
                    <TableHead className="font-bold">السكن</TableHead>
                    <TableHead className="w-16 text-center">المبنى</TableHead>
                    <TableHead className="w-16 text-center">الغرفة</TableHead>
                    <TableHead className="min-w-[140px]">الشركة / الكفيل</TableHead>
                    <TableHead>المهنة</TableHead>
                    <TableHead className="w-24 text-center">تاريخ الدخول</TableHead>
                    <TableHead className="w-24 text-center">تاريخ الخروج</TableHead>
                    <TableHead className="w-20 text-center font-bold text-emerald-700 dark:text-emerald-400">الأيام</TableHead>
                    <TableHead className="w-28 text-center font-bold text-indigo-700 dark:text-indigo-400">المبلغ (SAR)</TableHead>
                    <TableHead className="min-w-[130px]">الملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, idx) => {
                    const rowAmount = row.days * dailyRate;
                    const isFullMonth = row.days >= 30;

                    return (
                      <TableRow key={`${row.employeeId}_${row.houseName}_${idx}`} className="hover:bg-muted/30">
                        <TableCell className="text-center font-mono text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                          {row.employeeId}
                        </TableCell>
                        <TableCell className="font-medium">{row.employeeName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {row.targetResidenceName || row.houseName}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono">{row.building}</TableCell>
                        <TableCell className="text-center font-mono font-semibold">{row.room}</TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[140px]" title={row.sponsor}>
                          {row.sponsor || 'SACODECO'}
                        </TableCell>
                        <TableCell>{row.profession || '-'}</TableCell>
                        <TableCell className="text-center font-mono text-[11px]">{row.dateIn || '-'}</TableCell>
                        <TableCell className="text-center font-mono text-[11px] text-amber-600">
                          {row.dateOut || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                              isFullMonth
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}
                          >
                            {row.days}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {rowAmount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-[11px] truncate max-w-[140px]" title={row.remarks}>
                          {row.remarks || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Official Sign-Off Box (Print-only) */}
      <div className="hidden print:block border-2 border-gray-800 rounded-lg p-4 mt-8 break-inside-avoid">
        <h4 className="font-bold text-sm border-b border-gray-400 pb-1 mb-3">
          إقرار واعتماد فاتورة وكشف الأيام المحسوبة:
        </h4>
        <div className="grid grid-cols-3 gap-6 text-xs font-semibold pt-4">
          <div>
            إعداد مشرف السكن: ____________________
            <div className="mt-2 text-gray-500 font-normal">التوقيع: __________________</div>
          </div>
          <div>
            مراجعة إدارة العقود والتسكين: _____________
            <div className="mt-2 text-gray-500 font-normal">التوقيع: __________________</div>
          </div>
          <div>
            اعتماد الإدارة المالية: ____________________
            <div className="mt-2 text-gray-500 font-normal">الختم / التاريخ: _____ / _____ / 2026 م</div>
          </div>
        </div>
      </div>
    </div>
  );
}
