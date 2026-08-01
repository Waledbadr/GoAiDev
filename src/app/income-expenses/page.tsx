'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FinancialsProvider, useFinancials } from '@/context/financials-context';
import { useResidences } from '@/context/residences-context';
import { useUsers } from '@/context/users-context';
import { useLanguage } from '@/context/language-context';
import {
  INCOME_CATEGORIES,
  EXPENSE_GROUPS,
  MonthlyFinancial,
  calcTotalIncome,
  calcTotalExpenses,
  formatSAR,
  IncomeKey,
  ExpenseCategoryKey,
} from '@/types/financials';
import { getFiscalMonthForDate } from '@/lib/fiscal-month-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Save,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Building2,
  FileBarChart,
  ListOrdered,
  Search,
  CheckCircle2,
  ShieldAlert,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import Link from 'next/link';

// ─── Generate fiscal month list ─────────────────────────────────────────
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

// ─── Numeric Input Cell ─────────────────────────────────────────────────
function NumInput({
  value,
  onChange,
  disabled = false,
  isIncome = false,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  disabled?: boolean;
  isIncome?: boolean;
}) {
  const [raw, setRaw] = useState(value !== undefined && value !== 0 ? String(value) : '');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setRaw(value !== undefined && value !== 0 ? String(value) : '');
  }, [value]);

  const numVal = parseFloat(raw);
  const hasValue = !isNaN(numVal) && numVal > 0;

  return (
    <div className="relative flex items-center group">
      <Input
        type="number"
        min={0}
        disabled={disabled}
        value={raw}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={e => {
          setRaw(e.target.value);
          const n = parseFloat(e.target.value);
          onChange(isNaN(n) ? undefined : n);
        }}
        className={`h-9 text-sm text-right font-mono font-medium transition-all ${
          disabled
            ? 'bg-muted/40 opacity-70 cursor-not-allowed'
            : isFocused
            ? isIncome
              ? 'ring-2 ring-emerald-500/30 border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20'
              : 'ring-2 ring-rose-500/30 border-rose-500 bg-rose-50/20 dark:bg-rose-950/20'
            : hasValue
            ? isIncome
              ? 'bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 font-bold'
              : 'bg-rose-50/40 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100 font-bold'
            : 'bg-background hover:border-slate-300 dark:hover:border-slate-700'
        }`}
        placeholder="0"
      />
      {hasValue && !disabled && (
        <button
          type="button"
          onClick={() => {
            setRaw('');
            onChange(undefined);
          }}
          className="absolute left-2 text-muted-foreground/40 hover:text-muted-foreground p-0.5 rounded-full transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Clear"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Main Content ────────────────────────────────────────────────────────
function IncomeExpensesContent() {
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const { residences } = useResidences();
  const { currentUser } = useUsers();
  const { financials, loading, fetchByMonth, saveFinancial, getOrCreate } = useFinancials();
  const isAdmin = currentUser?.role === 'Admin';

  const months = useMemo(() => generateMonthList(), []);
  const [fiscalMonth, setFiscalMonth] = useState(months[0] ?? '');
  const [residenceId, setResidenceId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const activeResidences = useMemo(
    () => {
      const base = residences
        .filter((r) => !r.disabled)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const assigned = currentUser?.assignedResidences || [];
      if (currentUser?.role === 'Admin') return base;
      if (!assigned.length) return base;
      return base.filter((r) => assigned.includes(r.id));
    },
    [residences, currentUser],
  );

  // Auto-select first residence
  useEffect(() => {
    if (!activeResidences.length) {
      setResidenceId('');
      return;
    }
    if (!residenceId || !activeResidences.some((r) => r.id === residenceId)) {
      setResidenceId(activeResidences[0].id);
    }
  }, [activeResidences, residenceId]);

  // Fetch on month change
  useEffect(() => {
    if (fiscalMonth) fetchByMonth(fiscalMonth);
  }, [fiscalMonth, fetchByMonth]);

  // Current editable record
  const currentResidence = activeResidences.find(r => r.id === residenceId);
  const [draft, setDraft] = useState<MonthlyFinancial | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const isExistingRecord = !!draft && financials.some((financial) => financial.id === draft.id);
  const canEdit = isAdmin || !isExistingRecord;

  useEffect(() => {
    if (!residenceId || !fiscalMonth || !currentResidence) return;
    setDraft(getOrCreate(residenceId, currentResidence.name, fiscalMonth));
    setIsDirty(false);
  }, [residenceId, fiscalMonth, financials, currentResidence, getOrCreate]);

  const setIncome = (key: IncomeKey, v: number | undefined) => {
    if (!draft || !canEdit) return;
    setDraft({ ...draft, income: { ...draft.income, [key]: v } });
    setIsDirty(true);
    setSaveSuccess(false);
  };

  const setExpense = (key: ExpenseCategoryKey, v: number | undefined) => {
    if (!draft || !canEdit) return;
    setDraft({ ...draft, expenses: { ...draft.expenses, [key]: v } });
    setIsDirty(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!draft) return;
    await saveFinancial(draft);
    setIsDirty(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  const totalIncome = draft ? calcTotalIncome(draft.income) : 0;
  const totalExpenses = draft ? calcTotalExpenses(draft.expenses) : 0;
  const netIncome = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? ((netIncome / totalIncome) * 100).toFixed(1) : '0';
  const expenseRatio = totalIncome > 0 ? Math.min(100, Math.round((totalExpenses / totalIncome) * 100)) : 0;

  // Collapsible expense groups state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    maintenance: true, assets: true, services: true, other: true,
  });

  const toggleGroup = (key: string) =>
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const expandAllGroups = () => {
    const next: Record<string, boolean> = {};
    EXPENSE_GROUPS.forEach(g => { next[g.key] = true; });
    setOpenGroups(next);
  };

  const collapseAllGroups = () => {
    const next: Record<string, boolean> = {};
    EXPENSE_GROUPS.forEach(g => { next[g.key] = false; });
    setOpenGroups(next);
  };

  // Group Expense Subtotals
  const groupSubtotals = useMemo(() => {
    if (!draft) return {};
    const res: Record<string, number> = {};
    EXPENSE_GROUPS.forEach(group => {
      let sum = 0;
      group.categories.forEach(cat => {
        sum += draft.expenses[cat.key as ExpenseCategoryKey] || 0;
      });
      res[group.key] = sum;
    });
    return res;
  }, [draft]);

  // Counts of non-zero items
  const populatedIncomeCount = useMemo(() => {
    if (!draft) return 0;
    return Object.values(draft.income).filter(v => (v || 0) > 0).length;
  }, [draft]);

  const populatedExpenseCount = useMemo(() => {
    if (!draft) return 0;
    return Object.values(draft.expenses).filter(v => (v || 0) > 0).length;
  }, [draft]);

  // Filtered categories based on search
  const filteredIncomeCategories = useMemo(() => {
    if (!searchTerm.trim()) return INCOME_CATEGORIES;
    const term = searchTerm.toLowerCase();
    return INCOME_CATEGORIES.filter(c =>
      c.labelAr.toLowerCase().includes(term) || c.labelEn.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const filteredExpenseGroups = useMemo(() => {
    if (!searchTerm.trim()) return EXPENSE_GROUPS;
    const term = searchTerm.toLowerCase();
    return EXPENSE_GROUPS.map(group => {
      const matchingCats = group.categories.filter(c =>
        c.labelAr.toLowerCase().includes(term) || c.labelEn.toLowerCase().includes(term)
      );
      if (matchingCats.length > 0 || group.labelAr.toLowerCase().includes(term) || group.labelEn.toLowerCase().includes(term)) {
        return {
          ...group,
          categories: matchingCats.length > 0 ? matchingCats : group.categories,
        };
      }
      return null;
    }).filter(Boolean) as typeof EXPENSE_GROUPS;
  }, [searchTerm]);

  if (!activeResidences.length) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-8 text-center space-y-3">
            <Building2 className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-lg font-bold text-amber-900 dark:text-amber-200">
              {isAr ? 'لا توجد سكنات متاحة' : 'No Residences Available'}
            </h2>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {isAr ? 'لا توجد سكنات مخصصة أو نشطة لهذا المستخدم في النظام.' : 'No active residences are assigned to your user account.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 pb-24">
      {/* ─── Page Header ───────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-2xl shadow-lg border border-slate-800 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -left-10 -top-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs px-2.5 py-0.5 font-medium">
              <PieChart className="w-3.5 h-3.5 ml-1.5" />
              {isAr ? 'إدارة المالية العامة' : 'Financial Management'}
            </Badge>
            {isExistingRecord ? (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-300 border-blue-500/30 text-xs">
                {isAr ? 'سجل محفوظ' : 'Saved Record'}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-xs">
                {isAr ? 'مسودة جديدة' : 'New Draft'}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {isAr ? 'الدخل والمصروفات' : 'Income & Expenses'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            {isAr
              ? 'تدوين ومتابعة التدفقات المالية الشهرية للسكنات، وتفصيل المصروفات والإيرادات بدقة عالية.'
              : 'Track and enter monthly financial cash flows, detailed expenses, and revenues per residence.'}
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 shrink-0">
          <Button asChild variant="secondary" size="sm" className="gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
            <Link href="/income-expenses/report">
              <FileBarChart className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? 'التقرير الشهري' : 'Monthly Report'}</span>
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm" className="gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
            <Link href="/income-expenses/transactions">
              <ListOrdered className="w-4 h-4 text-indigo-400" />
              <span>{isAr ? 'إدخال الحركات' : 'Transactions'}</span>
            </Link>
          </Button>
          <Button
            onClick={handleSave}
            disabled={!draft || loading || !canEdit}
            size="sm"
            className={`gap-2 text-white font-bold transition-all shadow-md ${
              isDirty
                ? 'bg-emerald-600 hover:bg-emerald-500 ring-2 ring-emerald-400/50 scale-105'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{isAr ? 'حفظ البيانات' : 'Save Statement'}</span>
          </Button>
        </div>
      </div>

      {/* ─── Save Success Toast Banner ─────────────────────────── */}
      {saveSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl flex items-center justify-between text-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">
              {isAr ? 'تم حفظ بيانات الدخل والمصروفات بنجاح!' : 'Financial statement saved successfully!'}
            </span>
          </div>
          <button onClick={() => setSaveSuccess(false)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── Controls & Filters Card ────────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-card">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Fiscal Month Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
                {isAr ? 'الشهر المالي' : 'Fiscal Month'}
              </label>
              <Select value={fiscalMonth} onValueChange={setFiscalMonth}>
                <SelectTrigger className="w-full h-10 font-semibold bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {months.map(m => {
                    const dateObj = new Date(m + '-01');
                    const monthLabel = dateObj.toLocaleString(isAr ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' });
                    return (
                      <SelectItem key={m} value={m} className="font-medium">
                        {m} ({monthLabel})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Residence Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                {isAr ? 'السكن المستهدف' : 'Target Residence'}
              </label>
              <Select value={residenceId} onValueChange={setResidenceId}>
                <SelectTrigger className="w-full h-10 font-semibold bg-background">
                  <SelectValue placeholder={isAr ? 'اختر السكن' : 'Select residence'} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {activeResidences.map(r => (
                    <SelectItem key={r.id} value={r.id} className="font-medium">
                      🏢 {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Item Search Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-sky-500" />
                {isAr ? 'البحث في البنود' : 'Search Line Items'}
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={isAr ? 'ابحث عن بنود (مثلاً: كهرباء، صيانة...)' : 'Search item (e.g., electricity...)'}
                  className="h-10 pr-9 text-xs"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute left-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Financial KPI Executive Summary Cards ──────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income KPI */}
        <Card className="border-emerald-200/80 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/60 via-background to-background dark:from-emerald-950/20 shadow-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              {isAr ? 'إجمالي الدخل' : 'Total Income'}
            </CardTitle>
            <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 text-[11px]">
              {populatedIncomeCount} {isAr ? 'بنود' : 'items'}
            </Badge>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2">
            <div className="text-2xl font-black tracking-tight text-emerald-700 dark:text-emerald-400">
              {formatSAR(totalIncome)} <span className="text-xs font-bold text-emerald-600">ر.س</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
              {isAr ? 'مجموع إيرادات الشهر المحدد' : 'Sum of revenues for this period'}
            </p>
          </CardContent>
        </Card>

        {/* Total Expenses KPI */}
        <Card className="border-rose-200/80 dark:border-rose-900/50 bg-gradient-to-br from-rose-50/60 via-background to-background dark:from-rose-950/20 shadow-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              {isAr ? 'إجمالي المصروفات' : 'Total Expenses'}
            </CardTitle>
            <Badge variant="outline" className="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-300 text-[11px]">
              {populatedExpenseCount} {isAr ? 'بنود' : 'items'}
            </Badge>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2">
            <div className="text-2xl font-black tracking-tight text-rose-700 dark:text-rose-400">
              {formatSAR(totalExpenses)} <span className="text-xs font-bold text-rose-600">ر.س</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
              {isAr ? 'تكاليف السكن التشغيلية والأصول' : 'Operational & capital expenditure'}
            </p>
          </CardContent>
        </Card>

        {/* Net Income KPI */}
        <Card className={`border-2 shadow-sm relative overflow-hidden ${
          netIncome >= 0
            ? 'border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/60 via-background to-background dark:from-indigo-950/20'
            : 'border-amber-300 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/60 via-background to-background dark:from-amber-950/20'
        }`}>
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${netIncome >= 0 ? 'bg-indigo-600' : 'bg-amber-500'}`} />
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className={`text-xs font-bold flex items-center gap-1.5 ${netIncome >= 0 ? 'text-indigo-800 dark:text-indigo-300' : 'text-amber-800 dark:text-amber-300'}`}>
              <DollarSign className="w-4 h-4" />
              {isAr ? 'صافي الدخل (الربح/الخسارة)' : 'Net Income (Profit/Loss)'}
            </CardTitle>
            <Badge className={netIncome >= 0 ? 'bg-indigo-600 text-white text-[10px]' : 'bg-amber-600 text-white text-[10px]'}>
              {profitMargin}% {isAr ? 'هامش' : 'margin'}
            </Badge>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2">
            <div className={`text-2xl font-black tracking-tight ${netIncome >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {formatSAR(Math.abs(netIncome))} <span className="text-xs font-bold">ر.س</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-semibold">
              {netIncome >= 0
                ? (isAr ? 'ربح صافي محقق' : 'Net Surplus Profit')
                : (isAr ? 'عجز / مصروف زائد عن الدخل' : 'Deficit / Net Loss')}
            </p>
          </CardContent>
        </Card>

        {/* Expense Ratio Gauge KPI */}
        <Card className="border-slate-200 dark:border-slate-800 bg-card shadow-sm relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-500" />
              {isAr ? 'نسبة المصروف للدخل' : 'Expense to Income Ratio'}
            </CardTitle>
            <Badge variant="outline" className="text-[11px] font-bold">
              {expenseRatio}%
            </Badge>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2 space-y-2">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  expenseRatio > 90
                    ? 'bg-rose-500'
                    : expenseRatio > 70
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${expenseRatio}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground flex justify-between">
              <span>{isAr ? 'حالة التعديل:' : 'Edit Status:'}</span>
              <span className="font-bold text-foreground">
                {canEdit ? (isAr ? 'متاح للتعديل' : 'Editable') : (isAr ? 'عرض فقط' : 'View Only')}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Main Financial Statement Tables (Income & Expenses) ─── */}
      {draft && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ════════════════ INCOME CARD TABLE ════════════════ */}
          <Card className="border-emerald-200/90 dark:border-emerald-900/60 shadow-md overflow-hidden bg-card">
            <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-white">
                    {isAr ? 'جدول بنود الدخل' : 'Income Statement'}
                  </CardTitle>
                  <p className="text-xs text-emerald-100/90 mt-0.5">
                    {isAr ? 'إيرادات وإيجارات السكن المستلمة' : 'Revenues & rental collections'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-emerald-100 font-medium block">{isAr ? 'الإجمالي' : 'Total'}</span>
                <span className="text-lg font-black text-white">{formatSAR(totalIncome)} <span className="text-xs font-normal">ر.س</span></span>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-right">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 border-b text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider font-bold">
                      <th className="px-4 py-3 text-right">{isAr ? 'بند الدخل' : 'Category'}</th>
                      <th className="px-4 py-3 text-right w-44">{isAr ? 'المبلغ (ر.س)' : 'Amount (SAR)'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredIncomeCategories.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground text-xs">
                          {isAr ? 'لا توجد بنود دخل تطابق كلمة البحث' : 'No income categories match your search.'}
                        </td>
                      </tr>
                    ) : (
                      filteredIncomeCategories.map((cat, i) => {
                        const val = draft.income[cat.key as IncomeKey] || 0;
                        const pct = totalIncome > 0 ? Math.round((val / totalIncome) * 100) : 0;

                        return (
                          <tr
                            key={cat.key}
                            className={`transition-colors hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 ${
                              i % 2 === 0 ? 'bg-background' : 'bg-slate-50/30 dark:bg-slate-900/10'
                            }`}
                          >
                            <td className="px-4 py-3 align-middle">
                              <div className="space-y-1">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                                  {isAr ? cat.labelAr : cat.labelEn}
                                </div>
                                {val > 0 && totalIncome > 0 && (
                                  <div className="flex items-center gap-2 max-w-xs">
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                      <div
                                        className="bg-emerald-500 h-full rounded-full transition-all"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                                      {pct}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 align-middle">
                              <NumInput
                                value={draft.income[cat.key as IncomeKey]}
                                onChange={v => setIncome(cat.key as IncomeKey, v)}
                                disabled={!canEdit}
                                isIncome={true}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50 dark:bg-emerald-950/50 font-bold border-t-2 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100">
                      <td className="px-4 py-3.5 text-xs sm:text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <span>{isAr ? 'إجمالي الدخل النهائي' : 'Total Net Revenue'}</span>
                      </td>
                      <td className="px-4 py-3.5 text-left sm:text-right text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300">
                        {formatSAR(totalIncome)} <span className="text-xs font-normal">ر.س</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ════════════════ EXPENSES CARD TABLE ════════════════ */}
          <Card className="border-rose-200/90 dark:border-rose-900/60 shadow-md overflow-hidden bg-card">
            <CardHeader className="bg-gradient-to-r from-rose-600 to-pink-700 text-white p-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-white">
                    {isAr ? 'جدول بنود المصروفات' : 'Expenses Statement'}
                  </CardTitle>
                  <p className="text-xs text-rose-100/90 mt-0.5">
                    {isAr ? 'مصروفات المباني والأصول والخدمات' : 'Buildings, assets & operating expenses'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <span className="text-xs text-rose-100 font-medium block">{isAr ? 'الإجمالي' : 'Total'}</span>
                  <span className="text-lg font-black text-white">{formatSAR(totalExpenses)} <span className="text-xs font-normal">ر.س</span></span>
                </div>
                <div className="flex items-center gap-1 bg-white/10 p-1 rounded-lg">
                  <button
                    onClick={expandAllGroups}
                    className="p-1 hover:bg-white/20 rounded text-white text-xs"
                    title={isAr ? 'توسيع الكل' : 'Expand All'}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={collapseAllGroups}
                    className="p-1 hover:bg-white/20 rounded text-white text-xs"
                    title={isAr ? 'طي الكل' : 'Collapse All'}
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-right">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 border-b text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider font-bold">
                      <th className="px-4 py-3 text-right">{isAr ? 'المجموعة / بند المصروف' : 'Group / Expense Item'}</th>
                      <th className="px-4 py-3 text-right w-44">{isAr ? 'المبلغ (ر.س)' : 'Amount (SAR)'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenseGroups.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground text-xs">
                          {isAr ? 'لا توجد بنود مصروفات تطابق كلمة البحث' : 'No expense categories match your search.'}
                        </td>
                      </tr>
                    ) : (
                      filteredExpenseGroups.map(group => {
                        const isExpanded = openGroups[group.key] !== false;
                        const subtotal = groupSubtotals[group.key] || 0;

                        return (
                          <React.Fragment key={group.key}>
                            {/* Group Header Row */}
                            <tr
                              onClick={() => toggleGroup(group.key)}
                              className="bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 cursor-pointer select-none border-t border-b border-slate-200 dark:border-slate-700 transition-colors"
                            >
                              <td colSpan={2} className="px-4 py-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-rose-500" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-slate-400" />
                                    )}
                                    <span>{isAr ? group.labelAr : group.labelEn}</span>
                                    <Badge variant="outline" className="text-[10px] bg-background text-muted-foreground border-slate-300">
                                      {group.categories.length} {isAr ? 'بنود' : 'items'}
                                    </Badge>
                                  </div>

                                  <div className="text-xs font-extrabold text-rose-700 dark:text-rose-400">
                                    {isAr ? 'مجموع المجموعة:' : 'Group Total:'}{' '}
                                    <span className="font-mono">{formatSAR(subtotal)} ر.س</span>
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {/* Group Categories */}
                            {isExpanded &&
                              group.categories.map((cat, i) => {
                                const val = draft.expenses[cat.key as ExpenseCategoryKey] || 0;
                                const pctOfTotal = totalExpenses > 0 ? Math.round((val / totalExpenses) * 100) : 0;

                                return (
                                  <tr
                                    key={cat.key}
                                    className={`transition-colors hover:bg-rose-50/40 dark:hover:bg-rose-950/20 border-b border-slate-100 dark:border-slate-800 ${
                                      i % 2 === 0 ? 'bg-background' : 'bg-slate-50/30 dark:bg-slate-900/10'
                                    }`}
                                  >
                                    <td className="px-4 py-2.5 pr-8 align-middle">
                                      <div className="space-y-1">
                                        <div className="font-medium text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                                          {isAr ? cat.labelAr : cat.labelEn}
                                        </div>
                                        {val > 0 && totalExpenses > 0 && (
                                          <div className="flex items-center gap-2 max-w-xs">
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                              <div
                                                className="bg-rose-500 h-full rounded-full transition-all"
                                                style={{ width: `${pctOfTotal}%` }}
                                              />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                                              {pctOfTotal}%
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 align-middle">
                                      <NumInput
                                        value={draft.expenses[cat.key as ExpenseCategoryKey]}
                                        onChange={v => setExpense(cat.key as ExpenseCategoryKey, v)}
                                        disabled={!canEdit}
                                        isIncome={false}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-rose-50 dark:bg-rose-950/50 font-bold border-t-2 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100">
                      <td className="px-4 py-3.5 text-xs sm:text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-rose-600" />
                        <span>{isAr ? 'إجمالي المصروفات النهائي' : 'Total Net Expenses'}</span>
                      </td>
                      <td className="px-4 py-3.5 text-left sm:text-right text-sm sm:text-base font-black text-rose-700 dark:text-rose-300">
                        {formatSAR(totalExpenses)} <span className="text-xs font-normal">ر.س</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Floating / Sticky Save Toolbar when modified ────────── */}
      {draft && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-[480px] z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-xs text-slate-400 font-medium">
                {currentResidence?.name} • {fiscalMonth}
              </div>
              <div className="text-sm font-bold flex items-center gap-2">
                <span>{isAr ? 'الربح الصافي:' : 'Net Result:'}</span>
                <span className={`font-black ${netIncome >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {formatSAR(netIncome)} ر.س
                </span>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={loading || !canEdit}
              size="lg"
              className={`gap-2 font-bold px-6 text-white transition-all shadow-lg ${
                isDirty
                  ? 'bg-emerald-600 hover:bg-emerald-500 animate-pulse ring-2 ring-emerald-400'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <Save className="w-5 h-5" />
              <span>{isAr ? 'حفظ البيانات' : 'Save Statement'}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IncomeExpensesPage() {
  return (
    <FinancialsProvider>
      <IncomeExpensesContent />
    </FinancialsProvider>
  );
}
