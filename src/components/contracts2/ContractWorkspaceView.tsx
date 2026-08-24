'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  Building2,
  Users,
  Home,
  Wrench,
  Droplets,
  Store,
  Flame,
  Calendar,
  DollarSign,
  Search,
  Filter,
  RefreshCw,
  Printer,
  FileText,
  Trash2,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  Plus,
  ArrowRight,
  ShieldCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Calculator,
  User,
  Phone,
  Mail,
  Zap,
  Paperclip,
  Layers,
  Copy,
  SlidersHorizontal,
} from 'lucide-react';
import {
  type Contract,
  type ContractFormData,
  type BillingType,
  type ContractType,
  CONTRACT_TYPES,
  getContractTypeInfo,
  getContractStatusLabel,
  getBillingTypeLabel,
  getRenewalTypeLabel,
  formatSAR,
  getMonthlyValue,
} from '@/types/contracts';
import { useContracts } from '@/context/contracts-context';
import { useAccommodation } from '@/context/accommodation-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { InlineNewContractDraft } from './InlineNewContractDraft';
import { ContractPrintView } from './ContractPrintView';
import { ContractAddendaAndAttachments } from './ContractAddendaAndAttachments';
import { ContractContextMenu } from './ContractContextMenu';
import { EditLinkedResidencesDialog } from '@/components/contracts/EditLinkedResidencesDialog';
import { differenceInDays, parseISO, addMonths, addYears, format } from 'date-fns';

