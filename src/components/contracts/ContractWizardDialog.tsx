'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2, Building2, Store, Home, Wrench, Droplets, Flame, Wifi, Users,
  FileText, DollarSign, Calendar, ShieldCheck, Plus, Trash2, Search, Sparkles,
  ChevronRight, ChevronLeft, Shield, Zap, Receipt, FileSpreadsheet, UserCheck,
  Clock, RefreshCw, ChevronDown, ChevronUp, FilePlus, Layers, AlertTriangle, Info
} from 'lucide-react';
import { UnifiedDatePicker } from '@/components/ui/hijri-date-picker';
import { getHijriFromGregorian, hijriToGregorianISO } from '@/lib/hijri-date-utils';
import { useContracts } from '@/context/contracts-context';
import {
  validateContractForm,
  blockingIssues,
  issuesForStep,
  type ValidationIssue,
} from '@/lib/contract-validation';
import {
  type Contract,
  type ContractFormData,
  type ContractType,
  type BillingType,
  type PartyType,
  type ContractGuarantee,
  type RenewalType,
  CONTRACT_TYPES,
  getContractTypeInfo,
  getContractCategoryLabel,
  getBillingTypeLabel,
  getRenewalTypeLabel,
  getContractStatusLabel,
  getStatusBadge,
  formatSAR
} from '@/types/contracts';

interface ResidenceOption {
  id: string;
  name: string;
  code?: string;
}

interface CompanyOption {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
}

interface ContractWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  selectedContract?: Contract | null;
  companies: CompanyOption[];
  residences: ResidenceOption[];
  allContracts?: Contract[];
  onSubmit: (formData: ContractFormData, status?: 'Active' | 'Draft') => Promise<void>;
  isAr?: boolean;
}

const typeIcons: Record<string, React.ReactNode> = {
  Building2: <Building2 className="h-5 w-5" />,
  Home: <Home className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  Wrench: <Wrench className="h-5 w-5" />,
  Droplets: <Droplets className="h-5 w-5" />,
  Store: <Store className="h-5 w-5" />,
  Flame: <Flame className="h-5 w-5" />,
  Wifi: <Wifi className="h-5 w-5" />,
};

// 7 Primary Core Types for Step 1 selection
const CORE_TYPES: ContractType[] = [
  'lease_in',
  'lease_out',
  'accommodation_agreement',
  'service',
  'supply',
  'commercial',
  'utility',
];

// Presets for quick filling
const PRESETS = [
  {
    id: 'worker_housing',
    labelAr: 'عقد تسكين عمالة باليوم',
    labelEn: 'Worker Housing',
    type: 'accommodation_agreement' as ContractType,
    billingType: 'per_person_per_day' as BillingType,
    billingUnit: 'شخص/يوم',
    billingRate: 35,
    workers: 100,
  },
  {
    id: 'lease_in_bldg',
    labelAr: 'استئجار مبنى سكن (Lease In)',
    labelEn: 'Lease In Building',
    type: 'lease_in' as ContractType,
    billingType: 'fixed_monthly' as BillingType,
    billingUnit: 'شهري',
    billingRate: 50000,
  },
  {
    id: 'commercial_store',
    labelAr: 'تأجير محل / مطعم تجاري',
    labelEn: 'Commercial Store',
    type: 'commercial' as ContractType,
    billingType: 'fixed_monthly' as BillingType,
    billingUnit: 'شهري',
    billingRate: 4000,
  },
  {
    id: 'service_elevators',
    labelAr: 'عقد صيانة مصاعد ونظافة',
    labelEn: 'Service Contract',
    type: 'service' as ContractType,
    billingType: 'fixed_monthly' as BillingType,
    billingUnit: 'شهري',
    billingRate: 2500,
  },
  {
    id: 'utility_elec',
    labelAr: 'عقد عداد كهرباء / مرافق',
    labelEn: 'Utility Contract',
    type: 'utility' as ContractType,
    billingType: 'fixed_monthly' as BillingType,
    billingUnit: 'فاتورة',
    billingRate: 1200,
  },
];

