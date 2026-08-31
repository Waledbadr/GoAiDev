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
  Calendar,
  DollarSign,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  Layers,
  ArrowRight,
  Calculator,
  FileText,
} from 'lucide-react';
import {
  type Contract,
  type ContractFormData,
  type ContractType,
  type ContractCategory,
  type BillingType,
  type PartyType,
  type RenewalType,
  CONTRACT_TYPES,
  getContractTypeInfo,
  formatSAR,
} from '@/types/contracts';
import { useAccommodation } from '@/context/accommodation-context';
import { useToast } from '@/hooks/use-toast';

interface ContractStudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractToEdit?: Contract | null;
  onSave: (data: ContractFormData, status?: any) => Promise<any>;
}

// Icon mapper
const TYPE_ICONS: Record<string, any> = {
  Building2,
  Home,
  Users,
  Wrench,
  Droplets,
  Store,
  Flame,
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
    accommodationDetails: {
      targetWorkersCount: 0,
      dailyRatePerWorker: 35,
      bedsCount: 0,
    },
  });

  // Populate when editing
  useEffect(() => {
    if (contractToEdit) {
      setFormData({
        contractNumber: contractToEdit.contractNumber || '',
        title: contractToEdit.title || '',
        contractType: contractToEdit.contractType,
        contractCategory: contractToEdit.contractCategory,
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
        renewalType: contractToEdit.renewalType || 'manual',
        autoRenew: contractToEdit.autoRenew || false,
        noticePeriodDays: contractToEdit.noticePeriodDays || 30,
        paymentCycle: contractToEdit.paymentCycle || 'monthly',
        contractManager: contractToEdit.contractManager || '',
        notes: contractToEdit.notes || '',
        accommodationDetails: contractToEdit.accommodationDetails || {
          targetWorkersCount: 0,
          dailyRatePerWorker: 0,
          bedsCount: 0,
        },
      });
      setActiveStep(1);
    } else {
      // Default new contract dates (Starts today, ends in 1 year)
      const today = new Date().toISOString().split('T')[0];
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const nextYearStr = nextYear.toISOString().split('T')[0];

      setFormData({
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
        startDate: today,
        endDate: nextYearStr,
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
        accommodationDetails: {
          targetWorkersCount: 50,
          dailyRatePerWorker: 35,
          bedsCount: 50,
        },
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

  // Handle Company / Party Quick Fill
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

  // Financial Calculations
  const calculations = useMemo(() => {
    const rate = Number(formData.billingRate) || 0;
    const vatPct = Number(formData.vatPercentage) || 0;
    const vatVal = (rate * vatPct) / 100;
    const total = rate + vatVal;

    let monthlyEst = 0;
    if (formData.billingType === 'fixed_monthly') {
      monthlyEst = total;
    } else if (formData.billingType === 'fixed_yearly') {
      monthlyEst = total / 12;
    } else if (formData.billingType === 'per_person_per_day') {
      const workers = formData.accommodationDetails?.targetWorkersCount || 0;
      monthlyEst = rate * workers * 30 * (1 + vatPct / 100);
    } else if (formData.billingType === 'per_person_per_month') {
      const workers = formData.accommodationDetails?.targetWorkersCount || 0;
      monthlyEst = rate * workers * (1 + vatPct / 100);
    }

    return {
      vatAmount: vatVal,
      totalWithVat: total,
      monthlyEstimate: monthlyEst,
    };
  }, [formData.billingRate, formData.vatPercentage, formData.billingType, formData.accommodationDetails]);

  // Submit Handler
  const handleSubmit = async () => {
    if (!formData.partyName.trim()) {
      toast({
        title: 'اسم الطرف مطلوب',
        description: 'يرجى تحديد أو إدخال اسم الشركة أو الطرف الثاني.',
        variant: 'destructive',
      });
      return;
    }
    if (!formData.startDate) {
      toast({
        title: 'تاريخ البدء مطلوب',
        description: 'يرجى تحديد تاريخ بداية سريان العقد.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      toast({
        title: contractToEdit ? 'تم تحديث العقد بنجاح ✨' : 'تم إنشاء العقد بنجاح 🎉',
        description: `العقد مع ${formData.partyName} أصبح جاهزاً وفعالاً.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'حدث خطأ',
        description: err.message || 'تعذر حفظ العقد',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentTypeInfo = getContractTypeInfo(formData.contractType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
        {/* Top Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/20 backdrop-blur-md rounded-2xl border border-indigo-400/30 text-indigo-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  {contractToEdit ? 'تعديل بيانات العقد' : 'استوديو العقود الذكي 2.0'}
                  <Badge
                    variant="outline"
                    className="text-xs bg-indigo-500/20 border-indigo-400/40 text-indigo-300"
                  >
                    {formData.contractCategory === 'revenue' ? 'إيراد 🟢' : 'مصروف 🔴'}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-1">
                  إعداد وصياغة العقود التشغيلية والإسكانية بسهولة واحترافية فائقة
                </DialogDescription>
              </div>
            </div>

            {/* Quick vs Full Mode Switcher */}
            <div className="flex items-center bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setStudioMode('quick')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
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
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  studioMode === 'full'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                📋 الوضع الموجه (خطوة بخطوة)
              </button>
            </div>
          </div>

          {/* Stepper (Only in Full Mode) */}
          {studioMode === 'full' && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10 text-xs">
              {[
                { step: 1, label: '1. نوع العقد', icon: Layers },
                { step: 2, label: '2. الأطراف والمواقع', icon: Users },
                { step: 3, label: '3. المالية والفوترة', icon: DollarSign },
                { step: 4, label: '4. المدة والتجديد', icon: Calendar },
                { step: 5, label: '5. الشروط والملاحظات', icon: FileText },
              ].map((s) => {
                const Icon = s.icon;
                const isPassed = activeStep > s.step;
                const isCurrent = activeStep === s.step;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setActiveStep(s.step)}
                    className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg transition-all ${
                      isCurrent
                        ? 'bg-white/20 text-white font-bold'
                        : isPassed
                        ? 'text-emerald-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                        isCurrent
                          ? 'bg-indigo-500 text-white'
                          : isPassed
                          ? 'bg-emerald-500 text-slate-900 font-bold'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {isPassed ? <Check className="w-3 h-3" /> : s.step}
                    </div>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[62vh] overflow-y-auto space-y-6 text-start" dir="rtl">
          {/* ================= QUICK MODE ================= */}
          {studioMode === 'quick' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contract Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">نوع العقد</Label>
                  <Select
                    value={formData.contractType}
                    onValueChange={(val) => handleSelectType(val as ContractType)}
                  >
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="اختر نوع العقد" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPES.slice(0, 7).map((t) => (
                        <SelectItem key={t.type} value={t.type}>
                          <div className="flex items-center gap-2">
                            <span>{t.category === 'revenue' ? '🟢' : '🔴'}</span>
                            <span>{t.labelAr}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Company / Party Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">الطرف الثاني (الشركة / العميل)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.partyName}
                      onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
                      placeholder="اكتب اسم المنشأة أو الطرف"
                      className="h-10 text-sm"
                    />
                    {companies.length > 0 && (
                      <Select onValueChange={handleSelectCompany}>
                        <SelectTrigger className="w-32 h-10 text-xs">
                          <SelectValue placeholder="من القائمة" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((comp) => (
                            <SelectItem key={comp.id} value={comp.id}>
                              {comp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Billing Rate & Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">القيمة المالية (قبل الضريبة)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={formData.billingRate || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, billingRate: Number(e.target.value) })
                      }
                      placeholder="0.00"
                      className="h-10 text-sm font-mono"
                    />
                    <Select
                      value={formData.billingType}
                      onValueChange={(v) =>
                        setFormData({ ...formData, billingType: v as BillingType })
                      }
                    >
                      <SelectTrigger className="w-44 h-10 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_person_per_day">شخص / يوم</SelectItem>
                        <SelectItem value="fixed_monthly">شهري ثابت</SelectItem>
                        <SelectItem value="fixed_yearly">سنوي ثابت</SelectItem>
                        <SelectItem value="per_person_per_month">شخص / شهر</SelectItem>
                        <SelectItem value="per_invoice">حسب الفاتورة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Target Workers (if accommodation) */}
                {formData.billingType.includes('person') && (
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
                      className="h-10 text-sm"
                    />
                  </div>
                )}

                {/* Start Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">تاريخ البدء</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="h-10 text-sm font-mono"
                  />
                </div>

                {/* End Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">تاريخ الانتهاء</Label>
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
                <Label className="text-xs font-semibold">السكنات والمواقع المرتبطة:</Label>
                <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
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
                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:border-indigo-400'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                        {res.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================= FULL GUIDED MODE ================= */}
          {studioMode === 'full' && (
            <>
              {/* STEP 1: Contract Type Selection */}
              {activeStep === 1 && (
                <div className="space-y-4">
                  <div className="text-center sm:text-start">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      اختر طبيعة ونوع العقد
                    </h3>
                    <p className="text-xs text-slate-500">
                      يحدد نوع العقد الخصائص التشغيلية والمالية وطريقة الفوترة المناسبة
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {CONTRACT_TYPES.slice(0, 7).map((typeItem) => {
                      const isSelected = formData.contractType === typeItem.type;
                      const Icon = TYPE_ICONS[typeItem.icon] || Building2;
                      const isRev = typeItem.category === 'revenue';

                      return (
                        <div
                          key={typeItem.type}
                          onClick={() => handleSelectType(typeItem.type)}
                          className={`cursor-pointer rounded-2xl p-4 border-2 transition-all relative flex flex-col justify-between ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-md ring-2 ring-indigo-500/20'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
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
                              className={`text-[10px] ${
                                isRev
                                  ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                                  : 'border-rose-300 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30'
                              }`}
                            >
                              {isRev ? 'إيراد 🟢' : 'مصروف 🔴'}
                            </Badge>
                          </div>

                          <div className="mt-3">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                              {typeItem.labelAr}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                              {typeItem.descriptionAr}
                            </p>
                          </div>

                          {isSelected && (
                            <div className="absolute top-3 left-3 bg-indigo-600 text-white rounded-full p-1 shadow-sm">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: Parties & Assets */}
              {activeStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      بيانات الأطراف والمواقع المرتبطة
                    </h3>
                    <p className="text-xs text-slate-500">
                      حدد الطرف الثاني والسكنات أو المباني المشمولة بهذا العقد
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* First Party */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">الطرف الأول (الجهة التابعة لشركتنا)</Label>
                      <Input
                        value={formData.firstPartyName || 'شركة سي بي سي القابضة (CPC Holding Co.)'}
                        onChange={(e) => setFormData({ ...formData, firstPartyName: e.target.value })}
                        className="h-10 text-sm"
                      />
                    </div>

                    {/* Second Party Type */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">نوع الطرف الثاني</Label>
                      <Select
                        value={formData.partyType}
                        onValueChange={(val) =>
                          setFormData({ ...formData, partyType: val as PartyType })
                        }
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="company">شركة / مؤسسة عميلة</SelectItem>
                          <SelectItem value="vendor">مورد / مقاول معتمد</SelectItem>
                          <SelectItem value="individual">فرد / مستأجر شخصي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Party Name */}
                    <div className="space-y-1.5 md:col-span-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-semibold">اسم الطرف الثاني *</Label>
                        {companies.length > 0 && (
                          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                            أو اختر من الشركات المسجلة:
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={formData.partyName}
                          onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
                          placeholder="اكتب اسم الشركة أو المورد"
                          className="h-10 text-sm"
                          required
                        />
                        {companies.length > 0 && (
                          <Select onValueChange={handleSelectCompany}>
                            <SelectTrigger className="w-48 h-10 text-xs">
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

                    {/* Contact & Phone */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">مسؤول التواصل / الممثل</Label>
                      <Input
                        value={formData.partyContact || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, partyContact: e.target.value })
                        }
                        placeholder="الاسم الكامل"
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">رقم الهاتف / الجوال</Label>
                      <Input
                        value={formData.partyPhone || ''}
                        onChange={(e) => setFormData({ ...formData, partyPhone: e.target.value })}
                        placeholder="05XXXXXXXX"
                        className="h-10 text-sm font-mono"
                      />
                    </div>
                  </div>

                  {/* Linked Residences */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">
                        المجمعات والسكنات المشمولة بالعقد ({formData.linkedResidences.length})
                      </Label>
                      <span className="text-[11px] text-slate-500">
                        انقر على السكن لتحديده
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
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
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

              {/* STEP 3: Financials & Billing */}
              {activeStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      الشروط المالية وهيكل الفوترة
                    </h3>
                    <p className="text-xs text-slate-500">
                      حدد آلية الاحتساب والضريبة ومواعيد الدفعات
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Billing Type */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">طريقة الفوترة والاحتساب</Label>
                      <Select
                        value={formData.billingType}
                        onValueChange={(val) =>
                          setFormData({ ...formData, billingType: val as BillingType })
                        }
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_person_per_day">للشخص / اليوم (تسكين عمالة)</SelectItem>
                          <SelectItem value="fixed_monthly">مبلغ شهري ثابت</SelectItem>
                          <SelectItem value="fixed_yearly">مبلغ سنوي ثابت</SelectItem>
                          <SelectItem value="per_person_per_month">للشخص / الشهر</SelectItem>
                          <SelectItem value="per_room_per_month">للغرفة / الشهر</SelectItem>
                          <SelectItem value="per_invoice">حسب الفاتورة المقدمة</SelectItem>
                          <SelectItem value="per_unit">حسب الوحدة (خزان / دبة / لتر)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Billing Rate */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">القيمة / السعر التعاقدي (ر.س)</Label>
                      <Input
                        type="number"
                        value={formData.billingRate || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, billingRate: Number(e.target.value) })
                        }
                        placeholder="0.00"
                        className="h-10 text-sm font-mono font-bold"
                      />
                    </div>

                    {/* VAT Percentage */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">نسبة ضريبة القيمة المضافة (%)</Label>
                      <Select
                        value={String(formData.vatPercentage ?? 15)}
                        onValueChange={(v) =>
                          setFormData({ ...formData, vatPercentage: Number(v) })
                        }
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15% (النسبة القياسية بالسعودية)</SelectItem>
                          <SelectItem value="0">0% (معفى من الضريبة)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Payment Cycle */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">دورة السداد والاستحقاق</Label>
                      <Select
                        value={formData.paymentCycle || 'monthly'}
                        onValueChange={(val: any) =>
                          setFormData({ ...formData, paymentCycle: val })
                        }
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">شهري</SelectItem>
                          <SelectItem value="quarterly">ربع سنوي (كل 3 أشهر)</SelectItem>
                          <SelectItem value="semi_annual">نصف سنوي (كل 6 أشهر)</SelectItem>
                          <SelectItem value="annual">سنوي مقدماً</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Target workers count if accommodation */}
                    {formData.billingType.includes('person') && (
                      <div className="space-y-1.5 md:col-span-2 bg-indigo-50/40 dark:bg-indigo-950/20 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs font-semibold">العدد المستهدف للعمالة</Label>
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
                              className="h-10 text-sm mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold">عدد الأسرة المحجوزة</Label>
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
                              className="h-10 text-sm mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Realtime Live Financial Breakdown Card */}
                  <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-0.5">القيمة الأساسية</span>
                      <span className="font-bold text-sm font-mono">
                        {formatSAR(formData.billingRate)} ر.س
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-0.5">
                        الضريبة ({formData.vatPercentage}%)
                      </span>
                      <span className="font-bold text-sm font-mono text-amber-400">
                        {formatSAR(calculations.vatAmount)} ر.س
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-indigo-300 block mb-0.5 font-semibold">
                        الإجمالي الشامل
                      </span>
                      <span className="font-extrabold text-base font-mono text-emerald-400">
                        {formatSAR(calculations.totalWithVat)} ر.س
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Duration & Auto-Renewal */}
              {activeStep === 4 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      المدة الزمنية وقواعد التجديد
                    </h3>
                    <p className="text-xs text-slate-500">
                      تحديد فترة السريان، سياسة التنبيهات، والتجديد التلقائي
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Start Date */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">تاريخ بداية العقد *</Label>
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
                        <Label className="text-xs font-semibold">تاريخ نهاية العقد</Label>
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id="open-ended"
                            checked={formData.isOpenEnded}
                            onCheckedChange={(c) =>
                              setFormData({ ...formData, isOpenEnded: Boolean(c) })
                            }
                          />
                          <label htmlFor="open-ended" className="text-xs cursor-pointer">
                            عقد مفتوح / غير محدد
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

                    {/* Renewal Type */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">سياسة التجديد</Label>
                      <Select
                        value={formData.renewalType}
                        onValueChange={(val) =>
                          setFormData({ ...formData, renewalType: val as RenewalType })
                        }
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
                      <Label className="text-xs font-semibold">مهلة الإشعار قبل الانتهاء (أيام)</Label>
                      <Input
                        type="number"
                        value={formData.noticePeriodDays}
                        onChange={(e) =>
                          setFormData({ ...formData, noticePeriodDays: Number(e.target.value) })
                        }
                        placeholder="30"
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>

                  {/* Auto Renew Switch */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                        تفعيل التجديد الآلي الذكي (Smart Auto-Renew)
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        سيقوم النظام بتمديد تاريخ الانتهاء تلقائياً عند حلول الأجل دون انقطاع
                      </p>
                    </div>
                    <Switch
                      checked={formData.autoRenew}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, autoRenew: checked })
                      }
                    />
                  </div>
                </div>
              )}

              {/* STEP 5: Terms, Notes & Managers */}
              {activeStep === 5 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      المسؤوليات والملاحظات الإضافية
                    </h3>
                    <p className="text-xs text-slate-500">
                      توثيق مسؤولي المتابعة والشروط الخاصة بالعقد
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contract Number */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">رقم العقد الورقي / الرسمي (اختياري)</Label>
                      <Input
                        value={formData.contractNumber || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, contractNumber: e.target.value })
                        }
                        placeholder="مثال: CNT-2026-042"
                        className="h-10 text-sm font-mono"
                      />
                    </div>

                    {/* Contract Manager */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">المسؤول عن متابعة العقد</Label>
                      <Input
                        value={formData.contractManager || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, contractManager: e.target.value })
                        }
                        placeholder="اسم المشرف أو مدير الحساب"
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">ملاحظات وشروط خاصة</Label>
                    <Textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="اكتب أي بنود خاصة، جداول دفعات، أو اتفاقيات ملحقة..."
                      rows={4}
                      className="text-xs"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Navigation Actions */}
        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              إلغاء
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
                السابق
              </Button>
            )}

            {studioMode === 'full' && activeStep < 5 ? (
              <Button
                type="button"
                onClick={() => setActiveStep((prev) => prev + 1)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1 px-5"
              >
                التالي
                <ChevronLeft className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 px-6 shadow-md shadow-emerald-600/20"
              >
                {isSubmitting ? (
                  <>جاري الحفظ...</>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {contractToEdit ? 'حفظ التعديلات' : 'اعتماد وإنشاء العقد'}
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
