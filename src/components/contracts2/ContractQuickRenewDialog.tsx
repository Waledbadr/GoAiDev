'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, Calendar, Sparkles } from 'lucide-react';
import { type Contract, formatSAR } from '@/types/contracts';
import { format, addMonths, addYears, parseISO } from 'date-fns';
import { useLanguage } from '@/context/language-context';

interface ContractQuickRenewDialogProps {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenew: (contractId: string, newEndDate: string) => Promise<void>;
}

export function ContractQuickRenewDialog({
  contract,
  open,
  onOpenChange,
  onRenew,
}: ContractQuickRenewDialogProps) {
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const [newEndDate, setNewEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (contract?.endDate) {
      try {
        const currentEnd = parseISO(contract.endDate);
        const calculated = addYears(currentEnd, 1);
        setNewEndDate(format(calculated, 'yyyy-MM-dd'));
      } catch {
        const today = new Date();
        setNewEndDate(format(addYears(today, 1), 'yyyy-MM-dd'));
      }
    }
  }, [contract]);

  if (!contract) return null;

  const handleApplyPreset = (months: number) => {
    try {
      const base = contract.endDate ? parseISO(contract.endDate) : new Date();
      const target = addMonths(base, months);
      setNewEndDate(format(target, 'yyyy-MM-dd'));
    } catch {
      const target = addMonths(new Date(), months);
      setNewEndDate(format(target, 'yyyy-MM-dd'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEndDate) return;
    setIsSubmitting(true);
    try {
      await onRenew(contract.id, newEndDate);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white text-start" dir={isAr ? 'rtl' : 'ltr'}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-xl">
              <RefreshCw className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white">
                {isAr ? 'تجديد العقد الفوري ⚡' : 'Instant Contract Renewal ⚡'}
              </DialogTitle>
              <DialogDescription className="text-emerald-100 text-xs mt-0.5">
                {isAr ? 'تمديد سريان العقد وتحديث تاريخ الانتهاء بنقرة واحدة' : 'Extend contract expiry date with one click'}
              </DialogDescription>
            </div>
          </div>

          <div className="mt-4 bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-200">{isAr ? 'الطرف / العميل' : 'Party / Client'}</p>
              <p className="font-semibold text-sm truncate max-w-[220px]">{contract.partyName}</p>
            </div>
            <div className={isAr ? 'text-end' : 'text-right'}>
              <p className="text-xs text-emerald-200">{isAr ? 'القيمة المالية' : 'Rate'}</p>
              <p className="font-bold text-sm">{formatSAR(contract.billingRate)} SAR</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-start" dir={isAr ? 'rtl' : 'ltr'}>
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">
                {isAr ? 'الانتهاء الحالي' : 'Current Expiry'}
              </span>
              <span className="font-semibold text-rose-600 dark:text-rose-400 text-sm">
                {contract.endDate || '---'}
              </span>
            </div>
            <div className={isAr ? 'text-end' : 'text-right'}>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">
                {isAr ? 'تاريخ التجديد الجديد' : 'New Expiry Date'}
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                {newEndDate || '---'}
              </span>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
              {isAr ? 'فترات التجديد السريعة:' : 'Quick Presets:'}
            </Label>
            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset(1)}
                className="text-xs"
              >
                +1 {isAr ? 'شهر' : 'Mo'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset(3)}
                className="text-xs"
              >
                +3 {isAr ? 'أشهر' : 'Mos'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset(6)}
                className="text-xs"
              >
                +6 {isAr ? 'أشهر' : 'Mos'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset(12)}
                className="text-xs font-bold border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50"
              >
                +1 {isAr ? 'سنة كاملة' : 'Year'}
              </Button>
            </div>
          </div>

          {/* Date Input */}
          <div className="space-y-1.5">
            <Label htmlFor="renewal-date" className="text-xs font-semibold">
              {isAr ? 'تاريخ نهاية العقد الجديد' : 'New Contract End Date'}
            </Label>
            <Input
              id="renewal-date"
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              required
              className="font-mono text-sm"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !newEndDate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs px-5 font-bold"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {isAr ? 'جاري التجديد...' : 'Renewing...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  {isAr ? 'تأكيد تمديد العقد' : 'Confirm Renewal'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