export function ContractWizardDialog({
  open,
  onOpenChange,
  mode,
  selectedContract,
  companies,
  residences,
  allContracts: propsAllContracts,
  onSubmit,
  isAr = true,
}: ContractWizardDialogProps) {
  const context = useContracts();
  const allContracts = propsAllContracts || context?.contracts || [];

  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'revenue' | 'expense'>('all');
  const [residenceSearch, setResidenceSearch] = useState<string>('');
  const [showPreviousContracts, setShowPreviousContracts] = useState<boolean>(true);

  const initialFormData: ContractFormData = useMemo(() => ({
    title: '',
    contractNumber: `CTR-${Math.floor(100000 + Math.random() * 900000)}`,
    contractType: 'accommodation_agreement',
    contractCategory: 'revenue',
    partyType: 'company',
    partyId: '',
    partyName: '',
    partyContact: '',
    partyPhone: '',
    linkedResidences: [],
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateSystem: 'gregorian',
    isOpenEnded: false,
    currency: 'SAR',
    billingType: 'per_person_per_day',
    billingRate: 0,
    vatPercentage: 15,
    billingUnit: isAr ? 'شخص/يوم' : 'person/day',
    paymentTerms: '',
    advancePayment: 0,
    services: [],
    guarantees: [],
    leaseDetails: { propertyType: 'building', totalAreaSqm: 0, buildingName: '', unitNumbers: [] },
    accommodationDetails: { targetWorkersCount: 50, dailyRatePerWorker: 30, bedsCount: 60 },
    serviceDetails: { serviceCategory: 'صيانة ونظافة', slaResponseHours: 4, visitFrequency: 'monthly', equipmentCount: 1 },
    supplyDetails: { supplyCategory: 'water', unitPrice: 120, deliverySchedule: 'أسبوعي' },
    commercialDetails: { commercialActivity: 'grocery', concessionType: 'fixed_rent', concessionPercentage: 0 },
    utilityDetails: { utilityType: 'electricity', meterNumber: '', accountNumber: '', providerName: 'شركة الكهرباء' },
    notes: '',
    renewalType: 'manual',
    autoRenew: false,
    noticePeriodDays: 30,
    autoRenewCondition: 'تجديد العقد تلقائياً لفترة مماثلة بنفس الشروط والمبلغ ما لم يُخطِر أحد الطرفين الآخر كتابةً بعدم الرغبة بالتجديد قبل الموعد المحدد.',
    parentContractId: '',
    contractRelationType: 'new_contract',
    contractManager: '',
    accountantName: '',
  }), [isAr]);

  const [formData, setFormData] = useState<ContractFormData>(initialFormData);

  useEffect(() => {
    if (open) {
      setStep(1);
      if (mode === 'edit' && selectedContract) {
        setFormData({
          title: selectedContract.title || '',
          contractNumber: selectedContract.contractNumber || `CTR-${selectedContract.id}`,
          contractType: selectedContract.contractType,
          contractCategory: selectedContract.contractCategory,
          partyType: selectedContract.partyType,
          partyId: selectedContract.partyId,
          partyName: selectedContract.partyName,
          partyContact: selectedContract.partyContact || '',
          partyPhone: selectedContract.partyPhone || '',
          linkedResidences: selectedContract.linkedResidences || [],
          startDate: selectedContract.startDate || '',
          endDate: selectedContract.endDate || '',
          dateSystem: selectedContract.dateSystem || 'gregorian',
          isOpenEnded: selectedContract.isOpenEnded || false,
          currency: selectedContract.currency || 'SAR',
          billingType: selectedContract.billingType,
          billingRate: selectedContract.billingRate || 0,
          vatPercentage: selectedContract.vatPercentage ?? 15,
          billingUnit: selectedContract.billingUnit || '',
          paymentTerms: selectedContract.paymentTerms || '',
          advancePayment: selectedContract.advancePayment || 0,
          services: selectedContract.services || [],
          guarantees: selectedContract.guarantees || [],
          leaseDetails: selectedContract.leaseDetails || { propertyType: 'building', totalAreaSqm: 0, buildingName: '' },
          accommodationDetails: selectedContract.accommodationDetails || { targetWorkersCount: 50, dailyRatePerWorker: 30, bedsCount: 60 },
          serviceDetails: selectedContract.serviceDetails || { serviceCategory: 'صيانة ونظافة', slaResponseHours: 4, visitFrequency: 'monthly' },
          supplyDetails: selectedContract.supplyDetails || { supplyCategory: 'water', unitPrice: 120 },
          commercialDetails: selectedContract.commercialDetails || { commercialActivity: 'grocery', concessionType: 'fixed_rent' },
          utilityDetails: selectedContract.utilityDetails || { utilityType: 'electricity', meterNumber: '', accountNumber: '' },
          notes: selectedContract.notes || '',
          renewalType: selectedContract.renewalType || 'manual',
          autoRenew: selectedContract.autoRenew || false,
          noticePeriodDays: selectedContract.noticePeriodDays || 30,
          autoRenewCondition: selectedContract.autoRenewCondition || '',
          parentContractId: selectedContract.parentContractId || '',
          contractRelationType: selectedContract.contractRelationType || 'new_contract',
          contractManager: selectedContract.contractManager || '',
          accountantName: selectedContract.accountantName || '',
        });
      } else if (selectedContract && mode === 'create') {
        // Pre-fill when creating addendum or new contract for same party
        setFormData({
          ...initialFormData,
          partyType: selectedContract.partyType,
          partyId: selectedContract.partyId,
          partyName: selectedContract.partyName,
          partyContact: selectedContract.partyContact || '',
          partyPhone: selectedContract.partyPhone || '',
          linkedResidences: selectedContract.linkedResidences || [],
          parentContractId: selectedContract.parentContractId || selectedContract.id,
          contractRelationType: selectedContract.contractRelationType || 'addendum',
          title: selectedContract.title || '',
          contractNumber: selectedContract.contractNumber || initialFormData.contractNumber,
        });
      } else {
        setFormData(initialFormData);
      }
    }
  }, [open, mode, selectedContract, initialFormData]);

  const partyPreviousContracts = useMemo(() => {
    if (!formData.partyName && !formData.partyId) return [];
    const searchName = (formData.partyName || '').trim().toLowerCase();
    return allContracts.filter(c => {
      if (mode === 'edit' && selectedContract && c.id === selectedContract.id) return false;
      const matchId = formData.partyId && c.partyId === formData.partyId;
      const matchName = searchName && c.partyName.toLowerCase().includes(searchName);
      return matchId || matchName;
    });
  }, [allContracts, formData.partyId, formData.partyName, mode, selectedContract]);

  const steps = [
    { num: 1, titleAr: 'نوع العقد والتصنيف', titleEn: 'Contract Type', icon: FileText },
    { num: 2, titleAr: 'الطرف الآخر والمباني', titleEn: 'Party & Properties', icon: Building2 },
    { num: 3, titleAr: 'البيانات الديناميكية والفوترة', titleEn: 'Dynamic Specs & Billing', icon: DollarSign },
    { num: 4, titleAr: 'المدة والضمانات والمسؤولين', titleEn: 'Duration, Guarantees & Roles', icon: Calendar },
    { num: 5, titleAr: 'المراجعة والإنشاء', titleEn: 'Review & Confirm', icon: ShieldCheck },
  ];

  const handleTypeChange = (type: ContractType) => {
    const info = getContractTypeInfo(type);
    setFormData(prev => ({
      ...prev,
      contractType: type,
      contractCategory: info.category,
      billingType: info.defaultBillingType,
      billingUnit: info.defaultBillingUnit,
      services: info.hasServices ? (prev.services && prev.services.length > 0 ? prev.services : [{ name: '', rate: 0, frequency: 'monthly' }]) : [],
    }));
  };

  const handlePartyChange = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (company) {
      setFormData(prev => ({
        ...prev,
        partyId: company.id,
        partyName: company.name,
        partyContact: company.contactEmail || prev.partyContact,
        partyPhone: company.contactPhone || prev.partyPhone,
      }));
    }
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    handleTypeChange(preset.type);
    setFormData(prev => ({
      ...prev,
      billingType: preset.billingType,
      billingUnit: preset.billingUnit,
      billingRate: preset.billingRate,
      accommodationDetails: preset.workers ? { ...prev.accommodationDetails, targetWorkersCount: preset.workers, dailyRatePerWorker: preset.billingRate } : prev.accommodationDetails,
    }));
  };

  const toggleResidence = (id: string) => {
    setFormData(prev => ({
      ...prev,
      linkedResidences: prev.linkedResidences.includes(id)
        ? prev.linkedResidences.filter(rId => rId !== id)
        : [...prev.linkedResidences, id],
    }));
  };

  const setDuration = (months: number, years: number = 0) => {
    if (!formData.startDate) return;

    if (formData.dateSystem === 'hijri') {
      const hijriInfo = getHijriFromGregorian(formData.startDate);
      if (hijriInfo) {
        let { year, month, day } = hijriInfo;
        year += years;
        month += months;
        while (month > 12) {
          month -= 12;
          year += 1;
        }
        while (month < 1) {
          month += 12;
          year -= 1;
        }
        const newGregorianISO = hijriToGregorianISO(year, month, day);
        setFormData(prev => ({
          ...prev,
          endDate: newGregorianISO,
          isOpenEnded: false,
        }));
        return;
      }
    }

    // Gregorian calculation
    const start = new Date(formData.startDate);
    if (!isNaN(start.getTime())) {
      if (years) start.setFullYear(start.getFullYear() + years);
      if (months) start.setMonth(start.getMonth() + months);
      setFormData(prev => ({
        ...prev,
        endDate: start.toISOString().split('T')[0],
        isOpenEnded: false,
      }));
    }
  };

  // VAT calculations
  const vatAmount = useMemo(() => {
    const rate = formData.billingRate || 0;
    const vatPct = formData.vatPercentage || 0;
    return (rate * vatPct) / 100;
  }, [formData.billingRate, formData.vatPercentage]);

  const totalWithVat = useMemo(() => {
    return (formData.billingRate || 0) + vatAmount;
  }, [formData.billingRate, vatAmount]);

  // Primary contract type cards filtered
  const filteredPrimaryTypes = useMemo(() => {
    const primaryInfoList = CORE_TYPES.map(t => getContractTypeInfo(t));
    if (categoryFilter === 'all') return primaryInfoList;
    return primaryInfoList.filter(t => t.category === categoryFilter);
  }, [categoryFilter]);

  const filteredResidences = useMemo(() => {
    if (!residenceSearch.trim()) return residences;
    const q = residenceSearch.toLowerCase();
    return residences.filter(r => r.name.toLowerCase().includes(q) || (r.code && r.code.toLowerCase().includes(q)));
  }, [residences, residenceSearch]);

  const handleFinalSubmit = async (status: 'Active' | 'Draft' = 'Active') => {
    try {
      setIsSubmitting(true);
      await onSubmit(formData, status);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to submit contract wizard:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const issues = useMemo<ValidationIssue[]>(
    () =>
      validateContractForm(formData, {
        existingContracts: allContracts,
        excludeId: mode === 'edit' ? selectedContract?.id : undefined,
      }),
    [formData, allContracts, mode, selectedContract]
  );

  const errors = useMemo(() => blockingIssues(issues), [issues]);
  const warnings = useMemo(() => issues.filter(i => i.severity === 'warning'), [issues]);

  // كل خطوة تُغلق على أخطائها فقط: منع التقدّم بسبب حقل في خطوة لاحقة لم
  // يزرها المستخدم بعد يترك الزر معطلاً بلا سبب ظاهر.
  const canGoNext = useMemo(() => {
    if (step === 1) return !!formData.contractType;
    return blockingIssues(issuesForStep(issues, step)).length === 0;
  }, [step, formData.contractType, issues]);

  const canSubmit = errors.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 border-primary/20 shadow-2xl">
        {/* Header with Stepper */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary-foreground border-primary/30">
                  {mode === 'edit' ? (isAr ? 'تعديل عقد' : 'Edit Contract') : (isAr ? 'عقد جديد' : 'New Contract')}
                </Badge>
                <span className="text-xs text-slate-400">
                  {isAr ? `الخطوة ${step} من 5` : `Step ${step} of 5`}
                </span>
                {formData.contractNumber && (
                  <span className="text-xs font-mono text-amber-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {formData.contractNumber}
                  </span>
                )}
              </div>
              <DialogTitle className="text-xl font-bold mt-1 text-white flex items-center gap-2">
                {steps[step - 1].titleAr}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {isAr ? 'معالج إنشاء وإدارة العقود النظامي' : 'Enterprise contract wizard'}
              </DialogDescription>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700 text-xs">
              <span className="text-slate-400">{isAr ? 'التصنيف:' : 'Category:'}</span>
              <Badge className={formData.contractCategory === 'revenue' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}>
                {getContractCategoryLabel(formData.contractCategory, isAr)}
              </Badge>
            </div>
          </div>

          {/* Stepper Bar */}
          <div className="grid grid-cols-5 gap-2 pt-2">
            {steps.map((st) => {
              const isActive = step === st.num;
              const isCompleted = step > st.num;
              return (
                <button
                  key={st.num}
                  type="button"
                  onClick={() => isCompleted && setStep(st.num)}
                  disabled={!isCompleted && !isActive}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all text-center ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-md scale-105'
                      : isCompleted
                      ? 'bg-slate-800/90 text-emerald-400 hover:bg-slate-800 cursor-pointer'
                      : 'bg-slate-800/40 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                        isActive ? 'bg-white text-primary' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {st.num}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] truncate max-w-full hidden md:inline">
                    {isAr ? st.titleAr : st.titleEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Wizard Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-background space-y-6">
          {/* STEP 1: Core Polymorphic Contract Types */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Presets Bar */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>{isAr ? 'اختيارات سريعة جاهزة (Quick Presets):' : 'Quick Presets:'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset(preset)}
                      className={`text-xs h-8 gap-1.5 transition-all ${
                        formData.contractType === preset.type
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                          : 'bg-background hover:bg-muted'
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {isAr ? preset.labelAr : preset.labelEn}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex items-center justify-between border-b pb-3">
                <Label className="text-base font-bold">{isAr ? 'اختر نوع العقد الرئيسي (7 أنواع نظامية):' : 'Select Core Contract Type:'}</Label>
                <div className="flex bg-muted p-1 rounded-lg gap-1">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('all')}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                      categoryFilter === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    {isAr ? 'الكل (7)' : 'All (7)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('revenue')}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                      categoryFilter === 'revenue' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-500/10'
                    }`}
                  >
                    {isAr ? '🟢 إيرادات' : '🟢 Revenue'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('expense')}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                      categoryFilter === 'expense' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-600 hover:bg-rose-500/10'
                    }`}
                  >
                    {isAr ? '🔴 مصروفات' : '🔴 Expense'}
                  </button>
                </div>
              </div>

              {/* Core Types Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPrimaryTypes.map((typeObj) => {
                  const isSelected = formData.contractType === typeObj.type;
                  const isRev = typeObj.category === 'revenue';
                  return (
                    <div
                      key={typeObj.type}
                      onClick={() => handleTypeChange(typeObj.type)}
                      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className={`p-2.5 rounded-lg ${isRev ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                          {typeIcons[typeObj.icon] || <FileText className="h-5 w-5" />}
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            isRev ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-rose-300 text-rose-700 bg-rose-50'
                          }`}
                        >
                          {getContractCategoryLabel(typeObj.category, isAr)}
                        </Badge>
                      </div>

                      <div className="mt-3">
                        <h4 className="font-bold text-sm text-foreground">
                          {isAr ? typeObj.labelAr : typeObj.labelEn}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {typeObj.descriptionAr}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="absolute top-2 left-2">
                          <CheckCircle2 className="h-5 w-5 text-primary fill-primary/20" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Party & Linked Entities */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* General info inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border">
                <div>
                  <Label className="text-xs font-semibold">{isAr ? 'رقم العقد:' : 'Contract Number:'}</Label>
                  <Input
                    value={formData.contractNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, contractNumber: e.target.value }))}
                    placeholder="CTR-100200"
                    className="mt-1.5 bg-background font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">{isAr ? 'عنوان/اسم العقد الوصفي:' : 'Contract Title:'}</Label>
                  <Input
                    value={formData.title || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={isAr ? 'مثال: عقد إيجار سكن عمال شركة البناء' : 'e.g. Workers Lease Agreement'}
                    className="mt-1.5 bg-background text-xs"
                  />
                </div>
              </div>

              {/* Party Type Select */}
              <div className="space-y-3">
                <Label className="text-base font-bold">{isAr ? 'نوع الطرف الثاني في العقد:' : 'Second Party Type:'}</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'company', labelAr: 'شركة / جهة', labelEn: 'Company', icon: Building2 },
                    { id: 'vendor', labelAr: 'مورد / مقاول', labelEn: 'Vendor', icon: Store },
                    { id: 'individual', labelAr: 'فرد / شخص', labelEn: 'Individual', icon: Users },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, partyType: p.id as PartyType }))}
                      className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-semibold text-sm transition-all ${
                        formData.partyType === p.id
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-border bg-card hover:bg-accent'
                      }`}
                    >
                      <p.icon className="h-4 w-4" />
                      <span>{isAr ? p.labelAr : p.labelEn}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Party Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border">
                <div>
                  <Label className="text-xs font-semibold">{isAr ? 'اختر من القائمة المسجلة:' : 'Select Registered Party:'}</Label>
                  <Select value={formData.partyId} onValueChange={handlePartyChange}>
                    <SelectTrigger className="mt-1.5 bg-background text-xs">
                      <SelectValue placeholder={isAr ? 'اختر شركة مسجلة...' : 'Select company...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">{isAr ? 'اسم الطرف في العقد (مطلوب):' : 'Party Name (Required):'}</Label>
                  <Input
                    value={formData.partyName}
                    onChange={(e) => setFormData(prev => ({ ...prev, partyName: e.target.value }))}
                    placeholder={isAr ? 'اسم الشركة أو الفرد' : 'Company or individual name'}
                    className="mt-1.5 bg-background text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">{isAr ? 'البريد أو مسؤول التواصل:' : 'Contact Email/Person:'}</Label>
                  <Input
                    value={formData.partyContact || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, partyContact: e.target.value }))}
                    placeholder="contact@company.com"
                    className="mt-1.5 bg-background text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">{isAr ? 'رقم الهاتف:' : 'Phone Number:'}</Label>
                  <Input
                    value={formData.partyPhone || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, partyPhone: e.target.value }))}
                    placeholder="05XXXXXXXX"
                    className="mt-1.5 bg-background text-xs"
                  />
                </div>
              </div>

              {/* Contract Relation Type: Primary vs Addendum */}
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    {isAr ? 'نوع تصنيف العقد والعلاقة (ملحق / عقد جديد):' : 'Contract Relationship Type:'}
                  </Label>
                  <Badge variant="outline" className="text-[10px]">
                    {formData.contractRelationType === 'addendum'
                      ? (isAr ? '📑 ملحق عقد' : 'Addendum')
                      : (isAr ? '📄 عقد رئيسي جديد' : 'New Primary Contract')}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, contractRelationType: 'new_contract', parentContractId: '' }))}
                    className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                      formData.contractRelationType !== 'addendum'
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                        : 'border-border bg-background hover:bg-accent'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>{isAr ? '📄 عقد أساسي / جديد' : 'New Primary Contract'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, contractRelationType: 'addendum' }))}
                    className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                      formData.contractRelationType === 'addendum'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold shadow-sm'
                        : 'border-border bg-background hover:bg-accent'
                    }`}
                  >
                    <FilePlus className="w-4 h-4 text-purple-600" />
                    <span>{isAr ? '📑 ملحق عقد لنفس المالك' : 'Contract Addendum'}</span>
                  </button>
                </div>

                {formData.contractRelationType === 'addendum' && (
                  <div className="pt-2 animate-in fade-in duration-200">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isAr ? 'اختر العقد الأصلي المراد إضافة ملحق عليه:' : 'Select Parent Contract for Addendum:'}
                    </Label>
                    <Select
                      value={formData.parentContractId || ''}
                      onValueChange={(val) => {
                        const parent = allContracts.find(c => c.id === val);
                        setFormData(prev => ({
                          ...prev,
                          parentContractId: val,
                          title: parent ? (isAr ? `ملحق عقد على (${parent.title || parent.contractNumber})` : `Addendum to (${parent.title || parent.contractNumber})`) : prev.title
                        }));
                      }}
                    >
                      <SelectTrigger className="mt-1 bg-background text-xs font-medium">
                        <SelectValue placeholder={isAr ? 'اختر العقد الرئيسي...' : 'Select parent contract...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {partyPreviousContracts.length > 0 ? (
                          partyPreviousContracts.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.contractNumber || 'CTR'} - {c.title || getContractTypeInfo(c.contractType).labelAr} ({c.startDate} - {c.endDate})
                            </SelectItem>
                          ))
                        ) : (
                          allContracts.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.partyName}: {c.contractNumber || 'CTR'} - {c.title || getContractTypeInfo(c.contractType).labelAr}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Collapsible Previous Contracts for the Same Owner/Party */}
              {partyPreviousContracts.length > 0 && (
                <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/50 space-y-2">
                  <div
                    onClick={() => setShowPreviousContracts(!showPreviousContracts)}
                    className="flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        {isAr
                          ? `📜 العقود المبرمة سابقاً مع المالك / الطرف (${formData.partyName || 'المحدد'}) [عدد العقود: ${partyPreviousContracts.length}]:`
                          : `📜 Previous Contracts for (${formData.partyName || 'Party'}) [${partyPreviousContracts.length}]:`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 font-semibold bg-amber-100/80 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
                      <span>{showPreviousContracts ? (isAr ? 'إخفاء ▲' : 'Collapse ▲') : (isAr ? 'عرض العقود ▼' : 'Expand ▼')}</span>
                    </div>
                  </div>

                  {showPreviousContracts && (
                    <div className="space-y-2 pt-2 animate-in fade-in duration-200">
                      {partyPreviousContracts.map((prevC) => (
                        <div key={prevC.id} className="p-3 bg-background rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-xs">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                              <span className="font-mono text-primary">{prevC.contractNumber || 'CTR'}</span>
                              <span>•</span>
                              <span>{prevC.title || getContractTypeInfo(prevC.contractType).labelAr}</span>
                              <Badge className={getStatusBadge(prevC.status)}>{getContractStatusLabel(prevC.status, isAr)}</Badge>
                              {prevC.contractRelationType === 'addendum' && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
                                  {isAr ? 'ملحق عقد' : 'Addendum'}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2.5 mt-1">
                              <span>📅 {isAr ? 'من' : 'From'} {prevC.startDate} {isAr ? 'إلى' : 'To'} {prevC.endDate}</span>
                              <span>•</span>
                              <span className="font-semibold text-emerald-600">
                                💰 {formatSAR(prevC.billingRate)} {isAr ? 'ر.س' : 'SAR'} ({getBillingTypeLabel(prevC.billingType, isAr)})
                              </span>
                              <span>•</span>
                              <span>🔄 {getRenewalTypeLabel(prevC.renewalType, isAr)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-[11px] h-7 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 font-medium"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  contractRelationType: 'addendum',
                                  parentContractId: prevC.id,
                                  title: isAr ? `ملحق عقد على (${prevC.title || prevC.contractNumber})` : `Addendum to (${prevC.title || prevC.contractNumber})`,
                                }));
                              }}
                            >
                              <Plus className="w-3 h-3 ml-1 text-purple-600" />
                              {isAr ? 'ربط كملحق لهذا العقد' : 'Link as Addendum'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Linked Residences */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-bold">{isAr ? 'السكنات / العقارات المرتبطة:' : 'Linked Properties/Residences:'}</Label>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={residenceSearch}
                    onChange={(e) => setResidenceSearch(e.target.value)}
                    placeholder={isAr ? 'بحث في السكنات...' : 'Search residences...'}
                    className="pr-9 bg-background text-xs h-9"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
                  {filteredResidences.map(res => {
                    const isChecked = formData.linkedResidences.includes(res.id);
                    return (
                      <label
                        key={res.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? 'border-primary bg-primary/10 text-primary font-semibold shadow-sm'
                            : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                        }`}
                      >
                        <Checkbox checked={isChecked} onCheckedChange={() => toggleResidence(res.id)} />
                        <span className="text-xs truncate">{res.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Dynamic Specs & Billing & Financials */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* DYNAMIC SECTION BASED ON CONTRACT TYPE */}
              {formData.contractType === 'lease_in' || formData.contractType === 'lease_out' ? (
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-3">
                  <h4 className="font-bold text-sm text-primary flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {isAr ? '🏢 بيانات قسم عقد الإيجار (Lease Specs):' : 'Lease Specifications:'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <Label className="text-xs">{isAr ? 'نوع العقار:' : 'Property Type:'}</Label>
                      <Select
                        value={formData.leaseDetails?.propertyType || 'building'}
                        onValueChange={(val: any) => setFormData(prev => ({ ...prev, leaseDetails: { ...prev.leaseDetails, propertyType: val } }))}
                      >
                        <SelectTrigger className="bg-background mt-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="building">{isAr ? 'مبنى / عمارة' : 'Building'}</SelectItem>
                          <SelectItem value="residence">{isAr ? 'مجمع سكن' : 'Housing Complex'}</SelectItem>
                          <SelectItem value="land">{isAr ? 'أرض' : 'Land'}</SelectItem>
                          <SelectItem value="warehouse">{isAr ? 'مستودع' : 'Warehouse'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{isAr ? 'المساحة الإجمالية (م²):' : 'Total Area (sqm):'}</Label>
                      <Input
                        type="number"
                        value={formData.leaseDetails?.totalAreaSqm || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, leaseDetails: { ...prev.leaseDetails, totalAreaSqm: Number(e.target.value) } }))}
                        placeholder="1200"
                        className="bg-background mt-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{isAr ? 'اسم المبنى / المشروع:' : 'Building Name:'}</Label>
                      <Input
                        value={formData.leaseDetails?.buildingName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, leaseDetails: { ...prev.leaseDetails, buildingName: e.target.value } }))}
                        placeholder={isAr ? 'مبنى السلام A' : 'Al-Salam Bldg A'}
                        className="bg-background mt-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : formData.contractType === 'accommodation_agreement' ? (
                <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20 space-y-3">
                  <h4 className="font-bold text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {isAr ? '🛌 بيانات قسم عقد الإسكان والتسكين (Accommodation Specs):' : 'Accommodation Specifications:'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <Label className="text-xs">{isAr ? 'عدد العمال المستهدف:' : 'Target Workers Count:'}</Label>
                      <Input
                        type="number"
                        value={formData.accommodationDetails?.targetWorkersCount || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, accommodationDetails: { ...prev.accommodationDetails, targetWorkersCount: Number(e.target.value) } }))}
                        placeholder="120"
                        className="bg-background mt-1 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{isAr ? 'السعر اليومي للفرد (ر.س):' : 'Daily Rate / Worker:'}</Label>
                      <Input
                        type="number"
                        value={formData.billingRate || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, billingRate: Number(e.target.value), accommodationDetails: { ...prev.accommodationDetails, dailyRatePerWorker: Number(e.target.value) } }))}
                        placeholder="40"
                        className="bg-background mt-1 text-xs font-mono font-bold text-emerald-600"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{isAr ? 'عدد الأسرة المخصصة:' : 'Beds Reserved:'}</Label>
                      <Input
                        type="number"
                        value={formData.accommodationDetails?.bedsCount || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, accommodationDetails: { ...prev.accommodationDetails, bedsCount: Number(e.target.value) } }))}
                        placeholder="150"
                        className="bg-background mt-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              ) : formData.contractType === 'service' ? (
                <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 space-y-3">
                  <h4 className="font-bold text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    {isAr ? '🔧 بيانات قسم عقد الخدمات والصيانة (Service Specs):' : 'Service Specifications:'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <Label className="text-xs">{isAr ? 'تصنيف الخدمة:' : 'Service Category:'}</Label>
                      <Input
                        value={formData.serviceDetails?.serviceCategory || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, serviceDetails: { ...prev.serviceDetails, serviceCategory: e.target.value } }))}
                        placeholder={isAr ? 'مصاعد، نظافة، رش مبيدات' : 'Elevators, Cleaning'}
                        className="bg-background mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{isAr ? 'فترة الاستجابة SLA (بالساعات):' : 'SLA Response Hours:'}</Label>
                      <Input
                        type="number"
                        value={formData.serviceDetails?.slaResponseHours || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, serviceDetails: { ...prev.serviceDetails, slaResponseHours: Number(e.target.value) } }))}
                        placeholder="4"
                        className="bg-background mt-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{isAr ? 'دورية الزيارات:' : 'Visit Frequency:'}</Label>
                      <Select
                        value={formData.serviceDetails?.visitFrequency || 'monthly'}
                        onValueChange={(val: any) => setFormData(prev => ({ ...prev, serviceDetails: { ...prev.serviceDetails, visitFrequency: val } }))}
                      >
                        <SelectTrigger className="bg-background mt-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">{isAr ? 'أسبوعي' : 'Weekly'}</SelectItem>
                          <SelectItem value="biweekly">{isAr ? 'كل أسبوعين' : 'Biweekly'}</SelectItem>
                          <SelectItem value="monthly">{isAr ? 'شهري' : 'Monthly'}</SelectItem>
                          <SelectItem value="quarterly">{isAr ? 'ربع سنوي' : 'Quarterly'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ) : formData.contractType === 'supply' ? (
                <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/20 space-y-3">
                  <h4 className="font-bold text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
                    <Droplets className="h-4 w-4" />
                    {isAr ? '📦 بيانات قسم عقد التوريد (Supply Specs):' : 'Supply Specifications:'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <Label className="text-xs">{isAr ? 'نوع التوريد:' : 'Supply Category:'}</Label>
                      <Select
                        value={formData.supplyDetails?.supplyCategory || 'water'}
                        onValueChange={(val: any) => setFormData(prev => ({ ...prev, supplyDetails: { ...prev.supplyDetails, supplyCategory: val } }))}
                      >
                        <SelectTrigger className="bg-background mt-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="water">{isAr ? 'مياه شرب / غسيل' : 'Water'}</SelectItem>
                          <SelectItem value="diesel">{isAr ? 'ديزل للمولدات' : 'Diesel'}</SelectItem>
                          <SelectItem value="furniture">{isAr ? 'أثاث ومستلزمات' : 'Furniture'}</SelectItem>
                          <SelectItem value="appliances">{isAr ? 'أجهزة كهربائية' : 'Appliances'}</SelectItem>
                          <SelectItem value="beds">{isAr ? 'أسرة وفرش' : 'Beds & Mattresses'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{isAr ? 'سعر الوحدة (ر.س):' : 'Unit Price:'}</Label>
                      <Input
                        type="number"
                        value={formData.billingRate || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, billingRate: Number(e.target.value), supplyDetails: { ...prev.supplyDetails, unitPrice: Number(e.target.value) } }))}
                        placeholder="120"
                        className="bg-background mt-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{isAr ? 'جدول التوريد والتسليم:' : 'Delivery Schedule:'}</Label>
                      <Input
                        value={formData.supplyDetails?.deliverySchedule || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, supplyDetails: { ...prev.supplyDetails, deliverySchedule: e.target.value } }))}
                        placeholder={isAr ? 'يومياً الساعة 8 صباحاً' : 'Daily 8 AM'}
                        className="bg-background mt-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : formData.contractType === 'utility' ? (
                <div className="bg-purple-500/5 p-4 rounded-xl border border-purple-500/20 space-y-3">
                  <h4 className="font-bold text-sm text-purple-700 dark:text-purple-400 flex items-center gap-2">
                    <Flame className="h-4 w-4" />
                    {isAr ? '⚡ بيانات قسم المرافق والعدادات (Utility Specs):' : 'Utility Specifications:'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <Label className="text-xs">{isAr ? 'رقم العداد:' : 'Meter Number:'}</Label>
                      <Input
                        value={formData.utilityDetails?.meterNumber || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, utilityDetails: { ...prev.utilityDetails, meterNumber: e.target.value } }))}
                        placeholder="MTR-900812"
                        className="bg-background mt-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{isAr ? 'رقم الحساب لدى الشركة:' : 'Account Number:'}</Label>
                      <Input
                        value={formData.utilityDetails?.accountNumber || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, utilityDetails: { ...prev.utilityDetails, accountNumber: e.target.value } }))}
                        placeholder="ACC-50041"
                        className="bg-background mt-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{isAr ? 'اسم الشركة المزودة:' : 'Provider Name:'}</Label>
                      <Input
                        value={formData.utilityDetails?.providerName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, utilityDetails: { ...prev.utilityDetails, providerName: e.target.value } }))}
                        placeholder={isAr ? 'شركة الكهرباء السعودية' : 'SEC'}
                        className="bg-background mt-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Billing Calculation Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-xl border">
                <div>
                  <Label className="text-xs font-semibold">{isAr ? 'آلية احتساب الفوترة:' : 'Billing Type:'}</Label>
                  <Select
                    value={formData.billingType}
                    onValueChange={(val: any) => setFormData(prev => ({ ...prev, billingType: val }))}
                  >
                    <SelectTrigger className="bg-background mt-1.5 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_person_per_day">{isAr ? 'للشخص/اليوم' : 'Per Person/Day'}</SelectItem>
                      <SelectItem value="per_person_per_month">{isAr ? 'للشخص/الشهر' : 'Per Person/Month'}</SelectItem>
                      <SelectItem value="fixed_monthly">{isAr ? 'مبلغ شهري ثابت' : 'Fixed Monthly'}</SelectItem>
                      <SelectItem value="fixed_yearly">{isAr ? 'مبلغ سنوي ثابت' : 'Fixed Yearly'}</SelectItem>
                      <SelectItem value="per_invoice">{isAr ? 'حسب الفاتورة' : 'Per Invoice'}</SelectItem>
                      <SelectItem value="per_unit">{isAr ? 'حسب الوحدة' : 'Per Unit'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">{isAr ? 'المبلغ قبل الضريبة (ر.س):' : 'Base Rate (SAR):'}</Label>
                  <Input
                    type="number"
                    value={formData.billingRate || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, billingRate: Number(e.target.value) }))}
                    placeholder="0.00"
                    className="mt-1.5 bg-background font-mono text-base font-bold"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">{isAr ? 'ضريبة القيمة المضافة %:' : 'VAT %:'}</Label>
                  <Input
                    type="number"
                    value={formData.vatPercentage ?? 15}
                    onChange={(e) => setFormData(prev => ({ ...prev, vatPercentage: Number(e.target.value) }))}
                    placeholder="15"
                    className="mt-1.5 bg-background text-xs font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{isAr ? 'الإجمالي الشامل للضريبة:' : 'Total with VAT:'}</Label>
                  <div className="mt-1.5 h-10 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center font-mono font-extrabold text-emerald-600 text-sm">
                    {formatSAR(totalWithVat)} SAR
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Duration, Guarantees & Roles */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Presets Duration Buttons */}
              <div className="bg-muted/30 p-3.5 rounded-xl border space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    {isAr ? 'مدد العقد السريعة (Quick Duration Presets):' : 'Quick Duration Presets:'}
                  </Label>
                  <Badge variant="outline" className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border-emerald-200">
                    {formData.dateSystem === 'hijri' ? (isAr ? 'حسب التقويم الهجري 🌙' : 'Hijri Calendar 🌙') : (isAr ? 'حسب التقويم الميلادي 📅' : 'Gregorian Calendar 📅')}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { labelAr: '3 أشهر', labelEn: '3 Months', months: 3, years: 0 },
                    { labelAr: '6 أشهر', labelEn: '6 Months', months: 6, years: 0 },
                    { labelAr: 'سنة واحدة (12 شهر)', labelEn: '1 Year', months: 0, years: 1 },
                    { labelAr: 'سنتان (24 شهر)', labelEn: '2 Years', months: 0, years: 2 },
                    { labelAr: '3 سنوات (36 شهر)', labelEn: '3 Years', months: 0, years: 3 },
                    { labelAr: '5 سنوات (60 شهر)', labelEn: '5 Years', months: 0, years: 5 },
                  ].map((p, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDuration(p.months, p.years)}
                      className="text-xs bg-background hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 font-medium transition-all"
                    >
                      {isAr ? p.labelAr : p.labelEn}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Dates Input with Unified Hijri/Gregorian Date Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <UnifiedDatePicker
                  label={isAr ? 'تاريخ بداية العقد:' : 'Start Date:'}
                  value={formData.startDate}
                  onChange={(isoDate) => setFormData(prev => ({ ...prev, startDate: isoDate }))}
                  calendarSystem={formData.dateSystem || 'gregorian'}
                  onCalendarSystemChange={(sys) => setFormData(prev => ({ ...prev, dateSystem: sys }))}
                  required
                />

                <UnifiedDatePicker
                  label={isAr ? 'تاريخ نهاية العقد:' : 'End Date:'}
                  value={formData.endDate}
                  onChange={(isoDate) => setFormData(prev => ({ ...prev, endDate: isoDate }))}
                  calendarSystem={formData.dateSystem || 'gregorian'}
                  onCalendarSystemChange={(sys) => setFormData(prev => ({ ...prev, dateSystem: sys }))}
                  disabled={formData.isOpenEnded}
                />
              </div>

              {/* Auto-Renewal & Renewal Terms Section */}
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-emerald-600" />
                    <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {isAr ? 'خيارات التجديد والتجديد التلقائي (Auto Renewal):' : 'Auto Renewal Settings:'}
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="autoRenewToggle" className="text-xs font-semibold cursor-pointer text-emerald-800 dark:text-emerald-300">
                      {formData.autoRenew
                        ? (isAr ? 'التجديد التلقائي مفعل ✅' : 'Auto Renewal Enabled ✅')
                        : (isAr ? 'تجديد يدوي ✋' : 'Manual Renewal ✋')}
                    </Label>
                    <input
                      id="autoRenewToggle"
                      type="checkbox"
                      checked={formData.autoRenew}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData(prev => ({
                          ...prev,
                          autoRenew: checked,
                          renewalType: checked ? (prev.renewalType === 'manual' ? 'auto_yearly' : prev.renewalType) : 'manual',
                        }));
                      }}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isAr ? 'نوع ونظام التجديد:' : 'Renewal Type:'}
                    </Label>
                    <Select
                      value={formData.renewalType}
                      onValueChange={(val: RenewalType) => setFormData(prev => ({
                        ...prev,
                        renewalType: val,
                        autoRenew: val !== 'manual',
                      }))}
                    >
                      <SelectTrigger className="mt-1.5 bg-background text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">{isAr ? '✋ تجديد يدوي عند الانتهاء (Manual)' : 'Manual Renewal'}</SelectItem>
                        <SelectItem value="auto_same_duration">{isAr ? '🔄 تجديد تلقائي بنفس فترة العقد (فترة مماثلة)' : 'Auto Same Contract Duration'}</SelectItem>
                        <SelectItem value="auto_yearly">{isAr ? '📅 تجديد تلقائي سنوياً (Auto Yearly)' : 'Auto Yearly'}</SelectItem>
                        <SelectItem value="auto_quarterly">{isAr ? '📆 تجديد تلقائي كل 3 أشهر (Auto Quarterly)' : 'Auto Quarterly'}</SelectItem>
                        <SelectItem value="auto_monthly">{isAr ? '🗓️ تجديد تلقائي شهرياً (Auto Monthly)' : 'Auto Monthly'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isAr ? 'مهلة الإشعار عدم الرغبة بالتجديد (بالأيام):' : 'Non-Renewal Notice Period (Days):'}
                    </Label>
                    <Input
                      type="number"
                      value={formData.noticePeriodDays || 30}
                      onChange={(e) => setFormData(prev => ({ ...prev, noticePeriodDays: Number(e.target.value) }))}
                      placeholder="30"
                      className="mt-1.5 bg-background text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Renewal Condition / Notice Clause Box */}
                <div className="bg-white/80 dark:bg-slate-900/60 p-3 rounded-xl border border-emerald-300/60 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      {isAr ? 'شرط وبند التجديد لفترة مماثلة تلقائياً (Renewal Clause):' : 'Notice Clause for Same Period Renewal:'}
                    </Label>
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                      {isAr ? 'بند نظامي قانوني' : 'Legal Clause'}
                    </Badge>
                  </div>

                  <Textarea
                    value={formData.autoRenewCondition || (isAr ? `تُجدد مدة العقد تلقائياً لفترة مماثلة لمدته الأصلية وبنفس الشروط المالية والالتزامات، ما لم يُخطر أحد الطرفين الطرف الآخر كتابةً بعدم الرغبة بالتجديد قبل (${formData.noticePeriodDays || 30}) يوماً على الأقل من تاريخ الانتهاء.` : `The contract shall automatically renew for an equivalent period unless a written notice of non-renewal is provided at least ${formData.noticePeriodDays || 30} days prior to expiration.`)}
                    onChange={(e) => setFormData(prev => ({ ...prev, autoRenewCondition: e.target.value }))}
                    rows={2}
                    className="text-xs leading-relaxed bg-background font-serif text-slate-800 dark:text-slate-200"
                    placeholder={isAr ? 'نص شرط تجديد العقد تلقائياً لفترة مماثلة...' : 'Renewal clause text...'}
                  />

                  <p className="text-[10px] text-muted-foreground">
                    {isAr
                      ? `💡 سيتم تجديد العقد بنفس المدة الحالية ما لم يتم تسجيل إشعار بعدم الرغبة بالتجديد خلال مهلة (${formData.noticePeriodDays || 30}) يوماً.`
                      : `💡 Contract will automatically renew for an equivalent duration unless non-renewal notice is logged prior to ${formData.noticePeriodDays || 30} days.`}
                  </p>
                </div>
              </div>

              {/* Guarantees Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    {isAr ? 'قسم الضمانات والـ Securities (تأمين، شيكات، كفالات):' : 'Contract Guarantees & Securities:'}
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, guarantees: [...(prev.guarantees || []), { type: 'security_deposit', amount: 0 }] }))}
                    className="text-xs gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isAr ? 'إضافة ضمان' : 'Add Guarantee'}
                  </Button>
                </div>

                {(formData.guarantees || []).map((g, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-3 bg-muted/40 rounded-lg border">
                    <Select
                      value={g.type}
                      onValueChange={(val: any) => {
                        const list = [...(formData.guarantees || [])];
                        list[idx].type = val;
                        setFormData(prev => ({ ...prev, guarantees: list }));
                      }}
                    >
                      <SelectTrigger className="bg-background text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="security_deposit">{isAr ? 'تأمين نقدي' : 'Security Deposit'}</SelectItem>
                        <SelectItem value="check">{isAr ? 'شيك ضمان' : 'Check'}</SelectItem>
                        <SelectItem value="letter_of_credit">{isAr ? 'خطاب ضمان بنكي' : 'Letter of Credit'}</SelectItem>
                        <SelectItem value="bail">{isAr ? 'كفالة حضورية/غرمية' : 'Bail'}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={g.amount || ''}
                      onChange={(e) => {
                        const list = [...(formData.guarantees || [])];
                        list[idx].amount = Number(e.target.value);
                        setFormData(prev => ({ ...prev, guarantees: list }));
                      }}
                      placeholder={isAr ? 'قيمة الضمان' : 'Amount'}
                      className="bg-background text-xs font-mono"
                    />
                    <Input
                      value={g.referenceNumber || ''}
                      onChange={(e) => {
                        const list = [...(formData.guarantees || [])];
                        list[idx].referenceNumber = e.target.value;
                        setFormData(prev => ({ ...prev, guarantees: list }));
                      }}
                      placeholder={isAr ? 'رقم الشيك / الخطاب' : 'Ref #' }
                      className="bg-background text-xs font-mono"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-rose-600"
                      onClick={() => {
                        const list = (formData.guarantees || []).filter((_, i) => i !== idx);
                        setFormData(prev => ({ ...prev, guarantees: list }));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Roles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border">
                <div>
                  <Label className="text-xs font-semibold">{isAr ? 'مدير/مسؤول العقد:' : 'Contract Manager:'}</Label>
                  <Input
                    value={formData.contractManager || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, contractManager: e.target.value }))}
                    placeholder={isAr ? 'اسم المدير المسؤول' : 'Manager Name'}
                    className="mt-1.5 bg-background text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">{isAr ? 'المحاسب المتابع:' : 'Accountant Name:'}</Label>
                  <Input
                    value={formData.accountantName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountantName: e.target.value }))}
                    placeholder={isAr ? 'اسم المحاسب' : 'Accountant Name'}
                    className="mt-1.5 bg-background text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Summary & Confirm */}
          {step === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {errors.length > 0 ? (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                    <h4 className="font-bold text-sm text-rose-800 dark:text-rose-300">
                      {isAr
                        ? `${errors.length} مشكلة تمنع حفظ العقد`
                        : `${errors.length} issue(s) blocking save`}
                    </h4>
                  </div>
                  <ul className="space-y-1.5 ps-7">
                    {errors.map((issue, i) => (
                      <li key={`${issue.field}-${i}`} className="text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                        <span>• {isAr ? issue.messageAr : issue.messageEn}</span>
                        <button
                          type="button"
                          onClick={() => setStep(issue.step)}
                          className="underline underline-offset-2 hover:no-underline font-semibold shrink-0"
                        >
                          {isAr ? `اذهب للخطوة ${issue.step}` : `Go to step ${issue.step}`}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                      {isAr ? 'العقد جاهز للاعتماد والإنشاء النهائي!' : 'Contract Ready to Save!'}
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      {isAr ? 'اجتاز العقد كل قواعد التحقق. راجع الملخص أدناه ثم احفظ.' : 'All validation rules passed. Review the summary below, then save.'}
                    </p>
                  </div>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-amber-600 shrink-0" />
                    <h4 className="font-bold text-sm text-amber-800 dark:text-amber-300">
                      {isAr
                        ? `${warnings.length} ملاحظة تستحق المراجعة (لا تمنع الحفظ)`
                        : `${warnings.length} warning(s) worth reviewing (save is still allowed)`}
                    </h4>
                  </div>
                  <ul className="space-y-1.5 ps-7">
                    {warnings.map((issue, i) => (
                      <li key={`${issue.field}-${i}`} className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                        <span>• {isAr ? issue.messageAr : issue.messageEn}</span>
                        <button
                          type="button"
                          onClick={() => setStep(issue.step)}
                          className="underline underline-offset-2 hover:no-underline font-semibold shrink-0"
                        >
                          {isAr ? `اذهب للخطوة ${issue.step}` : `Go to step ${issue.step}`}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Summary Sheet */}
              <div className="border-2 border-border rounded-2xl overflow-hidden bg-card shadow-sm">
                <div className="bg-muted p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary text-primary-foreground rounded-xl">
                      {typeIcons[getContractTypeInfo(formData.contractType).icon] || <FileText className="h-6 w-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary">
                          {isAr ? getContractTypeInfo(formData.contractType).labelAr : getContractTypeInfo(formData.contractType).labelEn}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">({formData.contractNumber})</span>
                      </div>
                      <h3 className="text-lg font-extrabold text-foreground">{formData.partyName}</h3>
                    </div>
                  </div>
                  <Badge className={formData.contractCategory === 'revenue' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}>
                    {getContractCategoryLabel(formData.contractCategory, isAr)}
                  </Badge>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-muted-foreground">{isAr ? 'الطرف الثاني:' : 'Party:'}</span>
                    <p className="font-bold">{formData.partyName} ({formData.partyType})</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground">{isAr ? 'الفوترة والمالية الشاملة:' : 'Total Amount (VAT incl):'}</span>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatSAR(totalWithVat)} SAR <span className="text-[10px] font-normal text-muted-foreground">({formatSAR(formData.billingRate)} + {formData.vatPercentage}% VAT)</span>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground">{isAr ? 'فترة السريان:' : 'Validity:'}</span>
                    <p className="font-bold">
                      {formData.startDate} ⬅️ {formData.isOpenEnded ? (isAr ? 'مفتوح' : 'Open') : formData.endDate}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground">{isAr ? 'عدد الضمانات المسجلة:' : 'Guarantees:'}</span>
                    <p className="font-bold">
                      {(formData.guarantees || []).length} {isAr ? 'ضمانات' : 'Guarantees'}
                    </p>
                  </div>

                  <div className="space-y-1 col-span-1 sm:col-span-2 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-200/80">
                    <span className="text-muted-foreground font-semibold">{isAr ? 'حالة ونظام التجديد:' : 'Renewal Mode:'}</span>
                    <p className="font-bold text-emerald-800 dark:text-emerald-300">
                      {formData.autoRenew
                        ? (isAr ? `🔄 تجديد تلقائي (${formData.renewalType}) - إشعار قبل ${formData.noticePeriodDays} يوماً` : `🔄 Auto Renew (${formData.renewalType}) - ${formData.noticePeriodDays} days notice`)
                        : (isAr ? '✋ تجديد يدوي عند الانتهاء' : '✋ Manual Renewal')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="p-4 bg-muted/40 border-t flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}
            disabled={isSubmitting}
            className="gap-2 text-xs"
          >
            {isAr ? (
              <>
                <ChevronRight className="h-4 w-4" />
                {step === 1 ? 'إلغاء' : 'الخطوة السابقة'}
              </>
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                {step === 1 ? 'Cancel' : 'Previous Step'}
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            {step < 5 ? (
              <Button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canGoNext || isSubmitting}
                className="gap-2 text-xs font-bold"
              >
                {isAr ? (
                  <>
                    الخطوة التالية
                    <ChevronLeft className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Next Step
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <>
                {mode === 'create' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleFinalSubmit('Draft')}
                    disabled={isSubmitting}
                    className="gap-2 text-xs font-bold"
                    title={isAr
                      ? 'يحفظ العقد كمسودة غير سارية — لا يدخل التقارير ولا تُصدر له فواتير.'
                      : 'Saves as a non-active draft — excluded from reports and invoicing.'}
                  >
                    <FileText className="h-4 w-4" />
                    {isAr ? 'حفظ كمسودة' : 'Save as Draft'}
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => handleFinalSubmit('Active')}
                  disabled={isSubmitting || !canSubmit}
                  title={!canSubmit
                    ? (isAr ? 'صحّح الأخطاء المذكورة أعلاه أولاً' : 'Fix the errors listed above first')
                    : undefined}
                  className="gap-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isSubmitting
                    ? (isAr ? 'جاري الحفظ...' : 'Saving...')
                    : mode === 'edit'
                    ? (isAr ? 'حفظ التعديلات' : 'Save Changes')
                    : (isAr ? 'تأكيد وإنشاء العقد الآن' : 'Create Contract Now')}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
