'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Building2,
  Home,
  Users,
  Wrench,
  Droplets,
  Store,
  Flame,
  Wifi,
  Calendar,
  DollarSign,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  Layers,
  Plus,
  Trash2,
  FileText,
  Calculator,
  AlertCircle,
  Building,
  Truck,
  CheckCircle2,
  Phone,
  Mail,
  User,
  Clock,
  Briefcase,
} from 'lucide-react';
import {
  type Contract,
  type ContractFormData,
  type ContractType,
  type BillingType,
  type PartyType,
  type RenewalType,
  type ContractGuarantee,
  type GuaranteeType,
  CONTRACT_TYPES,
  getContractTypeInfo,
  formatSAR,
} from '@/types/contracts';
import { useAccommodation } from '@/context/accommodation-context';
import { useToast } from '@/hooks/use-toast';
import { differenceInMonths, parseISO } from 'date-fns';

interface ContractStudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractToEdit?: Contract | null;
  onSave: (data: ContractFormData, status?: any) => Promise<any>;
}

// Icon mapper for all contract types
const TYPE_ICONS: Record<string, any> = {
  Building2,
  Home,
  Users,
  Wrench,
  Droplets,
  Store,
  Flame,
  Wifi,
  Truck,
  Building,
};

export function ContractStudioDialog({
  open,
  onOpenChange,
  contractToEdit,
  onSave,
}: ContractStudioDialogProps) {
  const { toast } = useToast();
  const { companies, residences } = useAccommodation();

  // Mode: 'quick' or 'full'
  const [studioMode, setStudioMode] = useState<'quick' | 'full'>('full');
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [typeCategoryFilter, setTypeCategoryFilter] = useState<'all' | 'revenue' | 'expense'>('all');

  // Form State
  const [formData, setFormData] = useState<ContractFormData>({
    contractType: 'accommodation_agreement',
    contractCategory: 'revenue',
    partyType: 'company',
    partyId: '',
    partyName: '',
    partyContact: '',
    partyPhone: '',
    partyEmail: '',
    linkedResidences: [],
    linkedResidenceNames: [],
    startDate: '',
    endDate: '',
    isOpenEnded: false,
    billingType: 'per_person_per_day',
    billingRate: 35,
    vatPercentage: 15,
    billingUnit: 'شخص/يوم',
    renewalType: 'manual',
    autoRenew: false,
    noticePeriodDays: 30,
    paymentCycle: 'monthly',
    contractManager: '',
    notes: '',
    leaseDetails: {
      propertyType: 'building',
      totalAreaSqm: 0,
      buildingName: '',
      unitNumbers: [],
    },
    accommodationDetails: {
      targetWorkersCount: 50,
      dailyRatePerWorker: 35,
      bedsCount: 50,
    },
    serviceDetails: {
      serviceCategory: 'صيانة مصاعد',
      slaResponseHours: 4,
      visitFrequency: 'monthly',
      equipmentCount: 1,
    },
    supplyDetails: {
      supplyCategory: 'water',
      unitPrice: 0,
      deliverySchedule: 'يومي',
    },
    commercialDetails: {
      commercialActivity: 'grocery',
      concessionType: 'fixed_rent',
      concessionPercentage: 0,
    },
    utilityDetails: {
      utilityType: 'electricity',
      meterNumber: '',
      accountNumber: '',
      providerName: 'الشركة السعودية للكهرباء',
    },
    guarantees: [],
  });

  // Populate when editing or set defaults on open
  useEffect(() => {
    if (contractToEdit) {
      setFormData({
        contractNumber: contractToEdit.contractNumber || '',
        title: contractToEdit.title || '',
        contractType: contractToEdit.contractType,
        contractCategory: contractToEdit.contractCategory,
        firstPartyName: contractToEdit.firstPartyName || 'شركة سي بي سي القابضة (CPC Holding Co.)',
        partyType: contractToEdit.partyType || 'company',
        partyId: contractToEdit.partyId || '',
        partyName: contractToEdit.partyName || '',
        partyContact: contractToEdit.partyContact || '',
        partyPhone: contractToEdit.partyPhone || '',
        partyEmail: contractToEdit.partyEmail || '',
        linkedResidences: contractToEdit.linkedResidences || [],
        linkedResidenceNames: contractToEdit.linkedResidenceNames || [],
        startDate: contractToEdit.startDate || '',
        endDate: contractToEdit.endDate || '',
        isOpenEnded: contractToEdit.isOpenEnded || false,
        billingType: contractToEdit.billingType || 'fixed_monthly',
        billingRate: contractToEdit.billingRate || 0,
        vatPercentage: contractToEdit.vatPercentage ?? 15,
        billingUnit: contractToEdit.billingUnit || 'شهري',
        paymentTerms: contractToEdit.paymentTerms || '',
        paymentCycle: contractToEdit.paymentCycle || 'monthly',
        advancePayment: contractToEdit.advancePayment || 0,
        renewalType: contractToEdit.renewalType || 'manual',
        autoRenew: contractToEdit.autoRenew || false,
        noticePeriodDays: contractToEdit.noticePeriodDays || 30,
        contractManager: contractToEdit.contractManager || '',
        notes: contractToEdit.notes || '',
        leaseDetails: contractToEdit.leaseDetails || {
          propertyType: 'building',
          totalAreaSqm: 0,
          buildingName: '',
          unitNumbers: [],
        },
        accommodationDetails: contractToEdit.accommodationDetails || {
          targetWorkersCount: 0,
          dailyRatePerWorker: 0,
          bedsCount: 0,
        },
        serviceDetails: contractToEdit.serviceDetails || {
          serviceCategory: 'صيانة مصاعد',
          slaResponseHours: 4,
          visitFrequency: 'monthly',
          equipmentCount: 1,
        },
        supplyDetails: contractToEdit.supplyDetails || {
          supplyCategory: 'water',
          unitPrice: 0,
          deliverySchedule: 'يومي',
        },
        commercialDetails: contractToEdit.commercialDetails || {
          commercialActivity: 'grocery',
          concessionType: 'fixed_rent',
          concessionPercentage: 0,
        },
        utilityDetails: contractToEdit.utilityDetails || {
          utilityType: 'electricity',
          meterNumber: '',
          accountNumber: '',
          providerName: '',
        },
        guarantees: contractToEdit.guarantees || [],
      });
      setActiveStep(1);
    } else if (open) {
      const today = new Date().toISOString().split('T')[0];
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const nextYearStr = nextYear.toISOString().split('T')[0];

      setFormData({
        contractType: 'accommodation_agreement',
        contractCategory: 'revenue',
        firstPartyName: 'شركة سي بي سي القابضة (CPC Holding Co.)',
        partyType: 'company',
        partyId: '',
        partyName: '',
        partyContact: '',
        partyPhone: '',
        partyEmail: '',
        linkedResidences: [],
        linkedResidenceNames: [],
        startDate: today,
        endDate: nextYearStr,
        isOpenEnded: false,
        billingType: 'per_person_per_day',
        billingRate: 35,
        vatPercentage: 15,
        billingUnit: 'شخص/يوم',
        paymentTerms: 'سداد شهري بناءً على كشف الحضور المعتمد',
        paymentCycle: 'monthly',
        advancePayment: 0,
        renewalType: 'manual',
        autoRenew: false,
        noticePeriodDays: 30,
        contractManager: '',
        notes: '',
        leaseDetails: {
          propertyType: 'building',
          totalAreaSqm: 0,
          buildingName: '',
          unitNumbers: [],
        },
        accommodationDetails: {
          targetWorkersCount: 50,
          dailyRatePerWorker: 35,
          bedsCount: 50,
        },
        serviceDetails: {
          serviceCategory: 'صيانة مصاعد',
          slaResponseHours: 4,
          visitFrequency: 'monthly',
          equipmentCount: 1,
        },
        supplyDetails: {
          supplyCategory: 'water',
          unitPrice: 0,
          deliverySchedule: 'يومي',
        },
        commercialDetails: {
          commercialActivity: 'grocery',
          concessionType: 'fixed_rent',
          concessionPercentage: 0,
        },
        utilityDetails: {
          utilityType: 'electricity',
          meterNumber: '',
          accountNumber: '',
          providerName: 'الشركة السعودية للكهرباء',
        },
        guarantees: [],
      });
      setActiveStep(1);
    }
  }, [contractToEdit, open]);

  // Handle Type Select
  const handleSelectType = (type: ContractType) => {
    const typeInfo = getContractTypeInfo(type);
    setFormData((prev) => ({
      ...prev,
      contractType: type,
      contractCategory: typeInfo.category,
      billingType: typeInfo.defaultBillingType,
      billingUnit: typeInfo.defaultBillingUnit,
    }));
  };

  // Handle Company Quick Fill
  const handleSelectCompany = (companyId: string) => {
    const found: any = companies.find((c: any) => c.id === companyId);
    if (found) {
      setFormData((prev) => ({
        ...prev,
        partyId: found.id,
        partyName: found.name,
        partyType: 'company',
        partyContact: found.contactPerson || found.contactPhone || prev.partyContact,
        partyPhone: found.phone || found.contactPhone || prev.partyPhone,
        partyEmail: found.email || found.contactEmail || prev.partyEmail,
      }));
    }
  };

  // Toggle Linked Residence
  const handleToggleResidence = (residenceId: string, residenceName: string) => {
    setFormData((prev) => {
      const exists = prev.linkedResidences.includes(residenceId);
      const nextIds = exists
        ? prev.linkedResidences.filter((id) => id !== residenceId)
        : [...prev.linkedResidences, residenceId];
      const nextNames = exists
        ? (prev.linkedResidenceNames || []).filter((n) => n !== residenceName)
        : [...(prev.linkedResidenceNames || []), residenceName];
      return {
        ...prev,
        linkedResidences: nextIds,
        linkedResidenceNames: nextNames,
      };
    });
  };

  // Guarantee Management
  const handleAddGuarantee = () => {
    const newG: ContractGuarantee = {
      type: 'security_deposit',
      amount: 10000,
      bankName: 'مصرف الراجحي',
      referenceNumber: `GR-${Date.now().toString().slice(-6)}`,
      issueDate: formData.startDate,
      expiryDate: formData.endDate,
      notes: '',
    };
    setFormData((prev) => ({
      ...prev,
      guarantees: [...(prev.guarantees || []), newG],
    }));
  };

  const handleUpdateGuarantee = (index: number, field: keyof ContractGuarantee, val: any) => {
    setFormData((prev) => {
      const copy = [...(prev.guarantees || [])];
      copy[index] = { ...copy[index], [field]: val };
      return { ...prev, guarantees: copy };
    });
  };

  const handleRemoveGuarantee = (index: number) => {
    setFormData((prev) => {
      const copy = [...(prev.guarantees || [])];
      copy.splice(index, 1);
      return { ...prev, guarantees: copy };
    });
  };

  // Duration in months
  const durationInMonths = useMemo(() => {
    if (formData.isOpenEnded || !formData.startDate || !formData.endDate) return null;
    try {
      const start = parseISO(formData.startDate);
      const end = parseISO(formData.endDate);
      const diff = differenceInMonths(end, start);
      return diff > 0 ? diff : 1;
    } catch {
      return null;
    }
  }, [formData.startDate, formData.endDate, formData.isOpenEnded]);

  // Financial Calculations & Live Simulator
  const calculations = useMemo(() => {
    const rate = Number(formData.billingRate) || 0;
    const vatPct = Number(formData.vatPercentage) || 0;
    const vatVal = (rate * vatPct) / 100;
    const totalWithVat = rate + vatVal;

    let monthlyEst = 0;
    let annualEst = 0;

    if (formData.billingType === 'fixed_monthly') {
      monthlyEst = totalWithVat;
      annualEst = totalWithVat * 12;
    } else if (formData.billingType === 'fixed_yearly') {
      monthlyEst = totalWithVat / 12;
      annualEst = totalWithVat;
    } else if (formData.billingType === 'per_person_per_day') {
      const workers = formData.accommodationDetails?.targetWorkersCount || 1;
      monthlyEst = rate * workers * 30 * (1 + vatPct / 100);
      annualEst = monthlyEst * 12;
    } else if (formData.billingType === 'per_person_per_month') {
      const workers = formData.accommodationDetails?.targetWorkersCount || 1;
      monthlyEst = rate * workers * (1 + vatPct / 100);
      annualEst = monthlyEst * 12;
    } else if (formData.billingType === 'per_room_per_month') {
      monthlyEst = totalWithVat;
      annualEst = totalWithVat * 12;
    } else if (formData.billingType === 'per_unit') {
      monthlyEst = totalWithVat * 30; // Approx 30 deliveries
      annualEst = monthlyEst * 12;
    } else {
      monthlyEst = totalWithVat;
      annualEst = totalWithVat * 12;
    }

    return {
      baseRate: rate,
      vatAmount: vatVal,
      totalWithVat,
      monthlyEstimate: monthlyEst,
      annualEstimate: annualEst,
    };
  }, [formData.billingRate, formData.vatPercentage, formData.billingType, formData.accommodationDetails]);

  // Submit Handler
  const handleSubmit = async () => {
    if (!formData.partyName.trim()) {
      toast({
        title: 'اسم الطرف الثاني مطلوب',
        description: 'يرجى تحديد أو إدخال اسم الشركة أو المورد.',
        variant: 'destructive',
      });
      setActiveStep(1);
      return;
    }
    if (!formData.startDate) {
      toast({
        title: 'تاريخ البدء مطلوب',
        description: 'يرجى تحديد تاريخ بداية سريان العقد.',
        variant: 'destructive',
      });
      setActiveStep(4);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      toast({
        title: contractToEdit ? 'تم تحديث العقد بنجاح ✨' : 'تم إنشاء العقد بنجاح 🎉',
        description: `العقد مع ${formData.partyName} أصبح معتمداً في النظام.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'حدث خطأ أثناء الحفظ',
        description: err.message || 'تعذر حفظ بيانات العقد',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredContractTypes = useMemo(() => {
    if (typeCategoryFilter === 'all') return CONTRACT_TYPES.slice(0, 7);
    return CONTRACT_TYPES.slice(0, 7).filter((t) => t.category === typeCategoryFilter);
  }, [typeCategoryFilter]);

  const currentTypeInfo = getContractTypeInfo(formData.contractType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
        {/* Top Header Bar */}
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-6 relative border-b border-indigo-900/40">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/20 backdrop-blur-md rounded-2xl border border-indigo-400/30 text-indigo-300 shadow-inner">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  {contractToEdit ? 'تعديل بيانات العقد' : 'استوديو العقود الذكي 2.0'}
                  <Badge
                    variant="outline"
                    className={`text-xs px-2.5 py-0.5 font-bold ${
                      formData.contractCategory === 'revenue'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-rose-500/20 border-rose-400 text-rose-300'
                    }`}
                  >
                    {formData.contractCategory === 'revenue' ? 'إيراد 🟢' : 'مصروف تشغيلي 🔴'}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300 mt-1">
                  صياغة وإدارة العقود المؤسسية الشاملة مع الحسابات التلقائية والضمانات البنكية
                </DialogDescription>
              </div>
            </div>

            {/* Quick vs Full Mode Switcher */}
            <div className="flex items-center bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/10 text-xs shadow-sm">
              <button
                type="button"
                onClick={() => setStudioMode('quick')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  studioMode === 'quick'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                ⚡ الإدخال السريع
              </button>
              <button
                type="button"
                onClick={() => setStudioMode('full')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  studioMode === 'full'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                📋 الاستوديو الكامل الموجه
              </button>
            </div>
          </div>

          {/* Stepper (Only in Full Mode) */}
          {studioMode === 'full' && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10 text-xs overflow-x-auto pb-1">
              {[
                { step: 1, label: '1. نوع العقد والأطراف', icon: Layers },
                { step: 2, label: '2. المواصفات والنطاق', icon: Briefcase },
                { step: 3, label: '3. المالية والمحاكي', icon: Calculator },
                { step: 4, label: '4. المدة والضمانات', icon: ShieldCheck },
                { step: 5, label: '5. المراجعة والاعتماد', icon: CheckCircle2 },
              ].map((s) => {
                const isPassed = activeStep > s.step;
                const isCurrent = activeStep === s.step;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setActiveStep(s.step)}
                    className={`flex items-center gap-2 py-1 px-3 rounded-xl transition-all shrink-0 ${
                      isCurrent
                        ? 'bg-white/20 text-white font-extrabold shadow-sm'
                        : isPassed
                        ? 'text-emerald-400 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        isCurrent
                          ? 'bg-indigo-500 text-white ring-2 ring-indigo-400/40'
                          : isPassed
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {isPassed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.step}
                    </div>
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[64vh] overflow-y-auto space-y-6 text-start" dir="rtl">
          {/* ================= QUICK MODE ================= */}
          {studioMode === 'quick' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-indigo-950 dark:text-indigo-200">
                    وضع الإدخال السريع الفوري ⚡
                  </h3>
                  <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
                    أدخل الحقول الجوهرية فقط لإنشاء العقد وتفعيله فوراً في أقل من دقيقة.
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">
                  {currentTypeInfo.labelAr}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contract Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">نوع العقد</Label>
                  <Select
                    value={formData.contractType}
                    onValueChange={(val) => handleSelectType(val as ContractType)}
                  >
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPES.slice(0, 7).map((t) => (
                        <SelectItem key={t.type} value={t.type}>
                          <div className="flex items-center gap-2">
                            <span>{t.category === 'revenue' ? '🟢' : '🔴'}</span>
                            <span className="font-semibold">{t.labelAr}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Company / Party Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">الطرف الثاني (الشركة / العميل) *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.partyName}
                      onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
                      placeholder="اسم المنشأة أو العميل..."
                      className="h-10 text-sm"
                      required
                    />
                    {companies.length > 0 && (
                      <Select onValueChange={handleSelectCompany}>
                        <SelectTrigger className="w-36 h-10 text-xs">
                          <SelectValue placeholder="من القائمة" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Billing Rate & Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">القيمة والفوترة</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={formData.billingRate || ''}
                      onChange={(e) => setFormData({ ...formData, billingRate: Number(e.target.value) })}
                      placeholder="المبلغ"
                      className="h-10 text-sm font-bold font-mono"
                    />
                    <Select
                      value={formData.billingType}
                      onValueChange={(val) => setFormData({ ...formData, billingType: val as BillingType })}
                    >
                      <SelectTrigger className="w-44 h-10 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_person_per_day">بالعامل/اليوم</SelectItem>
                        <SelectItem value="fixed_monthly">شهري ثابت</SelectItem>
                        <SelectItem value="fixed_yearly">سنوي ثابت</SelectItem>
                        <SelectItem value="per_unit">حسب الوحدة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Accommodation workers count if applicable */}
                {formData.billingType.includes('person') ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">عدد العمالة المستهدفة</Label>
                    <Input
                      type="number"
                      value={formData.accommodationDetails?.targetWorkersCount || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          accommodationDetails: {
                            ...formData.accommodationDetails,
                            targetWorkersCount: Number(e.target.value),
                          },
                        })
                      }
                      placeholder="50 عامل"
                      className="h-10 text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">ضريبة القيمة المضافة (%)</Label>
                    <Select
                      value={String(formData.vatPercentage ?? 15)}
                      onValueChange={(v) => setFormData({ ...formData, vatPercentage: Number(v) })}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15% (النسبة القياسية)</SelectItem>
                        <SelectItem value="0">0% (معفى)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Dates */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">تاريخ البدء *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="h-10 text-sm font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">تاريخ الانتهاء</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="h-10 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Linked Residences Quick selector */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold">السكنات والمواقع المربوطة ({formData.linkedResidences.length})</Label>
                  <span className="text-[11px] text-slate-400">انقر لتحديد السكن</span>
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                  {residences.map((res) => {
                    const isSelected = formData.linkedResidences.includes(res.id);
                    return (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => handleToggleResidence(res.id, res.name)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                        {res.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Financial Summary */}
              <div className="bg-slate-950 text-white rounded-2xl p-4 border border-slate-800 grid grid-cols-3 gap-3 text-center">
                <div>
                  <span className="text-[11px] text-slate-400 block">المبلغ الأساسي</span>
                  <span className="font-bold text-sm font-mono text-white">
                    {formatSAR(calculations.baseRate)} ر.س
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">الضريبة (15%)</span>
                  <span className="font-bold text-sm font-mono text-amber-400">
                    {formatSAR(calculations.vatAmount)} ر.س
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-indigo-300 block font-bold">الإجمالي الشهري التقديري</span>
                  <span className="font-black text-base font-mono text-emerald-400">
                    {formatSAR(calculations.monthlyEstimate)} ر.س
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ================= FULL GUIDED STUDIO ================= */}
          {studioMode === 'full' && (
            <div className="space-y-6">
              {/* STEP 1: Type Selection & Party Identity */}
              {activeStep === 1 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                        اختر طبيعة ونوع العقد
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        يدعم النظام 7 نماذج تشغيلية متخصصة تضبط شاشات الفوترة والحقول الذكية تلقائياً.
                      </p>
                    </div>

                    {/* Filter Category Tabs */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                      <button
                        type="button"
                        onClick={() => setTypeCategoryFilter('all')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          typeCategoryFilter === 'all'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        الكل (7)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTypeCategoryFilter('revenue')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          typeCategoryFilter === 'revenue'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-emerald-600 hover:text-emerald-700'
                        }`}
                      >
                        إيرادات 🟢
                      </button>
                      <button
                        type="button"
                        onClick={() => setTypeCategoryFilter('expense')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          typeCategoryFilter === 'expense'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-rose-600 hover:text-rose-700'
                        }`}
                      >
                        مصروفات 🔴
                      </button>
                    </div>
                  </div>

                  {/* Types Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {filteredContractTypes.map((typeItem) => {
                      const isSelected = formData.contractType === typeItem.type;
                      const Icon = TYPE_ICONS[typeItem.icon] || Building2;
                      const isRev = typeItem.category === 'revenue';

                      return (
                        <div
                          key={typeItem.type}
                          onClick={() => handleSelectType(typeItem.type)}
                          className={`cursor-pointer rounded-2xl p-4 border-2 transition-all relative flex flex-col justify-between ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-md ring-2 ring-indigo-500/20'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div
                              className={`p-2.5 rounded-xl ${
                                isRev
                                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold ${
                                isRev
                                  ? 'border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30'
                                  : 'border-rose-300 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30'
                              }`}
                            >
                              {isRev ? 'إيراد 🟢' : 'مصروف 🔴'}
                            </Badge>
                          </div>

                          <div className="mt-3">
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                              {typeItem.labelAr}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                              {typeItem.descriptionAr}
                            </p>
                          </div>

                          {isSelected && (
                            <div className="absolute top-3 left-3 bg-indigo-600 text-white rounded-full p-1 shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Second Party Details Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-600" />
                      بيانات الطرف الثاني والتعاقد
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Party Name */}
                      <div className="space-y-1.5 md:col-span-2">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-bold">اسم الطرف الثاني (الشركة / العميل) *</Label>
                          {companies.length > 0 && (
                            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                              أو اختر من الشركات المسجلة:
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={formData.partyName}
                            onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
                            placeholder="اكتب اسم المنشأة أو الطرف المتعاقد..."
                            className="h-10 text-sm bg-white dark:bg-slate-900"
                            required
                          />
                          {companies.length > 0 && (
                            <Select onValueChange={handleSelectCompany}>
                              <SelectTrigger className="w-48 h-10 text-xs bg-white dark:bg-slate-900">
                                <SelectValue placeholder="اختر من المسجلين" />
                              </SelectTrigger>
                              <SelectContent>
                                {companies.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>

                      {/* Party Type */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">صفة الطرف الثاني</Label>
                        <Select
                          value={formData.partyType}
                          onValueChange={(val) => setFormData({ ...formData, partyType: val as PartyType })}
                        >
                          <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="company">شركة عميلة / مستأجرة</SelectItem>
                            <SelectItem value="vendor">مورد / مقاول صيانة وخدمات</SelectItem>
                            <SelectItem value="individual">فرد / مستأجر تجاري</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Contact Representative */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">المسؤول / الممثل المعتمد</Label>
                        <div className="relative">
                          <User className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                          <Input
                            value={formData.partyContact || ''}
                            onChange={(e) => setFormData({ ...formData, partyContact: e.target.value })}
                            placeholder="اسم ممثل الشركة..."
                            className="h-10 text-sm pr-9 bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">رقم التواصل</Label>
                        <div className="relative">
                          <Phone className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                          <Input
                            value={formData.partyPhone || ''}
                            onChange={(e) => setFormData({ ...formData, partyPhone: e.target.value })}
                            placeholder="05XXXXXXXX"
                            className="h-10 text-sm pr-9 font-mono bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">البريد الإلكتروني الرسمي</Label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                          <Input
                            type="email"
                            value={formData.partyEmail || ''}
                            onChange={(e) => setFormData({ ...formData, partyEmail: e.target.value })}
                            placeholder="contracts@company.com"
                            className="h-10 text-sm pr-9 font-mono bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Technical Specifications & Scope (Dynamic per type!) */}
              {activeStep === 2 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-indigo-600" />
                      المواصفات الفنية والنطاق التشغيلي ({currentTypeInfo.labelAr})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      حقول ذكية متخصصة تتناسب تماماً مع طبيعة هذا النوع من العقود
                    </p>
                  </div>

                  {/* A. Lease In / Lease Out Specs */}
                  {(formData.contractType === 'lease_in' || formData.contractType === 'lease_out') && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
                        مواصفات العقار المستأجر / المؤجر
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">نوع العقار</Label>
                          <Select
                            value={formData.leaseDetails?.propertyType || 'building'}
                            onValueChange={(val: any) =>
                              setFormData({
                                ...formData,
                                leaseDetails: { ...formData.leaseDetails, propertyType: val },
                              })
                            }
                          >
                            <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="building">مبنى كامل</SelectItem>
                              <SelectItem value="land">أرض فضاء / موقع</SelectItem>
                              <SelectItem value="warehouse">مستودع / هنجر</SelectItem>
                              <SelectItem value="residence">مجمع سكني</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">المساحة الإجمالية (م²)</Label>
                          <Input
                            type="number"
                            value={formData.leaseDetails?.totalAreaSqm || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                leaseDetails: {
                                  ...formData.leaseDetails,
                                  totalAreaSqm: Number(e.target.value),
                                },
                              })
                            }
                            placeholder="مثال: 2500"
                            className="h-10 text-sm font-mono bg-white dark:bg-slate-900"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">اسم المبنى / رقم المخطط</Label>
                          <Input
                            value={formData.leaseDetails?.buildingName || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                leaseDetails: {
                                  ...formData.leaseDetails,
                                  buildingName: e.target.value,
                                },
                              })
                            }
                            placeholder="مخطط 14 / بلوك 2"
                            className="h-10 text-sm bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* B. Accommodation Agreement Specs */}
                  {formData.contractType === 'accommodation_agreement' && (
                    <div className="bg-indigo-50/60 dark:bg-indigo-950/20 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 space-y-4">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                        طاقة الإسكان والعمالة المحجوزة
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">عدد العمالة المستهدفة</Label>
                          <Input
                            type="number"
                            value={formData.accommodationDetails?.targetWorkersCount || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                accommodationDetails: {
                                  ...formData.accommodationDetails,
                                  targetWorkersCount: Number(e.target.value),
                                },
                              })
                            }
                            placeholder="50 عامل"
                            className="h-10 text-sm font-mono bg-white dark:bg-slate-900"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">عدد الأسرة المخصصة</Label>
                          <Input
                            type="number"
                            value={formData.accommodationDetails?.bedsCount || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                accommodationDetails: {
                                  ...formData.accommodationDetails,
                                  bedsCount: Number(e.target.value),
                                },
                              })
                            }
                            placeholder="50 سرير"
                            className="h-10 text-sm font-mono bg-white dark:bg-slate-900"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">سعر يومية العامل (ر.س/يوم)</Label>
                          <Input
                            type="number"
                            value={formData.accommodationDetails?.dailyRatePerWorker || ''}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setFormData({
                                ...formData,
                                billingRate: val,
                                accommodationDetails: {
                                  ...formData.accommodationDetails,
                                  dailyRatePerWorker: val,
                                },
                              });
                            }}
                            placeholder="35"
                            className="h-10 text-sm font-bold font-mono text-emerald-600 bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        💡 يتم ربط العقد آلياً بنظام الحضور والإشغال اليومي لحساب فواتير الشهر المالي بدقة.
                      </p>
                    </div>
                  )}

                  {/* C. Service Specs */}
                  {formData.contractType === 'service' && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
                        مواصفات ونطاق أعمال الصيانة والخدمات
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">تصنيف الخدمة</Label>
                          <Select
                            value={formData.serviceDetails?.serviceCategory || 'صيانة مصاعد'}
                            onValueChange={(val) =>
                              setFormData({
                                ...formData,
                                serviceDetails: { ...formData.serviceDetails, serviceCategory: val },
                              })
                            }
                          >
                            <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="صيانة مصاعد">صيانة مصاعد</SelectItem>
                              <SelectItem value="أنظمة إطفاء وإنذار">أنظمة إطفاء وإنذار</SelectItem>
                              <SelectItem value="نظافة وإصحاح بيئي">نظافة وإصحاح بيئي</SelectItem>
                              <SelectItem value="كاميرات وأمن وسلامة">كاميرات وأمن وسلامة</SelectItem>
                              <SelectItem value="تكييف وتبريد مركزي">تكييف وتبريد مركزي</SelectItem>
                              <SelectItem value="مكافحة حشرات">مكافحة حشرات</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">زمن الاستجابة للطوارئ (SLA)</Label>
                          <Select
                            value={String(formData.serviceDetails?.slaResponseHours || 4)}
                            onValueChange={(val) =>
                              setFormData({
                                ...formData,
                                serviceDetails: {
                                  ...formData.serviceDetails,
                                  slaResponseHours: Number(val),
                                },
                              })
                            }
                          >
                            <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2">خلال ساعتين (حرج جداً)</SelectItem>
                              <SelectItem value="4">خلال 4 ساعات (قياسي)</SelectItem>
                              <SelectItem value="12">خلال 12 ساعة</SelectItem>
                              <SelectItem value="24">خلال 24 ساعة</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">تكرار الزيارات الميدانية</Label>
                          <Select
                            value={formData.serviceDetails?.visitFrequency || 'monthly'}
                            onValueChange={(val: any) =>
                              setFormData({
                                ...formData,
                                serviceDetails: { ...formData.serviceDetails, visitFrequency: val },
                              })
                            }
                          >
                            <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">أسبوعياً</SelectItem>
                              <SelectItem value="biweekly">كل أسبوعين</SelectItem>
                              <SelectItem value="monthly">شهرياً</SelectItem>
                              <SelectItem value="quarterly">ربع سنوي (كل 3 أشهر)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* D. Supply Specs */}
                  {formData.contractType === 'supply' && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
                        مواصفات التوريد وجدول التسليم
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">فئة التوريد</Label>
                          <Select
                            value={formData.supplyDetails?.supplyCategory || 'water'}
                            onValueChange={(val: any) =>
                              setFormData({
                                ...formData,
                                supplyDetails: { ...formData.supplyDetails, supplyCategory: val },
                              })
                            }
                          >
                            <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="water">مياه شرب صهاريج</SelectItem>
                              <SelectItem value="diesel">ديزل للمولدات والمعدات</SelectItem>
                              <SelectItem value="furniture">أثاث ومفروشات</SelectItem>
                              <SelectItem value="appliances">أجهزة كهربائية وإلكترونية</SelectItem>
                              <SelectItem value="beds">أسرة ومراتب نوم</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">سعر الوحدة المقدر (ر.س)</Label>
                          <Input
                            type="number"
                            value={formData.supplyDetails?.unitPrice || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                supplyDetails: {
                                  ...formData.supplyDetails,
                                  unitPrice: Number(e.target.value),
                                },
                              })
                            }
                            placeholder="سعر الطن / الرد / الوحدة"
                            className="h-10 text-sm font-mono bg-white dark:bg-slate-900"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">جدول التوريد المتوقع</Label>
                          <Input
                            value={formData.supplyDetails?.deliverySchedule || 'عند الطلب'}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                supplyDetails: {
                                  ...formData.supplyDetails,
                                  deliverySchedule: e.target.value,
                                },
                              })
                            }
                            placeholder="يومي / أسبوعي / عند الطلب"
                            className="h-10 text-sm bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* E. Commercial Specs */}
                  {formData.contractType === 'commercial' && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
                        مواصفات النشاط التجاري والامتياز
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">نوع النشاط</Label>
                          <Select
                            value={formData.commercialDetails?.commercialActivity || 'grocery'}
                            onValueChange={(val: any) =>
                              setFormData({
                                ...formData,
                                commercialDetails: {
                                  ...formData.commercialDetails,
                                  commercialActivity: val,
                                },
                              })
                            }
                          >
                            <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="grocery">بقالة وتموينات</SelectItem>
                              <SelectItem value="restaurant">بوفيه / مطعم مجمع</SelectItem>
                              <SelectItem value="laundry">مغسلة ملابس مركزية</SelectItem>
                              <SelectItem value="sim_cards">منفذ شرائح واتصالات</SelectItem>
                              <SelectItem value="internet_kiosk">كشك إنترنت / خدمات</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">طبيعة العائد</Label>
                          <Select
                            value={formData.commercialDetails?.concessionType || 'fixed_rent'}
                            onValueChange={(val: any) =>
                              setFormData({
                                ...formData,
                                commercialDetails: {
                                  ...formData.commercialDetails,
                                  concessionType: val,
                                },
                              })
                            }
                          >
                            <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed_rent">إيجار ثابت مقطوع</SelectItem>
                              <SelectItem value="percentage">نسبة مئوية من المبيعات</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {formData.commercialDetails?.concessionType === 'percentage' && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">نسبة العمولة المقررة (%)</Label>
                            <Input
                              type="number"
                              value={formData.commercialDetails?.concessionPercentage || ''}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  commercialDetails: {
                                    ...formData.commercialDetails,
                                    concessionPercentage: Number(e.target.value),
                                  },
                                })
                              }
                              placeholder="مثال: 10%"
                              className="h-10 text-sm font-mono bg-white dark:bg-slate-900"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* F. Utility Specs */}
                  {formData.contractType === 'utility' && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
                        بيانات العدادات والمرافق الرسمية
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">نوع المرفق</Label>
                          <Select
                            value={formData.utilityDetails?.utilityType || 'electricity'}
                            onValueChange={(val: any) =>
                              setFormData({
                                ...formData,
                                utilityDetails: { ...formData.utilityDetails, utilityType: val },
                              })
                            }
                          >
                            <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="electricity">كهرباء</SelectItem>
                              <SelectItem value="water">مياه وطنية</SelectItem>
                              <SelectItem value="gas">غاز مركزي</SelectItem>
                              <SelectItem value="internet">شبكة إنترنت / اتصالات</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">رقم العداد (Meter #)</Label>
                          <Input
                            value={formData.utilityDetails?.meterNumber || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                utilityDetails: {
                                  ...formData.utilityDetails,
                                  meterNumber: e.target.value,
                                },
                              })
                            }
                            placeholder="رقم العداد المسجل"
                            className="h-10 text-sm font-mono bg-white dark:bg-slate-900"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">رقم الحساب / الفاتورة</Label>
                          <Input
                            value={formData.utilityDetails?.accountNumber || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                utilityDetails: {
                                  ...formData.utilityDetails,
                                  accountNumber: e.target.value,
                                },
                              })
                            }
                            placeholder="رقم السداد / الحساب"
                            className="h-10 text-sm font-mono bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Linked Residences Multi-Selector */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold">
                        المجمعات والسكنات المشمولة بالعقد ({formData.linkedResidences.length})
                      </Label>
                      <span className="text-[11px] text-slate-500">
                        اختر موقعاً أو أكثر لربط التكاليف والإشغال به
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-36 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                      {residences.map((res) => {
                        const isSelected = formData.linkedResidences.includes(res.id);
                        return (
                          <div
                            key={res.id}
                            onClick={() => handleToggleResidence(res.id, res.name)}
                            className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                            }`}
                          >
                            <span className="font-semibold truncate">{res.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Financials, VAT & Live Simulator */}
              {activeStep === 3 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-indigo-600" />
                      الشروط المالية والمحاكي الفوري والضريبة
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      تحديد آلية الاحتساب المالي والضريبة ودورات الاستحقاق مع محاكي إيرادات/مصروفات لحظي
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Billing Type */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">آلية الفوترة والاحتساب *</Label>
                      <Select
                        value={formData.billingType}
                        onValueChange={(val) => setFormData({ ...formData, billingType: val as BillingType })}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_person_per_day">للشخص / اليوم (تسكين عمالة يومي)</SelectItem>
                          <SelectItem value="fixed_monthly">مبلغ شهري ثابت مقطوع</SelectItem>
                          <SelectItem value="fixed_yearly">مبلغ سنوي مقطوع</SelectItem>
                          <SelectItem value="per_person_per_month">للشخص / الشهر</SelectItem>
                          <SelectItem value="per_room_per_month">للغرفة / الشهر</SelectItem>
                          <SelectItem value="per_unit">حسب استهلاك الوحدة (خزان / طن / لتر)</SelectItem>
                          <SelectItem value="per_invoice">حسب الفاتورة عند الطلب</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Billing Rate */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">القيمة / السعر التعاقدي (ر.س) *</Label>
                      <Input
                        type="number"
                        value={formData.billingRate || ''}
                        onChange={(e) => setFormData({ ...formData, billingRate: Number(e.target.value) })}
                        placeholder="0.00"
                        className="h-10 text-sm font-mono font-black text-indigo-600 text-lg"
                        required
                      />
                    </div>

                    {/* VAT Percentage */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">نسبة ضريبة القيمة المضافة (%)</Label>
                      <Select
                        value={String(formData.vatPercentage ?? 15)}
                        onValueChange={(v) => setFormData({ ...formData, vatPercentage: Number(v) })}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15% (النسبة النظامية القياسية بالسعودية)</SelectItem>
                          <SelectItem value="0">0% (معفى من الضريبة)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Payment Cycle */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">دورة السداد والاستحقاق</Label>
                      <Select
                        value={formData.paymentCycle || 'monthly'}
                        onValueChange={(val: any) => setFormData({ ...formData, paymentCycle: val })}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">شهرياً في نهاية الدورة</SelectItem>
                          <SelectItem value="quarterly">ربع سنوي (كل 3 أشهر)</SelectItem>
                          <SelectItem value="semi_annual">نصف سنوي (كل 6 أشهر)</SelectItem>
                          <SelectItem value="annual">سنوي مقدماً</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Advance Payment */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">دفعة مقدمة / تأمين تشغيلي (ر.س)</Label>
                      <Input
                        type="number"
                        value={formData.advancePayment || ''}
                        onChange={(e) => setFormData({ ...formData, advancePayment: Number(e.target.value) })}
                        placeholder="0.00"
                        className="h-10 text-sm font-mono"
                      />
                    </div>

                    {/* Payment Terms */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">شروط الدفع والاستحقاق</Label>
                      <Input
                        value={formData.paymentTerms || ''}
                        onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                        placeholder="سداد خلال 15 يوماً من استلام الفاتورة"
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>

                  {/* Realtime Live Financial Simulator Widget */}
                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 border border-indigo-900/50 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                          المحاكي المالي التقديري اللحظي
                        </span>
                      </div>
                      <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-400/30 text-[10px]">
                        احتساب فوري
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                      <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                        <span className="text-[11px] text-slate-400 block mb-1">المبلغ الأساسي</span>
                        <span className="font-extrabold text-sm font-mono text-slate-100">
                          {formatSAR(calculations.baseRate)} ر.س
                        </span>
                      </div>

                      <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                        <span className="text-[11px] text-slate-400 block mb-1">
                          الضريبة ({formData.vatPercentage}%)
                        </span>
                        <span className="font-extrabold text-sm font-mono text-amber-400">
                          {formatSAR(calculations.vatAmount)} ر.س
                        </span>
                      </div>

                      <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                        <span className="text-[11px] text-indigo-300 block mb-1 font-semibold">
                          التقدير الشهري الشامل
                        </span>
                        <span className="font-black text-base font-mono text-emerald-400">
                          {formatSAR(calculations.monthlyEstimate)} ر.س
                        </span>
                      </div>

                      <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                        <span className="text-[11px] text-indigo-300 block mb-1 font-semibold">
                          التقدير السنوي الإجمالي
                        </span>
                        <span className="font-black text-base font-mono text-sky-400">
                          {formatSAR(calculations.annualEstimate)} ر.س
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Duration, Renewal & Guarantees */}
              {activeStep === 4 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-indigo-600" />
                      المدة الزمنية، التجديد، والضمانات البنكية
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      تحديد فترة السريان وتوثيق الشيكات المؤجلة وخطابات الضمان
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Start Date */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">تاريخ بداية العقد *</Label>
                      <Input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        required
                        className="h-10 text-sm font-mono"
                      />
                    </div>

                    {/* End Date */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold">تاريخ نهاية العقد</Label>
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id="open-ended-full"
                            checked={formData.isOpenEnded}
                            onCheckedChange={(c) => setFormData({ ...formData, isOpenEnded: Boolean(c) })}
                          />
                          <label htmlFor="open-ended-full" className="text-xs font-semibold cursor-pointer">
                            عقد غير محدد المدة
                          </label>
                        </div>
                      </div>
                      <Input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        disabled={formData.isOpenEnded}
                        className="h-10 text-sm font-mono"
                      />
                    </div>

                    {/* Duration badge */}
                    {durationInMonths !== null && (
                      <div className="md:col-span-2 flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900">
                        <Clock className="w-4 h-4" />
                        المدة الزمنية الإجمالية المحسوبة للعقد: {durationInMonths} شهراً
                      </div>
                    )}

                    {/* Renewal Type */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">سياسة التجديد</Label>
                      <Select
                        value={formData.renewalType}
                        onValueChange={(val) => setFormData({ ...formData, renewalType: val as RenewalType })}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">تجديد يدوي عند الانتهاء</SelectItem>
                          <SelectItem value="auto_yearly">تجديد تلقائي سنوياً</SelectItem>
                          <SelectItem value="auto_monthly">تجديد تلقائي شهرياً</SelectItem>
                          <SelectItem value="auto_quarterly">تجديد تلقائي ربع سنوي</SelectItem>
                          <SelectItem value="auto_same_duration">تجديد تلقائي بنفس المدة الأصلية</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Notice Period */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">مهلة الإشعار قبل الانتهاء (أيام)</Label>
                      <Input
                        type="number"
                        value={formData.noticePeriodDays}
                        onChange={(e) => setFormData({ ...formData, noticePeriodDays: Number(e.target.value) })}
                        placeholder="30"
                        className="h-10 text-sm font-mono"
                      />
                    </div>
                  </div>

                  {/* Auto Renew Switch Card */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        تفعيل التجديد الآلي الذكي (Smart Auto-Renew)
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        سيقوم النظام بتمديد تاريخ الانتهاء تلقائياً وإصدار تنبيه مسبق للمراجعة
                      </p>
                    </div>
                    <Switch
                      checked={formData.autoRenew}
                      onCheckedChange={(checked) => setFormData({ ...formData, autoRenew: checked })}
                    />
                  </div>

                  {/* Guarantees & Securities Section */}
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
                          الضمانات البنكية والشيكات ({formData.guarantees?.length || 0})
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          إضافة شيكات ضمان أو خطابات ضمان بنكية أو سندات لأمر لحماية حقوق العقد
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleAddGuarantee}
                        className="gap-1 text-xs h-8"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        إضافة ضمان
                      </Button>
                    </div>

                    {formData.guarantees && formData.guarantees.length > 0 ? (
                      <div className="space-y-2.5">
                        {formData.guarantees.map((g, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-5 gap-3 items-center"
                          >
                            <div>
                              <Label className="text-[10px] text-slate-500">نوع الضمان</Label>
                              <Select
                                value={g.type}
                                onValueChange={(val: any) => handleUpdateGuarantee(idx, 'type', val)}
                              >
                                <SelectTrigger className="h-8 text-xs mt-0.5 bg-white dark:bg-slate-900">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="letter_of_credit">خطاب ضمان بنكي</SelectItem>
                                  <SelectItem value="check">شيك ضمان مؤجل</SelectItem>
                                  <SelectItem value="security_deposit">تأمين نقدي محجوز</SelectItem>
                                  <SelectItem value="bail">سند لأمر رسمي</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label className="text-[10px] text-slate-500">قيمة الضمان (ر.س)</Label>
                              <Input
                                type="number"
                                value={g.amount || ''}
                                onChange={(e) => handleUpdateGuarantee(idx, 'amount', Number(e.target.value))}
                                className="h-8 text-xs font-mono font-bold mt-0.5 bg-white dark:bg-slate-900"
                              />
                            </div>

                            <div>
                              <Label className="text-[10px] text-slate-500">اسم البنك / المصرف</Label>
                              <Input
                                value={g.bankName || ''}
                                onChange={(e) => handleUpdateGuarantee(idx, 'bankName', e.target.value)}
                                placeholder="مثال: الراجحي"
                                className="h-8 text-xs mt-0.5 bg-white dark:bg-slate-900"
                              />
                            </div>

                            <div>
                              <Label className="text-[10px] text-slate-500">رقم الشيك / المرجع</Label>
                              <Input
                                value={g.referenceNumber || ''}
                                onChange={(e) => handleUpdateGuarantee(idx, 'referenceNumber', e.target.value)}
                                placeholder="رقم الشيك أو المرجع"
                                className="h-8 text-xs font-mono mt-0.5 bg-white dark:bg-slate-900"
                              />
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-4">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveGuarantee(idx)}
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 h-8 px-2 text-xs gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                حذف
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-5 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
                        لا توجد ضمانات بنكية أو شيكات مسجلة لهذا العقد بعد. اضغط "+ إضافة ضمان" لإرفاق شيك أو خطاب ضمان.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 5: Review, Notes & Final Approvals */}
              {activeStep === 5 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      المراجعة الشاملة واعتماد العقد
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      تأكد من دقة وصحة البنود قبل الحفظ النهائي في قاعدة بيانات النظام
                    </p>
                  </div>

                  {/* Summary Dossier Card */}
                  <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[11px] text-slate-400 block">العقد المزمع اعتماده:</span>
                        <h4 className="text-lg font-black text-white">{formData.partyName || 'عقد جديد'}</h4>
                      </div>
                      <Badge className="bg-indigo-600 text-white text-xs px-3 py-1 font-bold">
                        {currentTypeInfo.labelAr} ({formData.contractCategory === 'revenue' ? 'إيراد 🟢' : 'مصروف 🔴'})
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-1">تاريخ البدء:</span>
                        <span className="font-bold font-mono">{formData.startDate || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1">تاريخ الانتهاء:</span>
                        <span className="font-bold font-mono">
                          {formData.isOpenEnded ? 'مفتوح (غير محدد)' : formData.endDate || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1">آلية الاحتساب:</span>
                        <span className="font-bold">{formData.billingUnit}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1">المبلغ الشامل التقديري:</span>
                        <span className="font-black text-emerald-400 font-mono text-sm">
                          {formatSAR(calculations.monthlyEstimate)} ر.س / شهر
                        </span>
                      </div>
                    </div>

                    {formData.linkedResidenceNames && formData.linkedResidenceNames.length > 0 && (
                      <div className="pt-3 border-t border-slate-800 text-xs">
                        <span className="text-slate-400 block mb-1.5">السكنات والمواقع المشمولة:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {formData.linkedResidenceNames.map((n, i) => (
                            <Badge key={i} variant="secondary" className="bg-slate-800 text-slate-200 text-[10px]">
                              📍 {n}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Operational Notes & Manager */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">رقم العقد الورقي / المرجع الداخلي (اختياري)</Label>
                      <Input
                        value={formData.contractNumber || ''}
                        onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                        placeholder="مثال: CNT-2026-001"
                        className="h-10 text-sm font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">المسؤول عن متابعة العقد</Label>
                      <Input
                        value={formData.contractManager || ''}
                        onChange={(e) => setFormData({ ...formData, contractManager: e.target.value })}
                        placeholder="اسم المشرف أو مدير العقود..."
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs font-bold">ملاحظات وشروط خاصة بالعقد</Label>
                      <Textarea
                        value={formData.notes || ''}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="اكتب أي شروط إضافية، بنود خاصة، أو تفاصيل ملحقة..."
                        rows={3}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation Actions */}
        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3" dir="rtl">
          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              إلغاء الأمر
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {studioMode === 'full' && activeStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveStep((prev) => prev - 1)}
                className="text-xs gap-1"
              >
                <ChevronRight className="w-4 h-4" />
                الخطوة السابقة
              </Button>
            )}

            {studioMode === 'full' && activeStep < 5 ? (
              <Button
                type="button"
                onClick={() => setActiveStep((prev) => prev + 1)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 px-5 shadow-sm shadow-indigo-600/20"
              >
                الخطوة التالية
                <ChevronLeft className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-2 px-7 shadow-md shadow-emerald-600/20"
              >
                {isSubmitting ? (
                  <>جاري الحفظ والتسجيل...</>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    {contractToEdit ? 'حفظ تعديلات العقد' : 'اعتماد وإنشاء العقد الآن 🎉'}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
