"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  History,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  LogIn,
  LogOut,
  Building2,
  Users,
  Database,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAccommodation } from '@/context/accommodation-context';
import { DEFAULT_2026_MONTHS } from '@/lib/accommodation-billing-sync';

export function HistorySyncDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedMonthIds, setSelectedMonthIds] = useState<string[]>(
    DEFAULT_2026_MONTHS.map((m) => m.id)
  );
  const [result, setResult] = useState<any>(null);

  const { refresh } = useAccommodation();
  const { toast } = useToast();

  const toggleMonth = (id: string) => {
    setSelectedMonthIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedMonthIds(DEFAULT_2026_MONTHS.map((m) => m.id));
  };

  const clearAll = () => {
    setSelectedMonthIds([]);
  };

  const handlePreviewDryRun = async () => {
    if (selectedMonthIds.length === 0) {
      toast({
        title: '⚠️ تنبيه',
        description: 'يرجى اختيار شهر واحد على الأقل للمزامنة.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const selected = DEFAULT_2026_MONTHS.filter((m) => selectedMonthIds.includes(m.id));
      const res = await fetch('/api/accommodation/sync-in-out-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: selected, dryRun: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(data.summary);
        toast({
          title: '✅ تمت المعاينة بنجاح',
          description: `تم فحص ${data.summary.totalFetchedRows.toLocaleString()} حركة عبر ${selected.length} أشهر.`,
        });
      } else {
        throw new Error(data.error || 'فشلت المعاينة');
      }
    } catch (err: any) {
      toast({
        title: '❌ خطأ أثناء المعاينة',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSync = async () => {
    if (selectedMonthIds.length === 0) return;

    setSyncing(true);
    try {
      const selected = DEFAULT_2026_MONTHS.filter((m) => selectedMonthIds.includes(m.id));
      const res = await fetch('/api/accommodation/sync-in-out-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: selected, dryRun: false }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(data.summary);
        await refresh();
        toast({
          title: '🎉 تمت المزامنة وحفظ السجل التاريخي بنجاح!',
          description: `تم تسجيل ${data.summary.newCheckInsCount} حركة دخول و ${data.summary.newCheckOutsCount} حركة خروج في سجلات العمال والغرف.`,
        });
      } else {
        throw new Error(data.error || 'فشلت المزامنة');
      }
    } catch (err: any) {
      toast({
        title: '❌ خطأ أثناء المزامنة والتسجيل',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
          >
            <History className="h-4 w-4 text-indigo-600" />
            استيراد سجل الدخول والخروج (2026)
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-indigo-600" />
            استيراد ومزامنة حركات الدخول والخروج التاريخية (2026)
          </DialogTitle>
          <DialogDescription className="text-xs">
            سحب فواتير وحركات التسكين لجميع أشهر 2026 وتسجيل حركات الدخول والخروج في سجل كل موظف وكل غرفة بقاعدة
            البيانات D1.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Months Selection Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                الأشهر المراد استيرادها من بداية 2026:
              </Label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-primary hover:underline font-semibold"
                >
                  تحديد الكل (8 أشهر)
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-muted-foreground hover:underline"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/20 p-3 rounded-lg border border-border">
              {DEFAULT_2026_MONTHS.map((m) => {
                const checked = selectedMonthIds.includes(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => toggleMonth(m.id)}
                    className={`flex items-center justify-between p-2 rounded border transition-all cursor-pointer ${
                      checked
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-500/40 text-indigo-900 dark:text-indigo-200'
                        : 'bg-card border-border/50 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`m-${m.id}`}
                        checked={checked}
                        onCheckedChange={() => toggleMonth(m.id)}
                      />
                      <Label htmlFor={`m-${m.id}`} className="text-xs font-semibold cursor-pointer">
                        {m.name}
                      </Label>
                    </div>
                    <span className="text-[10px] font-mono opacity-70">
                      {m.startDate.slice(5)} ⬅️ {m.endDate.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviewDryRun}
              disabled={loading || syncing || selectedMonthIds.length === 0}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              معاينة الفحص (Dry Run)
            </Button>

            <Button
              size="sm"
              onClick={handleExecuteSync}
              disabled={loading || syncing || selectedMonthIds.length === 0}
              className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Sparkles className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'جارِ الحفظ والتسجيل في D1...' : 'بدء الاستيراد والتسجيل الفعلي'}
            </Button>
          </div>

          {/* Results Summary */}
          {result && (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-muted-foreground">نتائج المعالجة:</div>
              <div className="grid grid-cols-3 gap-2">
                <Card className="p-2.5 border-border text-center">
                  <div className="text-[11px] text-muted-foreground">إجمالي الحركات المفحوصة</div>
                  <div className="text-lg font-bold font-mono text-primary mt-0.5">
                    {result.totalFetchedRows?.toLocaleString()}
                  </div>
                </Card>
                <Card className="p-2.5 border-emerald-500/20 bg-emerald-50/20 text-center">
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1">
                    <LogIn className="h-3 w-3" /> حركات الدخول (Date In)
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {result.newCheckInsCount?.toLocaleString()}
                  </div>
                </Card>
                <Card className="p-2.5 border-amber-500/20 bg-amber-50/20 text-center">
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1">
                    <LogOut className="h-3 w-3" /> حركات الخروج (Date Out)
                  </div>
                  <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                    {result.newCheckOutsCount?.toLocaleString()}
                  </div>
                </Card>
              </div>

              {/* Monthly breakdown table */}
              <div className="border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-muted/40 text-[11px]">
                    <tr>
                      <th className="p-1.5">الشهر</th>
                      <th className="p-1.5 text-center">السجلات</th>
                      <th className="p-1.5 text-center text-emerald-600">دخول</th>
                      <th className="p-1.5 text-center text-amber-600">خروج</th>
                      <th className="p-1.5 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(result.monthSummaries || []).map((ms: any, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="p-1.5 font-medium">{ms.month}</td>
                        <td className="p-1.5 text-center font-mono">{ms.records}</td>
                        <td className="p-1.5 text-center font-mono text-emerald-600">{ms.checkIns}</td>
                        <td className="p-1.5 text-center font-mono text-amber-600">{ms.checkOuts}</td>
                        <td className="p-1.5 text-center">
                          <Badge variant="outline" className="text-[9px] py-0">
                            {ms.status === 'success' ? 'مكتمل' : 'فشل'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
