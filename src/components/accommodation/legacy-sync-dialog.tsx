"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  RefreshCw,
  Database,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users,
  DoorClosed,
  ArrowRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { DEFAULT_LEGACY_REPORT_URL } from '@/lib/accommodation-legacy-sync';

interface PreviewData {
  ok: boolean;
  totalLegacyWorkers: number;
  existingResidencesCount: number;
  existingWorkersCount: number;
  existingOccupantsCount: number;
  residenceBreakdown: Record<
    string,
    { totalWorkers: number; buildingsCount: number; buildings: string[]; roomsCount: number }
  >;
  sampleRows?: any[];
}

export function LegacySyncDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(DEFAULT_LEGACY_REPORT_URL);
  const [autoCheckoutMissing, setAutoCheckoutMissing] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executingSync, setExecutingSync] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [syncResult, setSyncResult] = useState<any | null>(null);

  const { toast } = useToast();

  const handleFetchPreview = async () => {
    setLoadingPreview(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/accommodation/legacy-sync?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.ok) {
        setPreviewData(data);
        toast({
          title: '✅ تم جلب ومعاينة بيانات النظام القديم',
          description: `تم العثور على ${data.totalLegacyWorkers.toLocaleString()} عامل ساكن في السكنات`,
        });
      } else {
        toast({
          title: '❌ خطأ أثناء فحص البيانات',
          description: data.error || 'تعذر الاتصال بالنظام القديم',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '❌ فشل الاتصال',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteSync = async () => {
    setExecutingSync(true);
    try {
      const res = await fetch('/api/accommodation/legacy-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          autoCheckoutMissing,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSyncResult(data);
        toast({
          title: '🎉 تمت المزامنة بنجاح تام',
          description: `تم تسكين ${data.occupantsActive.toLocaleString()} عامل وتحديث ${data.residencesUpdated} سكنات ومجمعات.`,
        });
      } else {
        toast({
          title: '❌ فشلت المزامنة',
          description: data.error || 'حدث خطأ أثناء حفظ البيانات',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '❌ خطأ أثناء التنفيذ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setExecutingSync(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
        >
          <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
          مزامنة النظام القديم (تقرير التسكين)
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                مزامنة بيانات التسكين من النظام القديم
              </DialogTitle>
              <DialogDescription className="text-sm mt-1">
                سحب وتسكين العمالة الساكنة حالياً ومطابقة المجمعات، المباني، الطوابق، والغرف تلقائياً.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
          {/* URL & Configuration Box */}
          <div className="space-y-2 bg-muted/40 p-4 rounded-xl border border-border/60">
            <Label htmlFor="legacy-url" className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>رابط تقرير العمالة الساكنة بالسكنات (النظام القديم)</span>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                فتح الرابط في صفحة مستقلة <ExternalLink className="h-3 w-3" />
              </a>
            </Label>
            <div className="flex gap-2">
              <Input
                id="legacy-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                dir="ltr"
                className="font-mono text-xs"
                placeholder="http://..."
              />
              <Button
                onClick={handleFetchPreview}
                disabled={loadingPreview || executingSync}
                className="gap-2 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <RefreshCw className={`h-4 w-4 ${loadingPreview ? 'animate-spin' : ''}`} />
                {loadingPreview ? 'جارِ الفحص...' : 'فحص ومعاينة البيانات'}
              </Button>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse pt-2">
              <Checkbox
                id="auto-checkout"
                checked={autoCheckoutMissing}
                onCheckedChange={(checked) => setAutoCheckoutMissing(!!checked)}
              />
              <label
                htmlFor="auto-checkout"
                className="text-xs text-muted-foreground cursor-pointer select-none leading-none"
              >
                إجراء خروج آلي (Check-Out) لأي عامل ساكن سابقاً بالنظام وغير موجود في هذا التقرير
              </label>
            </div>
          </div>

          {/* Success Summary if Executed */}
          {syncResult && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2 font-bold text-base text-emerald-700 dark:text-emerald-300 mb-2">
                <CheckCircle2 className="h-5 w-5" />
                اكتملت المزامنة بنجاح تام!
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mt-3">
                <div className="bg-background/80 p-3 rounded-lg border border-emerald-500/20">
                  <div className="text-2xl font-bold text-emerald-600">
                    {syncResult.occupantsActive?.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">عامل ساكن حالياً</div>
                </div>
                <div className="bg-background/80 p-3 rounded-lg border border-emerald-500/20">
                  <div className="text-2xl font-bold text-emerald-600">
                    {syncResult.residencesUpdated}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">مجمع سكني تم تحديثه</div>
                </div>
                <div className="bg-background/80 p-3 rounded-lg border border-emerald-500/20">
                  <div className="text-2xl font-bold text-emerald-600">
                    {syncResult.workersCreatedOrUpdated?.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">سجل عامل محدث</div>
                </div>
                <div className="bg-background/80 p-3 rounded-lg border border-emerald-500/20">
                  <div className="text-2xl font-bold text-emerald-600">
                    {syncResult.occupantsCheckedOut}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">حالة خروج آلية</div>
                </div>
              </div>
            </div>
          )}

          {/* Preview Breakdown */}
          {previewData && !syncResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <span>نتائج فحص التقرير القديم</span>
                  <Badge variant="secondary" className="font-mono">
                    {previewData.totalLegacyWorkers.toLocaleString()} عامل
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  توزيع السكنات والمباني والغرف
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(previewData.residenceBreakdown || {}).map(([resName, stats]) => (
                  <Card key={resName} className="border border-border/70 hover:border-indigo-500/40 transition-colors">
                    <CardContent className="p-3.5 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-bold text-sm flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 text-indigo-500" />
                          <span>{resName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {stats.buildingsCount} مباني ({stats.buildings.slice(0, 4).join(', ')}{stats.buildings.length > 4 ? '...' : ''})
                          </span>
                          <span className="flex items-center gap-1">
                            <DoorClosed className="h-3 w-3" />
                            {stats.roomsCount} غرفة
                          </span>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                          {stats.totalWorkers.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">عامل</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/40 pt-4 flex sm:justify-between items-center gap-2">
          <div className="text-xs text-muted-foreground">
            {previewData ? 'اضغط على بدء المزامنة لاعتماد التسكين في قاعدة البيانات.' : 'قم بفحص البيانات أولاً للمعاينة.'}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              إغلاق
            </Button>
            <Button
              onClick={handleExecuteSync}
              disabled={executingSync || !previewData}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <RefreshCw className={`h-4 w-4 ${executingSync ? 'animate-spin' : ''}`} />
              {executingSync ? 'جارِ تنفيذ المزامنة...' : 'بدء المزامنة والاعتماد'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
