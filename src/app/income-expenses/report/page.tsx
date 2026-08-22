'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FinancialsProvider, useFinancials } from '@/context/financials-context';
import { useResidences } from '@/context/residences-context';
import { useLanguage } from '@/context/language-context';
import {
  INCOME_CATEGORIES,
  EXPENSE_GROUPS,
  IncomeKey,
  ExpenseCategoryKey,
  MonthlyFinancial,
  calcTotalIncome,
  calcTotalExpenses,
  formatSAR,
} from '@/types/financials';
import { getFiscalMonthForDate, getFiscalMonthPeriod } from '@/lib/fiscal-month-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Building2,
  Printer,
  FileDown,
  Loader2,
  TrendingDown,
  TrendingUp,
  DollarSign,
  FileBarChart,
  PieChart,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const PRINT_COLOR_STYLE: React.CSSProperties = {
  WebkitPrintColorAdjust: 'exact',
  printColorAdjust: 'exact',
} as React.CSSProperties;

function generateMonthList(): string[] {
  const start = '2026-03';
  const today = new Date();
  const end = getFiscalMonthForDate(today);
  const months: string[] = [];
  let cur = end;
  let itr = 0;
  while (cur >= start && itr < 120) {
    months.push(cur);
    const [y, m] = cur.split('-').map(Number);
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    cur = `${py}-${String(pm).padStart(2, '0')}`;
    itr++;
  }
  return months;
}

