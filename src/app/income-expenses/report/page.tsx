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
} from '@/types/financials';
import { getFiscalMonthForDate } from '@/lib/fiscal-month-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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

function formatMoney(v?: number) {
  if (v === undefined) return '-';
  return v.toLocaleString('en-US');
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

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    maintenance: true,
    assets: true,
    services: true,
    other: true,
  });

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const printPage = () => {
    window.print();
  };

  const downloadPdf = async () => {
    const reportEl = document.getElementById('report-main-content');
    if (!reportEl) return;
    setIsExportingPdf(true);
    try {
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;

      const canvas = await html2canvas(reportEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        ignoreElements: (el) => el.classList.contains('print:hidden'),
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
      setIsExportingPdf(false);
    }
  };

  if (!fiscalMonth || !residenceId) {
    return (
      <div className="p-6">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const reportContent = (
    <div id="report-main-content" className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {isAr ? 'تقرير الدخل والمصروفات الشهري' : 'Monthly Income & Expenses Report'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr
              ? 'تفصيل الدخل والمصروفات لكل سكن للشهر المختار'
              : 'Breakdown of income/expenses per residence for selected month'}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
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
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
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

      <Card className="print:hidden">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" />
                {isAr ? 'الشهر المالي' : 'Fiscal Month'}
              </label>
              <Select value={fiscalMonth} onValueChange={setFiscalMonth}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {new Date(m + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {isAr ? 'السكن' : 'Residence'}
              </label>
              <Select value={residenceId} onValueChange={setResidenceId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={isAr ? 'اختر السكن' : 'Select residence'} />
                </SelectTrigger>
                <SelectContent>
                  {activeResidences.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print:block text-sm text-gray-600 border-b pb-3">
        <p><strong>{isAr ? 'السكن:' : 'Residence:'}</strong> {currentResidence?.name ?? residenceId}</p>
        <p><strong>{isAr ? 'الشهر المالي:' : 'Fiscal Month:'}</strong> {new Date(fiscalMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
      </div>

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
          <div className="grid gap-4 grid-cols-3">
            <Card className="border-emerald-200 dark:border-emerald-900 print:shadow-none break-inside-avoid">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {isAr ? 'إجمالي الدخل' : 'Total Income'}
                </CardTitle>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {formatMoney(totalIncome)} <span className="text-sm font-normal">SAR</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-rose-200 dark:border-rose-900 print:shadow-none break-inside-avoid">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-400">
                  {isAr ? 'إجمالي المصروفات' : 'Total Expenses'}
                </CardTitle>
                <TrendingDown className="w-4 h-4 text-rose-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                  {formatMoney(totalExpenses)} <span className="text-sm font-normal">SAR</span>
                </div>
              </CardContent>
            </Card>

            <Card
              className={
                (netIncome >= 0
                  ? 'border-blue-200 dark:border-blue-900'
                  : 'border-amber-200 dark:border-amber-900') +
                ' print:shadow-none break-inside-avoid'
              }
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle
                  className={`text-sm font-medium ${
                    netIncome >= 0
                      ? 'text-blue-700 dark:text-blue-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {isAr ? 'صافي الدخل' : 'Net Income'}
                </CardTitle>
                <DollarSign
                  className={`w-4 h-4 ${netIncome >= 0 ? 'text-blue-500' : 'text-amber-500'}`}
                />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    netIncome >= 0
                      ? 'text-blue-700 dark:text-blue-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {formatMoney(Math.abs(netIncome))}{' '}
                  <span className="text-sm font-normal">
                    SAR {netIncome < 0 ? (isAr ? '(خسارة)' : '(Loss)') : ''}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Card className="print:shadow-none break-inside-avoid">
              <CardHeader className="bg-emerald-50/60 dark:bg-emerald-950/30 border-b py-3">
                <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                  {isAr ? 'الدخل' : 'Income'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {INCOME_CATEGORIES.map((cat, i) => (
                      <tr
                        key={cat.key}
                        className={`border-b last:border-0 ${
                          i % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-gray-50/50 dark:bg-gray-900/30'
                        }`}
                      >
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300 w-3/5">
                          {isAr ? cat.labelAr : cat.labelEn}
                        </td>
                        <td className="px-3 py-1.5 w-2/5 text-right tabular-nums">
                          {formatMoney(draft.income[cat.key as IncomeKey])}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50 dark:bg-emerald-950/40 font-bold">
                      <td className="px-4 py-3 text-emerald-700 dark:text-emerald-400">
                        {isAr ? 'الإجمالي' : 'Total'}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatMoney(totalIncome)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="print:shadow-none break-inside-avoid">
              <CardHeader className="bg-rose-50/60 dark:bg-rose-950/30 border-b py-3">
                <CardTitle className="text-base flex items-center gap-2 text-rose-700 dark:text-rose-400">
                  <TrendingDown className="w-4 h-4" />
                  {isAr ? 'المصروفات' : 'Expenses'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {EXPENSE_GROUPS.map((group) => (
                      <React.Fragment key={group.key}>
                        <tr
                          className="bg-gray-100 dark:bg-gray-800 cursor-pointer select-none"
                          onClick={() => toggleGroup(group.key)}
                        >
                          <td
                            colSpan={2}
                            className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2"
                          >
                            {openGroups[group.key] !== false ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            {isAr ? group.labelAr : group.labelEn}
                          </td>
                        </tr>
                        {openGroups[group.key] !== false &&
                          group.categories.map((cat, i) => (
                            <tr
                              key={cat.key}
                              className={`border-b last:border-0 ${
                                i % 2 === 0
                                  ? 'bg-white dark:bg-gray-950'
                                  : 'bg-gray-50/50 dark:bg-gray-900/30'
                              }`}
                            >
                              <td className="px-4 py-2 pl-8 text-gray-700 dark:text-gray-300 w-3/5">
                                {isAr ? cat.labelAr : cat.labelEn}
                              </td>
                              <td className="px-3 py-1.5 w-2/5 text-right tabular-nums">
                                {formatMoney(draft.expenses[cat.key as ExpenseCategoryKey])}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    ))}
                    <tr className="bg-rose-50 dark:bg-rose-950/40 font-bold">
                      <td className="px-4 py-3 text-rose-700 dark:text-rose-400">
                        {isAr ? 'الإجمالي' : 'Total'}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-700 dark:text-rose-400 tabular-nums">
                        {formatMoney(totalExpenses)}
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
  );

  return reportContent;
}

export default function IncomeExpensesReportPage() {
  return (
    <FinancialsProvider>
      <IncomeExpensesReportContent />
    </FinancialsProvider>
  );
}
