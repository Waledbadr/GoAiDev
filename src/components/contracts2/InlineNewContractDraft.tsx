'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles,
  Building2,
  Check,
  DollarSign,
  Layers,
} from 'lucide-react';
import {
  type ContractFormData,
  type ContractType,
  type BillingType,
  CONTRACT_TYPES,
  getContractTypeInfo,
  formatSAR,
} from '@/types/contracts';
import { useAccommodation } from '@/context/accommodation-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';

interface InlineNewContractDraftProps {
  onCancel: () => void;
  onSuccess: (newContractId: string) => void;
  onSave: (data: ContractFormData) => Promise<string>;
}

export function InlineNewContractDraft({
  onCancel,
  onSuccess,
  onSave,
}: InlineNewContractDraftProps) {
  const { companies, residences } = useAccommodation();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const nextYearStr = nextYear.toISOString().split('T')[0];

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
    startDate: today,
    endDate: nextYearStr,
    isOpenEnded: false,
    billingType: 'per_person_per_day',
    billingRate: 35,
    vatPercentage: 15,
    billingUnit: isAr ? 'شخص/يوم' : 'person/day',
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

  const handleSelectCompany = (comp: { id: string; name: string; contactPerson?: string; phone?: string; email?: string }) => {
    setFormData((prev) => ({
      ...prev,
      partyId: comp.id,
      partyName: comp.name,
      partyType: 'company',
      partyContact: comp.contactPerson || prev.partyContact,
      partyPhone: comp.phone || prev.partyPhone,
      partyEmail: comp.email || prev.partyEmail,
    }));
  };

  const handleToggleResidence = (resId: string, resName: string) => {
    setFormData((prev) => {
      const exists = prev.linkedResidences.includes(resId);
      const nextIds = exists
        ? prev.linkedResidences.filter((id) => id !== resId)
        : [...prev.linkedResidences, resId];
      const nextNames = exists
        ? (prev.linkedResidenceNames || []).filter((n) => n !== resName)
        : [...(prev.linkedResidenceNames || []), resName];
      return { ...prev, linkedResidences: nextIds, linkedResidenceNames: nextNames };
    });
  };

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

    return { vatAmount: vatVal, totalWithVat: total, monthlyEstimate: monthlyEst };
  }, [formData.billingRate, formData.vatPercentage, formData.billingType, formData.accommodationDetails]);

  const handleSubmit = async () => {
    if (!formData.partyName.trim()) {
      toast({
        title: isAr ? 'اسم الطرف مطلوب' : 'Party Name is required',
        description: isAr ? 'يرجى تحديد أو إدخال اسم الشركة أو الطرف الثاني' : 'Please select or enter the company name',
        variant: 'destructive',
      });
      return;
    }
    if (!formData.startDate) {
      toast({
        title: isAr ? 'تاريخ البدء مطلوب' : 'Start Date is required',
        description: isAr ? 'يرجى تحديد تاريخ بداية سريان العقد' : 'Please enter the contract start date',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const newId = await onSave(formData);
      toast({
        title: isAr ? 'تم إنشاء العقد بنجاح ✨' : 'Contract Created Successfully ✨',
        description: isAr ? `تمت إضافة عقد ${formData.partyName} إلى مساحة العمل.` : `Added ${formData.partyName} to workspace.`,
      });
      onSuccess(newId);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create contract', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-3xl border border-indigo-200 dark:border-indigo-900/60 shadow-xl overflow-hidden animate-in fade-in duration-200 text-start"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 rounded-2xl border border-indigo-400/30 text-indigo-300">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{isAr ? 'صياغة مسودة عقد جديد' : 'New Contract Draft'}</h2>
            <p className="text-xs text-slate-300">{isAr ? 'إدخال مباشر وتفاعلي داخل نفس مساحة العمل' : 'Direct inline drafting inside your workspace'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-300 hover:text-white text-xs">
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 px-5 shadow-lg shadow-emerald-600/30"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'اعتماد وحفظ العقد' : 'Commit & Create')}
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Step 1: Choose Nature of Contract */}
        <div className="space-y-3">
          <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            {isAr ? '1. نوع وطبيعة العقد التشغيلي:' : '1. Contract Category & Type:'}
          </Label>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {CONTRACT_TYPES.slice(0, 7).map((t) => {
              const isSelected = formData.contractType === t.type;
              const isRev = t.category === 'revenue';
              return (
                <div
                  key={t.type}
                  onClick={() => handleSelectType(t.type)}
                  className={`cursor-pointer p-3 rounded-2xl border-2 transition-all flex flex-col justify-between text-center ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-800/40'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                    {isAr ? t.labelAr.split('(')[0] : t.labelEn.split('(')[0]}
                  </div>
                  <Badge
                    variant="outline"
                    className={`mt-2 text-[9px] mx-auto ${
                      isRev ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                    }`}
                  >
                    {isRev ? (isAr ? 'إيراد 🟢' : 'Rev 🟢') : (isAr ? 'مصروف 🔴' : 'Exp 🔴')}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Parties & Assets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-bold">{isAr ? 'اسم الطرف الثاني (الشركة / المورد / العميل) *' : 'Party / Client / Vendor Name *'}</Label>
            <div className="flex gap-2">
              <Input
                value={formData.partyName}
                onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
                placeholder={isAr ? 'اكتب اسم المنشأة أو العميل...' : 'Type company or client name...'}
                className="h-10 text-xs bg-white dark:bg-slate-900"
                required
              />
              {companies.length > 0 && (
                <Select onValueChange={(id) => {
                  const c = companies.find((x) => x.id === id);
                  if (c) handleSelectCompany(c);
                }}>
                  <SelectTrigger className="w-44 h-10 text-xs bg-white dark:bg-slate-900">
                    <SelectValue placeholder={isAr ? 'من المسجلين' : 'Saved Parties'} />
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

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{isAr ? 'رقم الجوال / التواصل' : 'Phone / Contact'}</Label>
            <Input
              value={formData.partyPhone || ''}
              onChange={(e) => setFormData({ ...formData, partyPhone: e.target.value })}
              placeholder="05XXXXXXXX"
              className="h-10 text-xs bg-white dark:bg-slate-900 font-mono"
            />
          </div>

          {/* Linked Residences Selector */}
          <div className="md:col-span-3 space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <Label className="text-xs font-bold">
              {isAr ? `السكنات والمجمعات المشمولة بالعقد (${formData.linkedResidences.length}):` : `Linked Camps & Residences (${formData.linkedResidences.length}):`}
            </Label>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
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
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    📍 {res.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step 3: Financial & Duration */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{isAr ? 'طريقة الفوترة' : 'Billing Method'}</Label>
            <Select value={formData.billingType} onValueChange={(v) => setFormData({ ...formData, billingType: v as BillingType })}>
              <SelectTrigger className="h-10 text-xs">
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

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{isAr ? 'القيمة التعاقدية (ر.س)' : 'Billing Rate (SAR)'}</Label>
            <Input
              type="number"
              value={formData.billingRate || ''}
              onChange={(e) => setFormData({ ...formData, billingRate: Number(e.target.value) })}
              placeholder="35"
              className="h-10 text-xs font-mono font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{isAr ? 'تاريخ البدء' : 'Start Date'}</Label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="h-10 text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{isAr ? 'تاريخ الانتهاء' : 'End Date'}</Label>
            <Input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="h-10 text-xs font-mono"
            />
          </div>

          {formData.billingType.includes('person') && (
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-bold">{isAr ? 'عدد العمالة المستهدفة للتسكين' : 'Target Worker Headcount'}</Label>
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
                placeholder="50"
                className="h-10 text-xs"
              />
            </div>
          )}

          <div className="md:col-span-4 space-y-1.5">
            <Label className="text-xs font-bold">{isAr ? 'ملاحظات وشروط إضافية' : 'Notes & Special Conditions'}</Label>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={isAr ? 'اكتب أي شروط خاصة أو تفاصيل سداد...' : 'Add payment terms or notes...'}
              rows={2}
              className="text-xs"
            />
          </div>
        </div>

        {/* Live Financial Indicator */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-medium text-slate-300">
              {isAr ? 'التقدير المالي المتوقع شهرياً:' : 'Estimated Monthly Flow:'}
            </span>
            <span className="font-extrabold text-base font-mono text-emerald-400">
              {formatSAR(calculations.monthlyEstimate)} SAR / mo
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span>{isAr ? 'الأساسي:' : 'Base:'} <strong className="font-mono text-white">{formatSAR(formData.billingRate)}</strong></span>
            <span>+ {isAr ? 'الضريبة (15%):' : 'VAT (15%):'} <strong className="font-mono text-amber-400">{formatSAR(calculations.vatAmount)}</strong></span>
            <span>= {isAr ? 'الإجمالي:' : 'Total:'} <strong className="font-mono text-emerald-400">{formatSAR(calculations.totalWithVat)}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