function IncomeExpensesReportContent() {
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const { residences } = useResidences();
  const { financials, loading, fetchByMonth, getOrCreate } = useFinancials();

  const months = useMemo(() => generateMonthList(), []);
  const [fiscalMonth, setFiscalMonth] = useState(months[0] ?? '');
  const [residenceId, setResidenceId] = useState('');

  const activeResidences = useMemo(
    () =>
      residences
        .filter((r) => !r.disabled)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [residences],
  );

  useEffect(() => {
    if (activeResidences.length > 0 && !residenceId) {
      setResidenceId(activeResidences[0].id);
    }
  }, [activeResidences, residenceId]);

  useEffect(() => {
    if (fiscalMonth) fetchByMonth(fiscalMonth);
  }, [fiscalMonth, fetchByMonth]);

  const currentResidence = activeResidences.find((r) => r.id === residenceId);
  const [draft, setDraft] = useState<MonthlyFinancial | null>(null);

  useEffect(() => {
    if (!residenceId || !fiscalMonth || !currentResidence) return;
    setDraft(getOrCreate(residenceId, currentResidence.name, fiscalMonth));
  }, [residenceId, fiscalMonth, financials, currentResidence, getOrCreate]);

  const totalIncome = draft ? calcTotalIncome(draft.income) : 0;
  const totalExpenses = draft ? calcTotalExpenses(draft.expenses) : 0;
  const netIncome = totalIncome - totalExpenses;

  const populatedIncomeCount = useMemo(() => {
    if (!draft) return 0;
    return Object.values(draft.income).filter((v) => (v || 0) > 0).length;
  }, [draft]);

  const populatedExpenseCount = useMemo(() => {
    if (!draft) return 0;
    return Object.values(draft.expenses).filter((v) => (v || 0) > 0).length;
  }, [draft]);

  const groupSubtotals = useMemo(() => {
    if (!draft) return {} as Record<string, number>;
    const res: Record<string, number> = {};
    EXPENSE_GROUPS.forEach((group) => {
      let sum = 0;
      group.categories.forEach((cat) => {
        sum += draft.expenses[cat.key as ExpenseCategoryKey] || 0;
      });
      res[group.key] = sum;
    });
    return res;
  }, [draft]);

  // ─── Print-report derived data ──────────────────────────────────────────
  const fiscalPeriod = useMemo(() => getFiscalMonthPeriod(fiscalMonth), [fiscalMonth]);

  const expenseGroupBreakdown = useMemo(
    () =>
      EXPENSE_GROUPS.map((group) => {
        const subtotal = groupSubtotals[group.key] || 0;
        return {
          key: group.key,
          labelAr: group.labelAr,
          labelEn: group.labelEn,
          subtotal,
          pct: totalExpenses > 0 ? Math.round((subtotal / totalExpenses) * 100) : 0,
          count: group.categories.length,
        };
      }),
    [groupSubtotals, totalExpenses],
  );

  // Amounts stored under keys that are not part of the current catalogue, so the
  // printed line items always reconcile with the stated totals.
  const unlistedIncome = useMemo(() => {
    if (!draft) return 0;
    const listed = INCOME_CATEGORIES.reduce((s, cat) => s + (draft.income[cat.key as IncomeKey] || 0), 0);
    return Math.max(0, totalIncome - listed);
  }, [draft, totalIncome]);

  const unlistedExpenses = useMemo(() => {
    const listed = Object.values(groupSubtotals).reduce((s, v) => s + (v || 0), 0);
    return Math.max(0, totalExpenses - listed);
  }, [groupSubtotals, totalExpenses]);

  const topExpenseItems = useMemo(() => {
    if (!draft) return [];
    const rows: { labelAr: string; labelEn: string; groupAr: string; groupEn: string; value: number }[] = [];
    EXPENSE_GROUPS.forEach((group) => {
      group.categories.forEach((cat) => {
        const value = draft.expenses[cat.key as ExpenseCategoryKey] || 0;
        if (value > 0) {
          rows.push({
            labelAr: cat.labelAr,
            labelEn: cat.labelEn,
            groupAr: group.labelAr,
            groupEn: group.labelEn,
            value,
          });
        }
      });
    });
    return rows.sort((a, b) => b.value - a.value).slice(0, 5);
  }, [draft]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    maintenance: true,
    assets: true,
    services: true,
    other: true,
  });

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const printPage = () => {
    window.print();
  };

  const downloadPdf = async () => {
    // Export the very same A4 template that the browser prints, so PDF == printout.
    const reportEl = document.getElementById('print-report-a4');
    if (!reportEl) return;
    setIsExportingPdf(true);

    const prevClassName = reportEl.className;
    const prevStyle = reportEl.getAttribute('style');

    try {
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;

      // Temporarily reveal the print template behind the page so html2canvas can measure it.
      reportEl.className = prevClassName.replace('hidden', 'block');
      reportEl.setAttribute(
        'style',
        'position:absolute;top:0;right:0;left:auto;z-index:-1;width:794px;background:#ffffff;padding:14px;',
      );
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

      const canvas = await html2canvas(reportEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 5;
      const imgWidth = pdfWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight - margin * 2;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight - margin * 2;
      }

      const resName = currentResidence?.name ? currentResidence.name.replace(/\s+/g, '_') : residenceId;
      pdf.save(`Income_Expenses_Report_${fiscalMonth}_${resName}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      window.print();
    } finally {
      reportEl.className = prevClassName;
      if (prevStyle === null) reportEl.removeAttribute('style');
      else reportEl.setAttribute('style', prevStyle);
      setIsExportingPdf(false);
    }
  };

  if (!fiscalMonth || !residenceId) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const monthLabel = new Date(fiscalMonth + '-01').toLocaleString(isAr ? 'ar-SA' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6 print:p-0 print:max-w-none print:space-y-4">
      {/* ─── Hero Header ─────────────────────────────────────────── */}
      <div
        className="print:hidden relative overflow-hidden rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50 via-white to-indigo-50 dark:from-emerald-950/20 dark:via-background dark:to-indigo-950/20 p-6"
      >
        <div className="absolute -left-10 -top-10 w-48 h-48 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <FileBarChart className="w-7 h-7 text-white" />
            </div>
            <div className="space-y-1.5">
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs px-2.5 py-0.5 font-medium"
              >
                <PieChart className="w-3.5 h-3.5 ml-1.5" />
                {isAr ? 'التقرير المالي الشهري' : 'Monthly Financial Report'}
              </Badge>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {isAr ? 'تقرير الدخل والمصروفات الشهري' : 'Monthly Income & Expenses Report'}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
                {isAr
                  ? 'تفصيل الدخل والمصروفات لكل سكن للشهر المختار، جاهز للطباعة أو التصدير كملف PDF.'
                  : 'Detailed breakdown of income and expenses per residence for the selected month, ready to print or export as PDF.'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <Button
              onClick={printPage}
              variant="outline"
              className="gap-2 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            >
              <Printer className="w-4 h-4" />
              {isAr ? 'طباعة A4' : 'Print A4'}
            </Button>
            <Button
              onClick={downloadPdf}
              disabled={isExportingPdf}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              {isAr ? 'حفظ PDF' : 'Save PDF'}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── On-screen Report Content (replaced by the A4 template when printing) ───────────── */}
      <div id="report-main-content" className="space-y-6 print:hidden">
        {/* ─── Filters ─────────────────────────────────────────── */}
        <Card className="print:hidden border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
                  {isAr ? 'الشهر المالي' : 'Fiscal Month'}
                </label>
                <Select value={fiscalMonth} onValueChange={setFiscalMonth}>
                  <SelectTrigger className="w-48 h-10 font-semibold bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>
                        {new Date(m + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                  {isAr ? 'السكن' : 'Residence'}
                </label>
                <Select value={residenceId} onValueChange={setResidenceId}>
                  <SelectTrigger className="w-64 h-10 font-semibold bg-background">
                    <SelectValue placeholder={isAr ? 'اختر السكن' : 'Select residence'} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeResidences.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        🏢 {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Badge variant="outline" className="h-10 px-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground ml-auto">
                {isAr ? 'إجمالي البنود المدخلة:' : 'Populated items:'}{' '}
                <span className="font-bold text-foreground">{populatedIncomeCount + populatedExpenseCount}</span>
              </Badge>
            </div>
          </CardContent>
        </Card>

        {loading || !draft ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        ) : (
          <>
            {/* ─── KPI Summary Cards ─────────────────────────────── */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <Card className="border-emerald-200/80 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/60 via-background to-background dark:from-emerald-950/20 shadow-sm relative overflow-hidden print:shadow-none break-inside-avoid">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 print:hidden" style={PRINT_COLOR_STYLE} />
                <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    {isAr ? 'إجمالي الدخل' : 'Total Income'}
                  </CardTitle>
                  <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 text-[11px] print:hidden">
                    {populatedIncomeCount} {isAr ? 'بنود' : 'items'}
                  </Badge>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-2">
                  <div className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-700 dark:text-emerald-400">
                    {formatSAR(totalIncome)} <span className="text-xs sm:text-sm font-normal">SAR</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                    {isAr ? 'مجموع إيرادات الشهر المحدد' : 'Sum of revenues for this period'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-rose-200/80 dark:border-rose-900/50 bg-gradient-to-br from-rose-50/60 via-background to-background dark:from-rose-950/20 shadow-sm relative overflow-hidden print:shadow-none break-inside-avoid">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 print:hidden" style={PRINT_COLOR_STYLE} />
                <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                    {isAr ? 'إجمالي المصروفات' : 'Total Expenses'}
                  </CardTitle>
                  <Badge variant="outline" className="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-300 text-[11px] print:hidden">
                    {populatedExpenseCount} {isAr ? 'بنود' : 'items'}
                  </Badge>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-2">
                  <div className="text-2xl sm:text-3xl font-black tracking-tight text-rose-700 dark:text-rose-400">
                    {formatSAR(totalExpenses)} <span className="text-xs sm:text-sm font-normal">SAR</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                    {isAr ? 'تكاليف السكن التشغيلية والأصول' : 'Operational & capital expenditure'}
                  </p>
                </CardContent>
              </Card>

              <Card
                className={`border-2 shadow-sm relative overflow-hidden print:shadow-none break-inside-avoid ${
                  netIncome >= 0
                    ? 'border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/60 via-background to-background dark:from-indigo-950/20'
                    : 'border-amber-300 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/60 via-background to-background dark:from-amber-950/20'
                }`}
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 print:hidden ${netIncome >= 0 ? 'bg-indigo-600' : 'bg-amber-500'}`}
                  style={PRINT_COLOR_STYLE}
                />
                <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
                  <CardTitle
                    className={`text-xs font-bold flex items-center gap-1.5 ${
                      netIncome >= 0 ? 'text-indigo-800 dark:text-indigo-300' : 'text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    {isAr ? 'صافي الدخل' : 'Net Income'}
                  </CardTitle>
                  <Badge className={`text-[10px] print:hidden ${netIncome >= 0 ? 'bg-indigo-600 text-white' : 'bg-amber-600 text-white'}`}>
                    {totalIncome > 0 ? Math.round((netIncome / totalIncome) * 100) : 0}%{' '}
                    {isAr ? 'هامش' : 'margin'}
                  </Badge>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-2">
                  <div
                    className={`text-2xl sm:text-3xl font-black tracking-tight ${
                      netIncome >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {formatSAR(Math.abs(netIncome))}{' '}
                    <span className="text-xs sm:text-sm font-normal">
                      SAR {netIncome < 0 ? (isAr ? '(خسارة)' : '(Loss)') : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 font-semibold">
                    {netIncome >= 0
                      ? (isAr ? 'ربح صافي محقق' : 'Net surplus profit')
                      : (isAr ? 'عجز / مصروف زائد عن الدخل' : 'Deficit / net loss')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ─── Income & Expenses Tables ───────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
              <Card className="print:shadow-none print:border break-inside-avoid overflow-hidden border-emerald-200/90 dark:border-emerald-900/60 shadow-md">
                <CardHeader
                  className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 flex flex-row items-center justify-between"
                  style={PRINT_COLOR_STYLE}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white print:hidden">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-base font-bold text-white">
                      {isAr ? 'الدخل' : 'Income'}
                    </CardTitle>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-emerald-100 font-medium block">{isAr ? 'الإجمالي' : 'Total'}</span>
                    <span className="text-lg font-black text-white">
                      {formatSAR(totalIncome)} <span className="text-xs font-normal">SAR</span>
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 border-b text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider font-bold print:hidden">
                        <th className="px-4 py-2.5 text-right">{isAr ? 'بند الدخل' : 'Category'}</th>
                        <th className="px-4 py-2.5 text-right w-36">{isAr ? 'المبلغ (SAR)' : 'Amount (SAR)'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {INCOME_CATEGORIES.map((cat, i) => {
                        const val = draft.income[cat.key as IncomeKey] || 0;
                        const pct = totalIncome > 0 ? Math.round((val / totalIncome) * 100) : 0;
                        return (
                          <tr
                            key={cat.key}
                            className={`border-b last:border-0 ${
                              i % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-gray-50/50 dark:bg-gray-900/30'
                            }`}
                          >
                            <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 w-3/5">
                              <div className="space-y-1">
                                <div>{isAr ? cat.labelAr : cat.labelEn}</div>
                                {val > 0 && totalIncome > 0 && (
                                  <div className="flex items-center gap-2 max-w-[10rem] print:hidden">
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                                      <div
                                        className="bg-emerald-500 h-full rounded-full"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-1.5 w-2/5 text-right tabular-nums font-medium">
                              {formatSAR(val)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-emerald-50 dark:bg-emerald-950/40 font-bold border-t-2 border-emerald-300 dark:border-emerald-800">
                        <td className="px-4 py-3 text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 print:hidden" />
                          {isAr ? 'الإجمالي' : 'Total'}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {formatSAR(totalIncome)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card className="print:shadow-none print:border break-inside-avoid overflow-hidden border-rose-200/90 dark:border-rose-900/60 shadow-md">
                <CardHeader
                  className="bg-gradient-to-r from-rose-600 to-pink-700 text-white p-4 flex flex-row items-center justify-between"
                  style={PRINT_COLOR_STYLE}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white print:hidden">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-base font-bold text-white">
                      {isAr ? 'المصروفات' : 'Expenses'}
                    </CardTitle>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-rose-100 font-medium block">{isAr ? 'الإجمالي' : 'Total'}</span>
                    <span className="text-lg font-black text-white">
                      {formatSAR(totalExpenses)} <span className="text-xs font-normal">SAR</span>
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 border-b text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider font-bold print:hidden">
                        <th className="px-4 py-2.5 text-right">{isAr ? 'المجموعة / بند المصروف' : 'Group / Item'}</th>
                        <th className="px-4 py-2.5 text-right w-36">{isAr ? 'المبلغ (SAR)' : 'Amount (SAR)'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {EXPENSE_GROUPS.map((group) => {
                        const isExpanded = openGroups[group.key] !== false;
                        const subtotal = groupSubtotals[group.key] || 0;
                        return (
                          <React.Fragment key={group.key}>
                            <tr
                              className="bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 cursor-pointer select-none print:cursor-default"
                              onClick={() => toggleGroup(group.key)}
                            >
                              <td colSpan={2} className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-200">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-2">
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-rose-500 print:hidden" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-slate-400 print:hidden" />
                                    )}
                                    {isAr ? group.labelAr : group.labelEn}
                                    <Badge variant="outline" className="text-[10px] bg-background text-muted-foreground border-slate-300 print:hidden">
                                      {group.categories.length} {isAr ? 'بنود' : 'items'}
                                    </Badge>
                                  </span>
                                  <span className="text-xs font-extrabold text-rose-700 dark:text-rose-400 tabular-nums">
                                    {formatSAR(subtotal)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {isExpanded &&
                              group.categories.map((cat, i) => {
                                const val = draft.expenses[cat.key as ExpenseCategoryKey] || 0;
                                const pct = totalExpenses > 0 ? Math.round((val / totalExpenses) * 100) : 0;
                                return (
                                  <tr
                                    key={cat.key}
                                    className={`border-b last:border-0 ${
                                      i % 2 === 0
                                        ? 'bg-white dark:bg-gray-950'
                                        : 'bg-gray-50/50 dark:bg-gray-900/30'
                                    }`}
                                  >
                                    <td className="px-4 py-2.5 pr-8 text-gray-700 dark:text-gray-300 w-3/5">
                                      <div className="space-y-1">
                                        <div>{isAr ? cat.labelAr : cat.labelEn}</div>
                                        {val > 0 && totalExpenses > 0 && (
                                          <div className="flex items-center gap-2 max-w-[10rem] print:hidden">
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                                              <div
                                                className="bg-rose-500 h-full rounded-full"
                                                style={{ width: `${pct}%` }}
                                              />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-1.5 w-2/5 text-right tabular-nums font-medium">
                                      {formatSAR(val)}
                                    </td>
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                      <tr className="bg-rose-50 dark:bg-rose-950/40 font-bold border-t-2 border-rose-300 dark:border-rose-800">
                        <td className="px-4 py-3 text-rose-700 dark:text-rose-400 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 print:hidden" />
                          {isAr ? 'الإجمالي' : 'Total'}
                        </td>
                        <td className="px-4 py-3 text-right text-rose-700 dark:text-rose-400 tabular-nums">
                          {formatSAR(totalExpenses)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* ═══ PRINT-ONLY OFFICIAL A4 FINANCIAL REPORT TEMPLATE ═══ */}
      <div
        id="print-report-a4"
        className="hidden print:block text-black bg-white w-full"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <style jsx global>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 5mm 6mm 5mm 6mm !important;
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
            .print\\:hidden { display: none !important; }
            .print\\:block { display: block !important; }
          }
          #print-report-a4 table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          #print-report-a4 tr,
          #print-report-a4 .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          #print-report-a4 thead {
            display: table-header-group;
          }
          #print-report-a4 th,
          #print-report-a4 td {
            border: 1px solid #cbd5e1;
            padding: 1.5px 4px;
            line-height: 1.25;
          }
        `}</style>

        {!draft ? (
          <div className="p-12 text-center text-gray-500">
            {isAr ? 'يرجى اختيار السكن والشهر المالي لعرض التقرير القابل للطباعة' : 'Select a residence and fiscal month to render the printable report'}
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-xs">
            {/* 1. Official Document Header */}
            <div className="grid grid-cols-3 items-center border-b-2 border-slate-800 pb-2 avoid-break">
              <div className="space-y-0.5">
                <h1 className="text-sm font-black text-slate-900">
                  {isAr ? 'الشركة السعودية للإنماء العمراني (ساكوديكو)' : 'Saudi Company for Urban Development (Sacodeco)'}
                </h1>
                <p className="text-[10px] text-slate-600 font-bold">
                  {isAr ? 'إدارة السكنات - قسم الشؤون المالية' : 'Housing Management - Finance Department'}
                </p>
              </div>

              <div className="flex justify-center">
                <div className="px-5 py-1.5 bg-slate-900 text-white rounded-md border-b-2 border-slate-700">
                  <h2 className="font-bold text-[12px] tracking-wide">
                    {isAr ? 'تقرير الدخل والمصروفات الشهري' : 'Monthly Income & Expenses Report'}
                  </h2>
                </div>
              </div>

              <div className="text-[9px] text-slate-700 space-y-0.5 text-end">
                <p>
                  <span className="font-bold text-slate-900">{isAr ? 'تاريخ الطباعة:' : 'Printed:'}</span>{' '}
                  <span className="font-mono">
                    {new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-GB')} -{' '}
                    {new Date().toLocaleTimeString(isAr ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
                <p>
                  <span className="font-bold text-slate-900">{isAr ? 'الفترة المالية:' : 'Fiscal Period:'}</span>{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {(isAr ? fiscalPeriod.labelAr : fiscalPeriod.labelEn) || monthLabel}
                  </span>
                </p>
                <p>
                  <span className="font-bold text-slate-900">{isAr ? 'رقم المستند:' : 'Document No:'}</span>{' '}
                  <span className="font-mono">FIN-{fiscalMonth}-{String(residenceId).slice(0, 6).toUpperCase()}</span>
                </p>
              </div>
            </div>

            {/* 2. Report Metadata Grid */}
            <div className="border border-slate-400 rounded bg-slate-50 p-2 text-[10px] leading-tight avoid-break">
              <div className="grid grid-cols-4 gap-x-4 gap-y-1">
                <div>
                  <span className="text-gray-500 block text-[9px]">{isAr ? 'السكن / Residence:' : 'Residence:'}</span>
                  <span className="font-bold text-gray-900 text-[11px]">{currentResidence?.name ?? residenceId}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">{isAr ? 'الشهر المالي / Fiscal Month:' : 'Fiscal Month:'}</span>
                  <span className="font-bold text-gray-900 text-[11px]">{monthLabel}</span>
                  <span className="text-[9px] text-gray-600 font-mono block">({fiscalMonth})</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">{isAr ? 'عدد أيام الفترة / Period Days:' : 'Period Days:'}</span>
                  <span className="font-semibold text-gray-900">{fiscalPeriod.numberOfDays || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">{isAr ? 'البنود المدخلة / Populated Items:' : 'Populated Items:'}</span>
                  <span className="font-semibold text-gray-900">
                    {populatedIncomeCount + populatedExpenseCount}{' '}
                    <span className="text-[9px] text-gray-600">
                      ({isAr ? 'دخل' : 'inc'} {populatedIncomeCount} / {isAr ? 'مصروف' : 'exp'} {populatedExpenseCount})
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Financial Metrics Strip */}
            <div className="grid grid-cols-5 gap-1 text-center text-[9px] avoid-break">
              <div className="p-1 border border-emerald-300 bg-emerald-50 rounded">
                <span className="text-gray-600 block">{isAr ? 'إجمالي الدخل (Income)' : 'Total Income'}</span>
                <span className="font-bold text-emerald-800 text-[11px]">{formatSAR(totalIncome)}</span>
              </div>
              <div className="p-1 border border-rose-300 bg-rose-50 rounded">
                <span className="text-gray-600 block">{isAr ? 'إجمالي المصروفات (Expenses)' : 'Total Expenses'}</span>
                <span className="font-bold text-rose-800 text-[11px]">{formatSAR(totalExpenses)}</span>
              </div>
              <div className={`p-1 border rounded ${netIncome >= 0 ? 'border-indigo-400 bg-indigo-50' : 'border-amber-400 bg-amber-50'}`}>
                <span className="text-gray-600 block">
                  {netIncome >= 0 ? (isAr ? 'صافي الربح (Net Profit)' : 'Net Profit') : (isAr ? 'صافي العجز (Net Loss)' : 'Net Loss')}
                </span>
                <span className={`font-bold text-[11px] ${netIncome >= 0 ? 'text-indigo-900' : 'text-amber-900'}`}>
                  {formatSAR(Math.abs(netIncome))}
                </span>
              </div>
              <div className="p-1 border border-slate-400 bg-slate-100 rounded">
                <span className="text-gray-600 block">{isAr ? 'هامش الربح (Margin)' : 'Profit Margin'}</span>
                <span className="font-bold text-slate-900 text-[11px]">
                  {totalIncome > 0 ? Math.round((netIncome / totalIncome) * 100) : 0}%
                </span>
              </div>
              <div className="p-1 border border-slate-400 bg-slate-100 rounded">
                <span className="text-gray-600 block">{isAr ? 'نسبة المصروف للدخل (Cost Ratio)' : 'Cost Ratio'}</span>
                <span className="font-bold text-slate-900 text-[11px]">
                  {totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* 4. Income Details + Expense Group Summary (side by side) */}
            <div className="grid grid-cols-2 gap-2 items-start">
              {/* Income table */}
              <div className="avoid-break">
                <div className="bg-emerald-700 text-white text-[10px] font-bold px-2 py-1 rounded-t flex items-center justify-between">
                  <span>{isAr ? 'أولاً: تفاصيل الدخل' : 'A. Income Details'}</span>
                  <span className="font-mono">{formatSAR(totalIncome)} SAR</span>
                </div>
                <table className="text-[8.5px]">
                  <thead>
                    <tr className="bg-emerald-50 text-slate-900 font-bold">
                      <th className="p-0.5 text-start">{isAr ? 'بند الدخل' : 'Income Category'}</th>
                      <th className="p-0.5 text-end w-20">{isAr ? 'المبلغ (SAR)' : 'Amount (SAR)'}</th>
                      <th className="p-0.5 text-center w-10">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {INCOME_CATEGORIES.map((cat, i) => {
                      const val = draft.income[cat.key as IncomeKey] || 0;
                      const pct = totalIncome > 0 ? Math.round((val / totalIncome) * 100) : 0;
                      return (
                        <tr key={cat.key} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-0.5 text-start">{isAr ? cat.labelAr : cat.labelEn}</td>
                          <td className={`p-0.5 text-end font-mono font-semibold ${val > 0 ? 'text-emerald-900' : 'text-gray-400'}`}>
                            {val > 0 ? formatSAR(val) : '—'}
                          </td>
                          <td className={`p-0.5 text-center font-mono ${val > 0 ? 'text-slate-700' : 'text-gray-400'}`}>
                            {val > 0 ? `${pct}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {unlistedIncome > 0 && (
                      <tr className="bg-amber-50">
                        <td className="p-0.5 text-start italic">
                          {isAr ? 'بنود دخل أخرى غير مصنفة' : 'Other / uncatalogued income'}
                        </td>
                        <td className="p-0.5 text-end font-mono font-semibold text-emerald-900">{formatSAR(unlistedIncome)}</td>
                        <td className="p-0.5 text-center font-mono text-slate-700">
                          {totalIncome > 0 ? Math.round((unlistedIncome / totalIncome) * 100) : 0}%
                        </td>
                      </tr>
                    )}
                    <tr className="bg-emerald-100 font-bold">
                      <td className="p-0.5 text-start text-emerald-900">{isAr ? 'إجمالي الدخل' : 'Total Income'}</td>
                      <td className="p-0.5 text-end font-mono text-emerald-900">{formatSAR(totalIncome)}</td>
                      <td className="p-0.5 text-center font-mono text-emerald-900">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Expense group summary + top items */}
              <div className="flex flex-col gap-2">
                <div className="avoid-break">
                  <div className="bg-rose-700 text-white text-[10px] font-bold px-2 py-1 rounded-t flex items-center justify-between">
                    <span>{isAr ? 'ثانياً: ملخص مجموعات المصروفات' : 'B. Expense Groups Summary'}</span>
                    <span className="font-mono">{formatSAR(totalExpenses)} SAR</span>
                  </div>
                  <table className="text-[8.5px]">
                    <thead>
                      <tr className="bg-rose-50 text-slate-900 font-bold">
                        <th className="p-0.5 text-start">{isAr ? 'المجموعة' : 'Group'}</th>
                        <th className="p-0.5 text-center w-10">{isAr ? 'بنود' : 'Items'}</th>
                        <th className="p-0.5 text-end w-20">{isAr ? 'المبلغ (SAR)' : 'Amount (SAR)'}</th>
                        <th className="p-0.5 text-center w-10">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseGroupBreakdown.map((group, i) => (
                        <tr key={group.key} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-0.5 text-start font-semibold">{isAr ? group.labelAr : group.labelEn}</td>
                          <td className="p-0.5 text-center font-mono text-slate-600">{group.count}</td>
                          <td className={`p-0.5 text-end font-mono font-semibold ${group.subtotal > 0 ? 'text-rose-900' : 'text-gray-400'}`}>
                            {group.subtotal > 0 ? formatSAR(group.subtotal) : '—'}
                          </td>
                          <td className={`p-0.5 text-center font-mono ${group.subtotal > 0 ? 'text-slate-700' : 'text-gray-400'}`}>
                            {group.subtotal > 0 ? `${group.pct}%` : '—'}
                          </td>
                        </tr>
                      ))}
                      {unlistedExpenses > 0 && (
                        <tr className="bg-amber-50">
                          <td className="p-0.5 text-start italic">
                            {isAr ? 'بنود مصروفات أخرى غير مصنفة' : 'Other / uncatalogued expenses'}
                          </td>
                          <td className="p-0.5 text-center font-mono text-slate-600">-</td>
                          <td className="p-0.5 text-end font-mono font-semibold text-rose-900">{formatSAR(unlistedExpenses)}</td>
                          <td className="p-0.5 text-center font-mono text-slate-700">
                            {totalExpenses > 0 ? Math.round((unlistedExpenses / totalExpenses) * 100) : 0}%
                          </td>
                        </tr>
                      )}
                      <tr className="bg-rose-100 font-bold">
                        <td className="p-0.5 text-start text-rose-900">{isAr ? 'إجمالي المصروفات' : 'Total Expenses'}</td>
                        <td className="p-0.5 text-center font-mono text-rose-900">
                          {expenseGroupBreakdown.reduce((s, g) => s + g.count, 0)}
                        </td>
                        <td className="p-0.5 text-end font-mono text-rose-900">{formatSAR(totalExpenses)}</td>
                        <td className="p-0.5 text-center font-mono text-rose-900">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {topExpenseItems.length > 0 && (
                  <div className="avoid-break">
                    <div className="bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-t">
                      {isAr ? 'أعلى 5 بنود مصروفات' : 'Top 5 Expense Items'}
                    </div>
                    <table className="text-[8.5px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-900 font-bold">
                          <th className="p-0.5 text-center w-6">#</th>
                          <th className="p-0.5 text-start">{isAr ? 'البند' : 'Item'}</th>
                          <th className="p-0.5 text-start w-16">{isAr ? 'المجموعة' : 'Group'}</th>
                          <th className="p-0.5 text-end w-20">{isAr ? 'المبلغ (SAR)' : 'Amount (SAR)'}</th>
                          <th className="p-0.5 text-center w-10">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topExpenseItems.map((item, i) => (
                          <tr key={`${item.labelEn}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="p-0.5 text-center font-mono text-slate-500">{i + 1}</td>
                            <td className="p-0.5 text-start font-semibold">{isAr ? item.labelAr : item.labelEn}</td>
                            <td className="p-0.5 text-start text-slate-600">{isAr ? item.groupAr : item.groupEn}</td>
                            <td className="p-0.5 text-end font-mono font-semibold text-rose-900">{formatSAR(item.value)}</td>
                            <td className="p-0.5 text-center font-mono text-slate-700">
                              {totalExpenses > 0 ? Math.round((item.value / totalExpenses) * 100) : 0}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Full Expense Breakdown — group tables split over two columns */}
            <div>
              <div className="bg-rose-700 text-white text-[10px] font-bold px-2 py-1 rounded-t flex items-center justify-between">
                <span>{isAr ? 'ثالثاً: تفاصيل المصروفات حسب المجموعة' : 'C. Detailed Expenses by Group'}</span>
                <span className="font-mono">{formatSAR(totalExpenses)} SAR</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[EXPENSE_GROUPS.slice(0, 2), EXPENSE_GROUPS.slice(2)].map((column, colIdx) => (
                  <div key={colIdx} className="flex flex-col gap-2">
                    {column.map((group) => {
                      const subtotal = groupSubtotals[group.key] || 0;
                      return (
                        <div key={group.key} className="avoid-break">
                          <table className="text-[8.5px]">
                            <thead>
                              <tr className="bg-slate-200 text-slate-900 font-bold">
                                <th className="p-0.5 text-start" colSpan={2}>
                                  {isAr ? group.labelAr : group.labelEn}
                                </th>
                                <th className="p-0.5 text-end w-20 font-mono">{formatSAR(subtotal)}</th>
                              </tr>
                              <tr className="bg-slate-50 text-slate-700 font-semibold">
                                <th className="p-0.5 text-start">{isAr ? 'البند' : 'Item'}</th>
                                <th className="p-0.5 text-end w-20">{isAr ? 'المبلغ (SAR)' : 'Amount (SAR)'}</th>
                                <th className="p-0.5 text-center w-12">{isAr ? 'من المجموعة' : 'of group'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.categories.map((cat, i) => {
                                const val = draft.expenses[cat.key as ExpenseCategoryKey] || 0;
                                const pct = subtotal > 0 ? Math.round((val / subtotal) * 100) : 0;
                                return (
                                  <tr key={cat.key} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                    <td className="p-0.5 text-start">{isAr ? cat.labelAr : cat.labelEn}</td>
                                    <td className={`p-0.5 text-end font-mono font-semibold ${val > 0 ? 'text-rose-900' : 'text-gray-400'}`}>
                                      {val > 0 ? formatSAR(val) : '—'}
                                    </td>
                                    <td className={`p-0.5 text-center font-mono ${val > 0 ? 'text-slate-700' : 'text-gray-400'}`}>
                                      {val > 0 ? `${pct}%` : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                              <tr className="bg-rose-50 font-bold">
                                <td className="p-0.5 text-start text-rose-900">
                                  {isAr ? `إجمالي ${group.labelAr}` : `${group.labelEn} Subtotal`}
                                </td>
                                <td className="p-0.5 text-end font-mono text-rose-900">{formatSAR(subtotal)}</td>
                                <td className="p-0.5 text-center font-mono text-rose-900">100%</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* 6. Final Result Bar */}
            <div
              className={`avoid-break border rounded px-3 py-1.5 grid grid-cols-3 items-center text-[10px] ${
                netIncome >= 0 ? 'border-indigo-400 bg-indigo-50' : 'border-amber-400 bg-amber-50'
              }`}
            >
              <span className="font-bold text-slate-900">
                {isAr ? 'إجمالي الدخل:' : 'Total Income:'}{' '}
                <span className="font-mono text-emerald-800">{formatSAR(totalIncome)} SAR</span>
              </span>
              <span className="font-bold text-slate-900 text-center">
                {isAr ? 'إجمالي المصروفات:' : 'Total Expenses:'}{' '}
                <span className="font-mono text-rose-800">{formatSAR(totalExpenses)} SAR</span>
              </span>
              <span className="font-black text-[11px] text-end">
                {netIncome >= 0 ? (isAr ? 'صافي الربح:' : 'Net Profit:') : (isAr ? 'صافي العجز:' : 'Net Loss:')}{' '}
                <span className={`font-mono ${netIncome >= 0 ? 'text-indigo-900' : 'text-amber-900'}`}>
                  {formatSAR(Math.abs(netIncome))} SAR
                </span>
              </span>
            </div>

            {/* 7. Official Approvals & Signatures Box */}
            <div className="border border-gray-400 rounded p-2 bg-slate-50 avoid-break">
              <div className="grid grid-cols-3 gap-4 text-center text-[9px]">
                <div>
                  <p className="font-bold text-gray-900 mb-4">{isAr ? 'إعداد: مشرف السكن (Prepared By)' : 'Prepared By (Site Supervisor)'}</p>
                  <p className="text-gray-400">________________________</p>
                  <p className="text-[8px] text-gray-500 mt-1">{isAr ? 'التاريخ: ____ / ____ / ________' : 'Date: ____ / ____ / ________'}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-900 mb-4">{isAr ? 'مراجعة: المحاسب (Reviewed By)' : 'Reviewed By (Accountant)'}</p>
                  <p className="text-gray-400">________________________</p>
                  <p className="text-[8px] text-gray-500 mt-1">{isAr ? 'التاريخ: ____ / ____ / ________' : 'Date: ____ / ____ / ________'}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-900 mb-4">{isAr ? 'اعتماد: الإدارة المالية (Approved By)' : 'Approved By (Finance Manager)'}</p>
                  <p className="text-gray-400">________________________</p>
                  <p className="text-[8px] text-gray-500 mt-1">{isAr ? 'التاريخ: ____ / ____ / ________' : 'Date: ____ / ____ / ________'}</p>
                </div>
              </div>
              <div className="text-[8px] text-center text-gray-500 border-t border-gray-300 pt-1 mt-2">
                {isAr
                  ? `هذا التقرير مستخرج آلياً من نظام إدارة السكنات - شركة مساكن العمالية للخدمات المسانده - معتمد برقم FIN-${fiscalMonth}-${String(residenceId).slice(0, 6).toUpperCase()}`
                  : `Auto-generated by the Housing Management System — Document ref FIN-${fiscalMonth}-${String(residenceId).slice(0, 6).toUpperCase()}`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IncomeExpensesReportPage() {
  return (
    <FinancialsProvider>
      <IncomeExpensesReportContent />
    </FinancialsProvider>
  );
}