export function ContractWorkspaceView() {
  const {
    contracts,
    invoices,
    updateContract,
    createContract,
    renewContract,
    suspendContract,
    activateContract,
    archiveContract,
    generateInvoice,
    updateInvoiceStatus,
    getInvoicesByContract,
  } = useContracts();
  const { residences } = useAccommodation();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const { toast } = useToast();

  // Active Selected Contract ID & Mode
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDraftingNew, setIsDraftingNew] = useState(false);
  const [printingContract, setPrintingContract] = useState<Contract | null>(null);
  const [residenceEditContract, setResidenceEditContract] = useState<Contract | null>(null);

  // Context Menu State
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuContract, setContextMenuContract] = useState<Contract | null>(null);

  // Search, Filter & Deduplication
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'revenue' | 'expense'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hideDuplicates, setHideDuplicates] = useState(true);

  // Editable Form State for Selected Contract
  const [editState, setEditState] = useState<{
    billingRate: number;
    billingType: BillingType;
    vatPercentage: number;
    startDate: string;
    endDate: string;
    notes: string;
    contractManager: string;
    targetWorkers: number;
  }>({
    billingRate: 0,
    billingType: 'fixed_monthly',
    vatPercentage: 15,
    startDate: '',
    endDate: '',
    notes: '',
    contractManager: '',
    targetWorkers: 0,
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  // Helper to get real residence names
  const getResidenceName = (id: string) => {
    const r = residences.find((item) => item.id === id);
    return r ? r.name : id;
  };

  // Filter and Deduplication Logic
  const filteredList = useMemo(() => {
    const rawList = contracts.filter((c) => {
      if (c.archivedAt) return false;
      const party = (c.partyName || '').toLowerCase();
      const num = (c.contractNumber || c.id).toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch = !term || party.includes(term) || num.includes(term);
      const matchesCat = categoryFilter === 'all' || c.contractCategory === categoryFilter;
      const matchesType = typeFilter === 'all' || c.contractType === typeFilter;
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

      return matchesSearch && matchesCat && matchesType && matchesStatus;
    });

    if (!hideDuplicates) return rawList;

    // Deduplicate: Keep the primary latest contract for identical partyName + startDate + rate
    const seen = new Set<string>();
    return rawList.filter((c) => {
      // If it's a child addendum, hide from main stream when deduplicating
      if (c.contractRelationType === 'addendum' && c.parentContractId) {
        return false;
      }
      const key = `${(c.partyName || '').trim().toLowerCase()}_${c.startDate}_${c.billingRate}_${c.contractCategory}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [contracts, searchTerm, categoryFilter, typeFilter, statusFilter, hideDuplicates]);

  // Set default selected contract
  useEffect(() => {
    if (!selectedId && filteredList.length > 0 && !isDraftingNew) {
      setSelectedId(filteredList[0].id);
    }
  }, [filteredList, selectedId, isDraftingNew]);

  // Active Contract Object
  const activeContract = useMemo(() => {
    return contracts.find((c) => c.id === selectedId) || null;
  }, [contracts, selectedId]);

  // Populate Edit State when selecting a contract
  useEffect(() => {
    if (activeContract) {
      setEditState({
        billingRate: activeContract.billingRate || 0,
        billingType: activeContract.billingType || 'fixed_monthly',
        vatPercentage: activeContract.vatPercentage ?? 15,
        startDate: activeContract.startDate || '',
        endDate: activeContract.endDate || '',
        notes: activeContract.notes || '',
        contractManager: activeContract.contractManager || '',
        targetWorkers: activeContract.accommodationDetails?.targetWorkersCount || 0,
      });
      setHasUnsavedChanges(false);
    }
  }, [activeContract?.id]);

  // Handle Save Changes
  const handleSaveChanges = async () => {
    if (!activeContract) return;
    setIsSaving(true);
    try {
      await updateContract(activeContract.id, {
        billingRate: editState.billingRate,
        billingType: editState.billingType,
        vatPercentage: editState.vatPercentage,
        startDate: editState.startDate,
        endDate: editState.endDate,
        notes: editState.notes,
        contractManager: editState.contractManager,
        accommodationDetails: {
          ...activeContract.accommodationDetails,
          targetWorkersCount: editState.targetWorkers,
          dailyRatePerWorker: editState.billingRate,
        },
      });
      setHasUnsavedChanges(false);
      toast({
        title: isAr ? 'تم حفظ تعديلات العقد بنجاح ✨' : 'Contract Changes Saved ✨',
        description: isAr ? 'تم تحديث الشروط المالية والزمنية.' : 'Financial terms and timeline updated.',
      });
    } catch (err: any) {
      toast({
        title: isAr ? 'خطأ أثناء الحفظ' : 'Error saving changes',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Quick 1-Click Renew
  const handleQuickRenew = async (targetContract: Contract, months: number) => {
    try {
      const base = targetContract.endDate ? parseISO(targetContract.endDate) : new Date();
      const target = addMonths(base, months);
      const targetStr = format(target, 'yyyy-MM-dd');
      await renewContract(targetContract.id, targetStr);
      if (activeContract?.id === targetContract.id) {
        setEditState((prev) => ({ ...prev, endDate: targetStr }));
      }
      toast({
        title: isAr ? 'تم تجديد العقد فوراً ⚡' : 'Contract Renewed Instantly ⚡',
        description: isAr ? `تم التمديد حتى ${targetStr}` : `Extended until ${targetStr}`,
      });
    } catch (err: any) {
      toast({ title: isAr ? 'تعذر التجديد' : 'Failed to renew', description: err.message, variant: 'destructive' });
    }
  };

  // Quick Issue Monthly Invoice
  const handleIssueInvoiceNow = async (targetContract: Contract) => {
    setIsGeneratingInvoice(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      await generateInvoice(targetContract.id, currentMonth, targetContract.billingRate);
      toast({
        title: isAr ? 'تم إصدار الفاتورة 📄' : 'Invoice Generated 📄',
        description: isAr ? `فاتورة شهر ${currentMonth} أصبحت جاهزة ومسجلة.` : `Invoice for ${currentMonth} created.`,
      });
    } catch (err: any) {
      toast({ title: isAr ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Toggle Suspend / Active
  const handleToggleSuspend = async (targetContract: Contract) => {
    try {
      if (targetContract.status === 'Suspended') {
        await activateContract(targetContract.id);
        toast({ title: isAr ? 'تم تفعيل العقد بنجاح' : 'Contract Activated' });
      } else {
        await suspendContract(targetContract.id);
        toast({ title: isAr ? 'تم إيقاف العقد مؤقتاً' : 'Contract Suspended' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Archive Contract
  const handleArchive = async (targetContract: Contract) => {
    try {
      await archiveContract(targetContract.id);
      toast({ title: isAr ? 'تمت أرشفة العقد بنجاح' : 'Contract Archived' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Right-Click Context Menu Handler
  const handleCardContextMenu = (e: React.MouseEvent, contract: Contract) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuContract(contract);
  };

  const activeInvoices = activeContract ? getInvoicesByContract(activeContract.id) : [];
  const typeInfo = activeContract ? getContractTypeInfo(activeContract.contractType) : null;
  const isRev = activeContract?.contractCategory === 'revenue';

  const liveMonthly = useMemo(() => {
    if (!activeContract) return { monthly: 0, vat: 0, total: 0 };
    const rate = Number(editState.billingRate) || 0;
    const vat = (rate * (editState.vatPercentage || 15)) / 100;
    const total = rate + vat;

    let m = 0;
    if (editState.billingType === 'fixed_monthly') m = total;
    else if (editState.billingType === 'fixed_yearly') m = total / 12;
    else if (editState.billingType === 'per_person_per_day') {
      m = rate * (editState.targetWorkers || 0) * 30 * (1 + (editState.vatPercentage || 15) / 100);
    } else if (editState.billingType === 'per_person_per_month') {
      m = rate * (editState.targetWorkers || 0) * (1 + (editState.vatPercentage || 15) / 100);
    }

    return { monthly: m, vat, total };
  }, [activeContract, editState]);

  let progress = 0;
  let daysRemaining = 0;
  let isExp = false;
  if (activeContract && activeContract.startDate && editState.endDate && !activeContract.isOpenEnded) {
    try {
      const start = parseISO(activeContract.startDate);
      const end = parseISO(editState.endDate);
      const now = new Date();
      const total = differenceInDays(end, start);
      daysRemaining = differenceInDays(end, now);
      const elapsed = differenceInDays(now, start);
      if (total > 0) progress = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
      if (daysRemaining < 0) isExp = true;
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-start relative"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* ================= STREAM PANEL (4 COLUMNS) ================= */}
      <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Stream Top Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              {isAr ? 'تدفق العقود المباشر' : 'Contracts Stream'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {isAr ? 'اضغط بزر الفأرة الأيمن لأي عقد لفتح قائمة الإجراءات السريعة ⚡' : 'Right-click any contract for instant actions ⚡'}
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setSelectedId(null);
              setIsDraftingNew(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 h-8 px-3 rounded-xl shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            {isAr ? 'عقد جديد' : 'New Contract'}
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-slate-400 ${isAr ? 'right-3' : 'left-3'}`} />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isAr ? 'ابحث باسم الطرف أو رقم العقد...' : 'Search by party or contract #...'}
            className={`${isAr ? 'pr-9' : 'pl-9'} h-9 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60`}
          />
        </div>

        {/* Category Filter Chips & Deduplication Toggle */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all shrink-0 ${
                categoryFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {isAr ? 'الكل' : 'All'} ({filteredList.length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('revenue')}
              className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all shrink-0 ${
                categoryFilter === 'revenue'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
            >
              {isAr ? 'إيراد 🟢' : 'Revenue 🟢'}
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('expense')}
              className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all shrink-0 ${
                categoryFilter === 'expense'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              {isAr ? 'مصروف 🔴' : 'Expense 🔴'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setHideDuplicates(!hideDuplicates)}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all flex items-center gap-1 shrink-0 ${
              hideDuplicates
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
            title={isAr ? 'إخفاء العقود المكررة وتجميع الملاحق' : 'Deduplicate & Group Addenda'}
          >
            <Copy className="w-3 h-3" />
            <span>{isAr ? (hideDuplicates ? 'منقّح ✓' : 'إظهار الكل') : (hideDuplicates ? 'Cleaned ✓' : 'All')}</span>
          </button>
        </div>

        {/* Contracts Scrollable List */}
        <div className="space-y-3 max-h-[660px] overflow-y-auto pr-1">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              {isAr ? 'لا توجد عقود مطابقة' : 'No matching contracts found'}
            </div>
          ) : (
            filteredList.map((contract) => {
              const isSelected = selectedId === contract.id && !isDraftingNew;
              const type = getContractTypeInfo(contract.contractType);
              const isRevItem = contract.contractCategory === 'revenue';
              const monthlyVal = getMonthlyValue(contract);

              // Check linked residences
              const linkedResList = (contract.linkedResidences || []).map(getResidenceName);

              // Status calculation
              const isContractExp = contract.status === 'Expired' || (contract.endDate && parseISO(contract.endDate) < new Date() && !contract.isOpenEnded);
              const isContractSusp = contract.status === 'Suspended';
              const daysLeft = contract.endDate && !contract.isOpenEnded ? differenceInDays(parseISO(contract.endDate), new Date()) : null;
              const isSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

              return (
                <div
                  key={contract.id}
                  onClick={() => {
                    setIsDraftingNew(false);
                    setSelectedId(contract.id);
                  }}
                  onContextMenu={(e) => handleCardContextMenu(e, contract)}
                  className={`cursor-pointer p-4 rounded-2xl border transition-all text-xs space-y-2.5 relative ${
                    isSelected
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {/* Header Row: Party Name & Monthly Value */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block truncate text-sm">
                        {contract.partyName}
                      </span>
                      <p className="text-[11px] text-slate-500 truncate">
                        {isAr ? type.labelAr : type.labelEn} • {contract.contractNumber || `CNT-${contract.id.slice(0, 6).toUpperCase()}`}
                      </p>
                    </div>

                    <div className={isAr ? 'text-end shrink-0' : 'text-right shrink-0'}>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block text-xs">
                        {formatSAR(monthlyVal.amount)} SAR
                      </span>
                      <span className="text-[9px] text-slate-400">{isAr ? 'شهرياً' : '/ month'}</span>
                    </div>
                  </div>

                  {/* Status & Addendum Indicators */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Primary Status Badge */}
                    <Badge
                      variant="outline"
                      className={`text-[9px] py-0 font-bold ${
                        isContractSusp
                          ? 'bg-slate-100 text-slate-700 border-slate-300'
                          : isContractExp
                          ? 'bg-rose-50 text-rose-700 border-rose-300'
                          : isSoon
                          ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      }`}
                    >
                      {isContractSusp
                        ? (isAr ? '⏸️ موقوف' : '⏸️ Suspended')
                        : isContractExp
                        ? (isAr ? '🔴 منتهي' : '🔴 Expired')
                        : isSoon
                        ? (isAr ? `⏳ ينتهي قريباً (${daysLeft} يوم)` : `⏳ Expiring Soon (${daysLeft}d)`)
                        : (isAr ? '🟢 ساري ونشط' : '🟢 Active')}
                    </Badge>

                    {/* Category Badge */}
                    <Badge
                      variant="outline"
                      className={`text-[9px] py-0 ${
                        isRevItem
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-rose-50 text-rose-700 border-rose-300'
                      }`}
                    >
                      {isRevItem ? (isAr ? 'إيراد' : 'Revenue') : (isAr ? 'مصروف' : 'Expense')}
                    </Badge>

                    {/* Addendum / Primary indicator */}
                    {contract.contractRelationType === 'addendum' && (
                      <Badge variant="outline" className="text-[9px] py-0 bg-purple-50 text-purple-700 border-purple-300">
                        📑 {isAr ? 'ملحق عقد' : 'Addendum'}
                      </Badge>
                    )}

                    {/* Attachment Icon */}
                    {(contract.attachments?.length || (contract as any).attachmentUrl) && (
                      <Badge variant="outline" className="text-[9px] py-0 bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-0.5">
                        <Paperclip className="w-2.5 h-2.5" />
                        PDF
                      </Badge>
                    )}
                  </div>

                  {/* Prominent Linked Residences Badges on the Card */}
                  <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex flex-wrap items-center gap-1">
                      {linkedResList.length > 0 ? (
                        linkedResList.map((resName, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setResidenceEditContract(contract);
                            }}
                            className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 py-0.5 px-2 cursor-pointer transition-colors"
                            title={isAr ? 'اضغط لتعديل السكنات المربوطة' : 'Click to edit linked camps'}
                          >
                            📍 {resName}
                          </Badge>
                        ))
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setResidenceEditContract(contract);
                          }}
                          className="text-[10px] text-amber-600 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-300 rounded-lg px-2 py-0.5 flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>{isAr ? 'تعيين سكن لهذا العقد' : 'Assign Camp'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expiration Date Footer */}
                  <div className="flex items-center justify-between text-[10px] pt-1 text-slate-500">
                    <span>
                      {isAr ? 'ينتهي: ' : 'Expires: '}{' '}
                      <strong className="font-mono">{contract.isOpenEnded ? (isAr ? 'مفتوح' : 'Open') : contract.endDate}</strong>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {isAr ? 'زر الماوس اليمين ⚡' : 'Right-click for menu ⚡'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================= DOSSIER WORKSPACE (8 COLUMNS) ================= */}
      <div className="lg:col-span-8 space-y-6">
        {isDraftingNew ? (
          <InlineNewContractDraft
            onCancel={() => {
              setIsDraftingNew(false);
              if (filteredList.length > 0) setSelectedId(filteredList[0].id);
            }}
            onSuccess={(newId) => {
              setIsDraftingNew(false);
              setSelectedId(newId);
            }}
            onSave={createContract}
          />
        ) : activeContract ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-6 animate-in fade-in duration-150">
            {/* Dossier Top Banner */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white relative">
              <div className="flex flex-wrap items-start justify-between gap-4">
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
                      {isRev ? (isAr ? 'عقد إيرادي 🟢' : 'Revenue Contract 🟢') : (isAr ? 'عقد تشغيلي مصروف 🔴' : 'Operating Expense 🔴')}
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-slate-800 text-slate-300 border-slate-700">
                      {getContractStatusLabel(activeContract.status, isAr)}
                    </Badge>
                    {activeContract.contractRelationType === 'addendum' && (
                      <Badge variant="outline" className="text-xs bg-purple-500/20 text-purple-300 border-purple-400">
                        📑 {isAr ? 'ملحق عقد' : 'Addendum'}
                      </Badge>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-white tracking-tight mt-2">
                    {activeContract.partyName}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {isAr ? typeInfo?.labelAr : typeInfo?.labelEn} • {isAr ? 'رقم العقد: ' : 'Contract #: '}
                    <span className="font-mono text-slate-200">
                      {activeContract.contractNumber || `CNT-${activeContract.id.slice(0, 6).toUpperCase()}`}
                    </span>
                  </p>
                </div>

                {/* Monthly Equivalent Pill */}
                <div className={`bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 shrink-0 ${isAr ? 'text-end' : 'text-right'}`}>
                  <span className="text-[11px] text-slate-300 block">
                    {isAr ? 'التدفق الشهري الفعلي' : 'Effective Monthly Flow'}
                  </span>
                  <span className="font-extrabold text-xl font-mono text-emerald-400">
                    {formatSAR(liveMonthly.monthly)} SAR
                  </span>
                  <span className="text-[10px] text-slate-400 block">{isAr ? 'شامل الضريبة 15%' : 'Incl. 15% VAT'}</span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 mt-6 pt-4 border-t border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleIssueInvoiceNow(activeContract)}
                    disabled={isGeneratingInvoice}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 h-9 px-4 rounded-xl shadow-sm"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    {isAr ? 'إصدار فاتورة الشهر 📄' : 'Issue Monthly Invoice 📄'}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPrintingContract(activeContract)}
                    className="bg-white/10 hover:bg-amber-600 border-white/20 text-white text-xs gap-1.5 h-9 px-3.5 rounded-xl"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    {isAr ? 'طباعة السند الرسمي 🖨️' : 'Print Agreement 🖨️'}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResidenceEditContract(activeContract)}
                    className="bg-white/10 hover:bg-blue-600 border-white/20 text-white text-xs gap-1.5 h-9 px-3.5 rounded-xl"
                  >
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    {isAr ? 'تعيين السكنات 📍' : 'Link Camps 📍'}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleSuspend(activeContract)}
                    className="bg-white/10 hover:bg-rose-600 border-white/20 text-white text-xs gap-1.5 h-9 px-3.5 rounded-xl"
                  >
                    {activeContract.status === 'Suspended' ? (
                      <>
                        <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                        {isAr ? 'تفعيل العقد' : 'Activate Contract'}
                      </>
                    ) : (
                      <>
                        <PauseCircle className="w-3.5 h-3.5" />
                        {isAr ? 'إيقاف مؤقت' : 'Suspend'}
                      </>
                    )}
                  </Button>
                </div>

                {hasUnsavedChanges && (
                  <Button
                    size="sm"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-9 px-5 rounded-xl shadow-lg shadow-emerald-600/30 animate-pulse"
                  >
                    <Check className="w-4 h-4" />
                    {isSaving
                      ? (isAr ? 'جاري الحفظ...' : 'Saving...')
                      : (isAr ? 'حفظ التعديلات الحالية 💾' : 'Save Changes 💾')}
                  </Button>
                )}
              </div>
            </div>

            {/* Dossier Body Content */}
            <div className="p-6 space-y-6">
              {/* SECTION 1: Interactive Duration Timeline & 1-Click Renewal */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {isAr ? 'المدة وسريان العقد' : 'Contract Duration & Timeline'}
                    </span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-md ${
                        isExp
                          ? 'bg-rose-100 text-rose-700'
                          : daysRemaining <= 30
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isExp
                        ? (isAr ? 'منتهي الصلاحية' : 'Expired')
                        : (isAr ? `متبقي ${daysRemaining} يوماً` : `${daysRemaining} days remaining`)}
                    </span>
                  </div>

                  {/* 1-Click Renewal Fast Pills */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">{isAr ? 'تمديد فوري:' : 'Quick Extend:'}</span>
                    <button
                      type="button"
                      onClick={() => handleQuickRenew(activeContract, 1)}
                      className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 rounded-lg text-[10px] font-semibold hover:border-emerald-500 hover:text-emerald-600 transition-all"
                    >
                      +1 {isAr ? 'شهر' : 'Mo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickRenew(activeContract, 3)}
                      className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 rounded-lg text-[10px] font-semibold hover:border-emerald-500 hover:text-emerald-600 transition-all"
                    >
                      +3 {isAr ? 'أشهر' : 'Mos'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickRenew(activeContract, 12)}
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-all shadow-sm"
                    >
                      +1 {isAr ? 'سنة كاملة ⚡' : 'Year ⚡'}
                    </button>
                  </div>
                </div>

                <Progress value={progress} className="h-2 rounded-full" />

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <Label className="text-[11px] text-slate-400 block mb-1">{isAr ? 'تاريخ البدء' : 'Start Date'}</Label>
                    <Input
                      type="date"
                      value={editState.startDate}
                      onChange={(e) => {
                        setEditState({ ...editState, startDate: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="h-9 text-xs bg-white dark:bg-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-400 block mb-1">{isAr ? 'تاريخ الانتهاء' : 'End Date'}</Label>
                    <Input
                      type="date"
                      value={editState.endDate}
                      onChange={(e) => {
                        setEditState({ ...editState, endDate: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="h-9 text-xs bg-white dark:bg-slate-900 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Dynamic Pricing & Worker Headcount Simulator */}
              <div className="p-5 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    {isAr ? 'الشروط المالية ومحاكي احتساب الإشغال' : 'Financial Structure & Occupancy Calculator'}
                  </h3>
                  <Badge variant="outline" className="text-indigo-700 dark:text-indigo-300 border-indigo-300 text-xs">
                    {getBillingTypeLabel(editState.billingType, isAr)}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold block mb-1">{isAr ? 'القيمة التعاقدية (ر.س)' : 'Billing Rate (SAR)'}</Label>
                    <Input
                      type="number"
                      value={editState.billingRate}
                      onChange={(e) => {
                        setEditState({ ...editState, billingRate: Number(e.target.value) });
                        setHasUnsavedChanges(true);
                      }}
                      className="h-10 text-xs font-mono font-bold bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold block mb-1">{isAr ? 'طريقة الفوترة' : 'Billing Method'}</Label>
                    <Select
                      value={editState.billingType}
                      onValueChange={(val: any) => {
                        setEditState({ ...editState, billingType: val });
                        setHasUnsavedChanges(true);
                      }}
                    >
                      <SelectTrigger className="h-10 text-xs bg-white dark:bg-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_person_per_day">{isAr ? 'للشخص / اليوم (تسكين عمالة)' : 'Per Person / Day'}</SelectItem>
                        <SelectItem value="fixed_monthly">{isAr ? 'مبلغ شهري ثابت' : 'Fixed Monthly'}</SelectItem>
                        <SelectItem value="fixed_yearly">{isAr ? 'مبلغ سنوي ثابت' : 'Fixed Yearly'}</SelectItem>
                        <SelectItem value="per_person_per_month">{isAr ? 'للشخص / الشهر' : 'Per Person / Month'}</SelectItem>
                        <SelectItem value="per_invoice">{isAr ? 'حسب الفاتورة' : 'Per Invoice'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editState.billingType.includes('person') && (
                    <div>
                      <Label className="text-xs font-semibold block mb-1">
                        {isAr ? 'عدد العمالة المسكنة (المستهدفة)' : 'Target Worker Headcount'}
                      </Label>
                      <Input
                        type="number"
                        value={editState.targetWorkers}
                        onChange={(e) => {
                          setEditState({ ...editState, targetWorkers: Number(e.target.value) });
                          setHasUnsavedChanges(true);
                        }}
                        className="h-10 text-xs font-mono font-bold bg-white dark:bg-slate-900"
                      />
                    </div>
                  )}
                </div>

                {/* Realtime Calculation Matrix */}
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900/40 grid grid-cols-3 gap-3 text-center text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">{isAr ? 'القيمة الأساسية' : 'Base Rate'}</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-slate-100 text-sm">
                      {formatSAR(editState.billingRate)} SAR
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">{isAr ? 'ضريبة القيمة المضافة (15%)' : 'VAT (15%)'}</span>
                    <span className="font-bold font-mono text-amber-600 text-sm">
                      {formatSAR(liveMonthly.vat)} SAR
                    </span>
                  </div>
                  <div>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold block text-[11px]">
                      {isAr ? 'التدفق الشهري الإجمالي' : 'Total Monthly Cashflow'}
                    </span>
                    <span className="font-extrabold font-mono text-emerald-600 text-sm">
                      {formatSAR(liveMonthly.monthly)} SAR
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Linked Residences & Contract Manager */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {isAr ? 'المجمعات والسكنات المشمولة بالعقد:' : 'Linked Camps & Residences:'}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setResidenceEditContract(activeContract)}
                      className="text-[11px] h-6 text-indigo-600 hover:text-indigo-700 p-0"
                    >
                      {isAr ? 'تعديل السكنات 📍' : 'Edit Camps 📍'}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeContract.linkedResidences && activeContract.linkedResidences.length > 0 ? (
                      activeContract.linkedResidences.map((resId, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 py-1"
                        >
                          📍 {getResidenceName(resId)}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-slate-400">{isAr ? 'لا توجد سكنات محددة' : 'No specific camps assigned'}</span>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">
                    {isAr ? 'مسؤول المتابعة والتواصل:' : 'Contract Manager & Contact:'}
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isAr ? 'الممثل:' : 'Contact Person:'}</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {activeContract.partyContact || '---'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isAr ? 'الهاتف:' : 'Phone:'}</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">
                        {activeContract.partyPhone || '---'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Contract Addenda, Scanned Attachments & Guarantees */}
              <ContractAddendaAndAttachments contract={activeContract} isAr={isAr} />

              {/* SECTION 5: Invoices Ledger */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    {isAr
                      ? `دفتر الفواتير والتحصيل المالي لهذا العقد (${activeInvoices.length})`
                      : `Invoices Ledger for this Contract (${activeInvoices.length})`}
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleIssueInvoiceNow(activeContract)}
                    disabled={isGeneratingInvoice}
                    className="text-xs h-8 gap-1 text-indigo-600 hover:bg-indigo-50 border-indigo-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isAr ? 'فاتورة جديدة' : 'New Invoice'}
                  </Button>
                </div>

                {activeInvoices.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                    {isAr
                      ? 'لا توجد فواتير مصدرة حتى الآن. يمكنك الضغط على "إصدار فاتورة الشهر" أعلاه.'
                      : 'No invoices issued yet. Click "Issue Monthly Invoice" above.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {activeInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {inv.month}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] ${
                                inv.status === 'Paid'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : 'bg-blue-50 text-blue-700 border-blue-300'
                              }`}
                            >
                              {inv.status === 'Paid'
                                ? (isAr ? 'مدفوعة ✓' : 'Paid ✓')
                                : (isAr ? 'مصدرة ⏳' : 'Issued ⏳')}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {inv.invoiceNumber || inv.id.slice(0, 8)}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {formatSAR(inv.amount)} SAR
                          </span>
                          {inv.status !== 'Paid' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateInvoiceStatus(inv.id, 'Paid')}
                              className="text-emerald-600 hover:text-emerald-700 text-[11px] h-7 px-2"
                            >
                              {isAr ? 'تسجيل كمسددة ✓' : 'Mark as Paid ✓'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Label className="text-xs font-semibold">{isAr ? 'ملاحظات وشروط خاصة بالعقد:' : 'Special Terms & Notes:'}</Label>
                <Textarea
                  value={editState.notes}
                  onChange={(e) => {
                    setEditState({ ...editState, notes: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  placeholder={isAr ? 'اكتب أي بنود خاصة أو ملاحظات...' : 'Add special terms, payment terms, or notes...'}
                  rows={2}
                  className="text-xs bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
            {isAr ? 'اختر عقداً من القائمة لفتحه في مساحة العمل' : 'Select a contract from the stream to open in workspace'}
          </div>
        )}
      </div>

      {/* Floating Right-Click Context Menu */}
      <ContractContextMenu
        contract={contextMenuContract}
        position={contextMenuPosition}
        onClose={() => {
          setContextMenuPosition(null);
          setContextMenuContract(null);
        }}
        onQuickRenew={(c) => handleQuickRenew(c, 3)}
        onIssueInvoice={(c) => handleIssueInvoiceNow(c)}
        onPrint={(c) => setPrintingContract(c)}
        onEditResidences={(c) => setResidenceEditContract(c)}
        onEdit={(c) => {
          setSelectedId(c.id);
          setIsDraftingNew(false);
        }}
        onToggleSuspend={(c) => handleToggleSuspend(c)}
        onArchive={(c) => handleArchive(c)}
        isAr={isAr}
      />

      {/* Printable View Dialog */}
      <ContractPrintView
        contract={printingContract}
        open={Boolean(printingContract)}
        onOpenChange={(open) => !open && setPrintingContract(null)}
      />

      {/* Edit Linked Residences Dialog */}
      <EditLinkedResidencesDialog
        open={Boolean(residenceEditContract)}
        onOpenChange={(open) => !open && setResidenceEditContract(null)}
        contract={residenceEditContract}
        residences={residences}
        isAr={isAr}
      />
    </div>
  );
}
