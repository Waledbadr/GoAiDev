'use client';

import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  Calendar,
  DollarSign,
  User,
  Phone,
  Mail,
  RefreshCw,
  Printer,
  FileText,
  Trash2,
  PauseCircle,
  PlayCircle,
  Clock,
  Sparkles,
  Edit,
  Layers,
  History,
  Receipt,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import {
  type Contract,
  type ContractInvoice,
  type ContractChange,
  getContractTypeInfo,
  getContractStatusLabel,
  getBillingTypeLabel,
  getRenewalTypeLabel,
  formatSAR,
  getMonthlyValue,
} from '@/types/contracts';
import { useContracts } from '@/context/contracts-context';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, parseISO, format } from 'date-fns';

interface ContractInspectorSheetProps {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (contract: Contract) => void;
  onQuickRenew: (contract: Contract) => void;
  onPrint: (contract: Contract) => void;
}

export function ContractInspectorSheet({
  contract,
  open,
  onOpenChange,
  onEdit,
  onQuickRenew,
  onPrint,
}: ContractInspectorSheetProps) {
  const {
    getInvoicesByContract,
    updateInvoiceStatus,
    generateInvoice,
    loadContractHistory,
    suspendContract,
    activateContract,
    archiveContract,
  } = useContracts();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'history'>('overview');
  const [history, setHistory] = useState<ContractChange[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  useEffect(() => {
    if (contract && open) {
      setLoadingHistory(true);
      loadContractHistory(contract.id)
        .then((res) => setHistory(res || []))
        .catch(() => setHistory([]))
        .finally(() => setLoadingHistory(false));
    }
  }, [contract, open]);

  if (!contract) return null;

  const typeInfo = getContractTypeInfo(contract.contractType);
  const isRev = contract.contractCategory === 'revenue';
  const vatAmount = (contract.billingRate * (contract.vatPercentage ?? 15)) / 100;
  const totalAmount = contract.billingRate + vatAmount;
  const monthlyVal = getMonthlyValue(contract);
  const contractInvoices = getInvoicesByContract(contract.id);

  // Timeline Progress Calculation
  let progressPct = 0;
  let remainingDays = 0;
  let totalDays = 0;
  let isExpired = false;

  if (contract.startDate && contract.endDate && !contract.isOpenEnded) {
    try {
      const start = parseISO(contract.startDate);
      const end = parseISO(contract.endDate);
      const now = new Date();
      totalDays = differenceInDays(end, start);
      remainingDays = differenceInDays(end, now);
      const elapsedDays = differenceInDays(now, start);

      if (totalDays > 0) {
        progressPct = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
      }
      if (remainingDays < 0) {
        isExpired = true;
      }
    } catch {
      // ignore
    }
  }

  const handleGenerateInvoiceNow = async () => {
    setIsGeneratingInvoice(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      await generateInvoice(contract.id, currentMonth, contract.billingRate);
      toast({
        title: 'تم إصدار الفاتورة 📄',
        description: `تم توليد فاتورة لشهر ${currentMonth} بنجاح.`,
      });
    } catch (err: any) {
      toast({
        title: 'تعذر إصدار الفاتورة',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleToggleSuspend = async () => {
    try {
      if (contract.status === 'Suspended') {
        await activateContract(contract.id);
        toast({ title: 'تم تفعيل العقد بنجاح' });
      } else {
        await suspendContract(contract.id);
        toast({ title: 'تم إيقاف العقد مؤقتاً' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleArchive = async () => {
    if (window.confirm('هل أنت متأكد من أرشفة هذا العقد؟ سيتم إخفاؤه مع حفظ فواتيره وبياناته.')) {
      try {
        await archiveContract(contract.id, 'أرشفة يدوية من لوحة المعاينة');
        toast({ title: 'تمت أرشفة العقد بنجاح' });
        onOpenChange(false);
      } catch (err: any) {
        toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-xl p-0 overflow-hidden bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50"
      >
        {/* Top Header Card */}
        <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white relative">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    isRev
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-rose-500/20 border-rose-400 text-rose-300'
                  }`}
                >
                  {isRev ? 'إيراد تعاقدي 🟢' : 'مصروف تشغيلي 🔴'}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs bg-slate-800 text-slate-300 border-slate-700"
                >
                  {getContractStatusLabel(contract.status, true)}
                </Badge>
              </div>
              <SheetTitle className="text-lg font-bold text-white tracking-tight mt-2">
                {contract.partyName}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-400">
                {typeInfo.labelAr} • {contract.contractNumber || `CNT-${contract.id.slice(0, 6).toUpperCase()}`}
              </SheetDescription>
            </div>

            {/* Monthly Value Pill */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 text-end border border-white/10 shrink-0">
              <span className="text-[10px] text-slate-400 block">القيمة الشهرية</span>
              <span className="font-extrabold text-base font-mono text-emerald-400">
                {formatSAR(monthlyVal.amount)} ر.س
              </span>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="grid grid-cols-5 gap-2 mt-5 pt-4 border-t border-white/10">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onQuickRenew(contract)}
              className="bg-white/10 hover:bg-emerald-600 border-white/15 text-white hover:text-white text-xs h-9 flex flex-col items-center justify-center p-1 rounded-xl"
            >
              <RefreshCw className="w-3.5 h-3.5 mb-0.5" />
              <span className="text-[10px]">تجديد</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateInvoiceNow}
              disabled={isGeneratingInvoice}
              className="bg-white/10 hover:bg-indigo-600 border-white/15 text-white hover:text-white text-xs h-9 flex flex-col items-center justify-center p-1 rounded-xl"
            >
              <Receipt className="w-3.5 h-3.5 mb-0.5" />
              <span className="text-[10px]">فاتورة</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onPrint(contract)}
              className="bg-white/10 hover:bg-amber-600 border-white/15 text-white hover:text-white text-xs h-9 flex flex-col items-center justify-center p-1 rounded-xl"
            >
              <Printer className="w-3.5 h-3.5 mb-0.5" />
              <span className="text-[10px]">طباعة</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(contract)}
              className="bg-white/10 hover:bg-blue-600 border-white/15 text-white hover:text-white text-xs h-9 flex flex-col items-center justify-center p-1 rounded-xl"
            >
              <Edit className="w-3.5 h-3.5 mb-0.5" />
              <span className="text-[10px]">تعديل</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleSuspend}
              className="bg-white/10 hover:bg-rose-600 border-white/15 text-white hover:text-white text-xs h-9 flex flex-col items-center justify-center p-1 rounded-xl"
            >
              {contract.status === 'Suspended' ? (
                <>
                  <PlayCircle className="w-3.5 h-3.5 mb-0.5 text-emerald-400" />
                  <span className="text-[10px]">تفعيل</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-3.5 h-3.5 mb-0.5" />
                  <span className="text-[10px]">إيقاف</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50 dark:bg-slate-900/50">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full"
          >
            <TabsList className="bg-transparent border-none p-0 h-11 gap-6">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent rounded-none px-1 text-xs font-semibold"
              >
                نظرة شاملة 📋
              </TabsTrigger>
              <TabsTrigger
                value="invoices"
                className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent rounded-none px-1 text-xs font-semibold"
              >
                الفواتير والدفعات ({contractInvoices.length}) 💳
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent rounded-none px-1 text-xs font-semibold"
              >
                سجل التغييرات ({history.length}) ⏱️
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tab Contents Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-start" dir="rtl">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Timeline Progress Card */}
              {!contract.isOpenEnded && contract.endDate && (
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-500" />
                      الجدول الزمني للعقد
                    </span>
                    <span
                      className={`font-bold ${
                        isExpired
                          ? 'text-rose-600'
                          : remainingDays <= 30
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {isExpired
                        ? 'منتهي الصلاحية'
                        : `متبقي ${remainingDays} يوماً`}
                    </span>
                  </div>

                  <Progress value={progressPct} className="h-2 rounded-full" />

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>البداية: {contract.startDate}</span>
                    <span>النهاية: {contract.endDate}</span>
                  </div>
                </div>
              )}

              {/* Financial Summary Matrix */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  الهيكل المالي والفوترة
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <span className="text-slate-500 block">طريقة الفوترة:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {getBillingTypeLabel(contract.billingType, true)}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <span className="text-slate-500 block">القيمة قبل الضريبة:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                      {formatSAR(contract.billingRate)} ر.س
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <span className="text-slate-500 block">ضريبة القيمة المضافة:</span>
                    <span className="font-bold font-mono text-amber-600">
                      {formatSAR(vatAmount)} ر.س ({contract.vatPercentage ?? 15}%)
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-xs space-y-1">
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold block">
                      الإجمالي المستحق:
                    </span>
                    <span className="font-extrabold font-mono text-emerald-600 dark:text-emerald-300">
                      {formatSAR(totalAmount)} ر.س
                    </span>
                  </div>
                </div>
              </div>

              {/* Linked Properties / Residences */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  المواقع والسكنات المشمولة بالعقد ({contract.linkedResidences?.length || 0})
                </h4>

                <div className="flex flex-wrap gap-2">
                  {contract.linkedResidences && contract.linkedResidences.length > 0 ? (
                    (contract.linkedResidenceNames || contract.linkedResidences).map((res, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-xs py-1 px-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      >
                        📍 {res}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">لا توجد سكنات محددة</span>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-2">
                  <User className="w-4 h-4 text-slate-600" />
                  بيانات التواصل والمسؤول
                </h4>
                <div className="grid grid-cols-2 gap-3 text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-slate-400 block text-[11px]">الممثل:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {contract.partyContact || '---'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">الهاتف:</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">
                      {contract.partyPhone || '---'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">البريد:</span>
                    <span className="text-slate-900 dark:text-slate-100 truncate block">
                      {contract.partyEmail || '---'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">مشرف العقد:</span>
                    <span className="text-slate-900 dark:text-slate-100">
                      {contract.contractManager || '---'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Renewal Policies */}
              <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-950 dark:text-indigo-200">
                    سياسة التجديد:
                  </span>
                  <Badge variant="outline" className="text-indigo-700 dark:text-indigo-300 border-indigo-300">
                    {getRenewalTypeLabel(contract.renewalType, true)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                  <span>التجديد التلقائي:</span>
                  <span>{contract.autoRenew ? 'مفعل آلياً ⚡' : 'غير مفعل (يدوي)'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                  <span>فترة الإشعار المسبق:</span>
                  <span>{contract.noticePeriodDays || 30} يوماً قبل الانتهاء</span>
                </div>
              </div>

              {/* Notes */}
              {contract.notes && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    ملاحظات وشروط إضافية:
                  </h4>
                  <p className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-200 dark:border-slate-700">
                    {contract.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INVOICES */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    سجل الفواتير الصادرة
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    متابعة الفواتير والتحصيل المالي لهذا العقد
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleGenerateInvoiceNow}
                  disabled={isGeneratingInvoice}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إصدار فاتورة جديدة
                </Button>
              </div>

              {contractInvoices.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    لا توجد فواتير مصدرة حتى الآن
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    يمكنك إصدار أول فاتورة بالضغط على الزر أعلاه
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {contractInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 transition-all flex items-center justify-between text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            شهر {inv.month}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              inv.status === 'Paid'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : inv.status === 'Overdue'
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : 'bg-blue-50 text-blue-700 border-blue-300'
                            }`}
                          >
                            {inv.status === 'Paid'
                              ? 'مدفوعة'
                              : inv.status === 'Overdue'
                              ? 'متأخرة'
                              : 'مصدرة'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          رقم: {inv.invoiceNumber || inv.id.slice(0, 8)} • صدرت في:{' '}
                          {inv.issuedAt?.split('T')[0]}
                        </p>
                      </div>

                      <div className="text-end space-y-1">
                        <span className="font-bold font-mono text-slate-900 dark:text-slate-100 text-sm">
                          {formatSAR(inv.amount)} ر.س
                        </span>
                        <div className="flex items-center gap-1 justify-end">
                          {inv.status !== 'Paid' && (
                            <button
                              type="button"
                              onClick={() => updateInvoiceStatus(inv.id, 'Paid')}
                              className="text-[10px] text-emerald-600 hover:underline font-medium"
                            >
                              تسجيل كمدفوعة ✓
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AUDIT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  سجل التعديلات والعمليات التاريخية
                </h4>
                <p className="text-[11px] text-slate-500">
                  توثيق دقيق لكل عملية إنشاء أو تعديل أو تجديد
                </p>
              </div>

              {loadingHistory ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  جاري تحميل السجل التاريخي...
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                  لا توجد سجلات تعديل مسجلة
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:right-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {history.map((h) => (
                    <div key={h.id} className="relative pr-8 text-xs space-y-1">
                      <div className="absolute right-1.5 top-1.5 w-3 h-3 rounded-full bg-indigo-600 ring-4 ring-white dark:ring-slate-900" />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {h.action === 'created'
                            ? 'إنشاء العقد لأول مرة'
                            : h.action === 'renewed'
                            ? 'تجديد العقد'
                            : h.action === 'suspended'
                            ? 'إيقاف مؤقت'
                            : h.action === 'activated'
                            ? 'تفعيل العقد'
                            : 'تحديث الشروط المالية/الزمنية'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {h.at ? h.at.split('T')[0] : ''}
                        </span>
                      </div>
                      {h.changes && h.changes.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                          {h.changes.map((c, idx) => (
                            <div key={idx} className="text-slate-600 dark:text-slate-400">
                              <span className="font-semibold">{c.field}:</span>{' '}
                              <span className="line-through text-rose-500">{String(c.before)}</span>{' '}
                              → <span className="text-emerald-500 font-bold">{String(c.after)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Danger Zone Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleArchive}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            أرشفة العقد
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            إغلاق
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
