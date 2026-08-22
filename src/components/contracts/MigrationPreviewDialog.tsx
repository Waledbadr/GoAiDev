'use client';

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Database } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { planContractMigration, type MigrationPlan } from '@/lib/contract-migration';
import { formatSAR } from '@/types/contracts';

/**
 * معاينة ترحيل العقود من النظام القديم إلى `contractsV2`.
 *
 * السكربت المكافئ يحتاج بيانات اعتماد مسؤول في متغيّرات البيئة؛ هنا تعمل نفس
 * الخطة بجلسة المستخدم الحالية. القراءة والتخطيط يحدثان عند الفتح، ولا يُكتب
 * أي شيء إلا بضغطة صريحة على زر التنفيذ.
 */
export function MigrationPreviewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const buildPlan = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    setError(null);
    try {
      const [legacySnap, companiesSnap, residencesSnap, v2Snap] = await Promise.all([
        getDocs(collection(db, 'contracts')),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'residences')),
        getDocs(collection(db, 'contractsV2')),
      ]);

      setPlan(planContractMigration({
        legacyContracts: legacySnap.docs.map(d => ({ id: d.id, ...d.data() })) as never,
        companyNames: new Map(companiesSnap.docs.map(d => [d.id, (d.data().name as string) ?? d.id])),
        residenceNames: new Map(residencesSnap.docs.map(d => [d.id, (d.data().name as string) ?? d.id])),
        allResidenceIds: residencesSnap.docs.map(d => d.id),
        existingV2Ids: new Set(v2Snap.docs.map(d => d.id)),
      }));
    } catch (e) {
      console.error('Migration preview failed:', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      setPlan(null);
      setApplied(false);
      buildPlan();
    }
  }, [open, buildPlan]);

  const apply = useCallback(async () => {
    if (!db || !plan || plan.items.length === 0) return;
    setApplying(true);
    try {
      // معرّف المستند = معرّف العقد القديم، فالتشغيل مرتين يكتب فوق نفسه ولا
      // يُنشئ نسخاً مكرّرة.
      const batch = writeBatch(db);
      for (const item of plan.items) {
        batch.set(doc(db, 'contractsV2', item.contractId), item.payload, { merge: true });
      }
      await batch.commit();

      setApplied(true);
      toast({
        title: 'تم الترحيل',
        description: `رُحّل ${plan.items.length} عقد إلى النظام الجديد.`,
      });
    } catch (e) {
      console.error('Migration apply failed:', e);
      toast({
        title: 'فشل الترحيل',
        description: e instanceof Error ? e.message : 'خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setApplying(false);
    }
  }, [plan, toast]);

  const blocked = plan?.skips.filter(s => s.reason === 'unresolved_rate_unit') ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            معاينة ترحيل العقود إلى النظام الجديد
          </DialogTitle>
          <DialogDescription>
            لا يُكتب شيء حتى تضغط «تنفيذ الترحيل». العقود تحتفظ بمعرّفاتها، فالفواتير
            المرتبطة بها تظل صحيحة، وإعادة التشغيل تكتب فوق القديم ولا تُكرّره.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              جارٍ قراءة العقود وبناء الخطة…
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg border border-destructive/40 bg-destructive/5 text-sm">
              <div className="font-semibold text-destructive mb-1">تعذّرت قراءة العقود</div>
              <div className="text-muted-foreground font-mono text-xs">{error}</div>
            </div>
          )}

          {plan && !loading && (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/30">
                  <div className="text-2xl font-bold text-emerald-600">{plan.items.length}</div>
                  <div className="text-xs text-muted-foreground">جاهز للترحيل</div>
                </div>
                <div className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/30">
                  <div className="text-2xl font-bold text-amber-600">{plan.skips.length}</div>
                  <div className="text-xs text-muted-foreground">مُستبعَد</div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/40">
                  <div className="text-2xl font-bold">{plan.overwrites.length}</div>
                  <div className="text-xs text-muted-foreground">سيُكتب فوقه</div>
                </div>
              </div>

              {blocked.length > 0 && (
                <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/5 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {blocked.length} عقد محجوب: وحدة الأجرة غير محدَّدة
                  </div>
                  <p className="text-xs text-muted-foreground">
                    النظام الجديد يحمل الأجرة اليومية صراحةً، فلا بد أن تُعرف وحدة الرقم
                    القديم قبل نقله — يومية أم شهرية. حدّدها لكل عقد من شاشة «عقود
                    السكن» ثم أعد المعاينة.
                  </p>
                </div>
              )}

              {plan.items.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">سيُرحَّل:</h4>
                  <div className="space-y-1.5">
                    {plan.items.map(item => (
                      <div
                        key={item.contractId}
                        className="flex items-center justify-between gap-3 text-sm p-2.5 rounded-md border bg-card"
                      >
                        <span className="font-medium truncate">{item.companyName}</span>
                        <span className="flex items-center gap-2 text-xs font-mono shrink-0" dir="ltr">
                          <span className="text-muted-foreground">
                            {formatSAR(item.rawRate)} {item.rateUnit === 'daily' ? '/يوم' : '/شهر'}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-emerald-600 font-bold">
                            {formatSAR(item.dailyRate)} /يوم
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {item.residenceCount} سكن
                          </Badge>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {plan.skips.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">لن يُرحَّل:</h4>
                  <div className="space-y-1.5">
                    {plan.skips.map(skip => (
                      <div
                        key={skip.contractId}
                        className="text-xs p-2.5 rounded-md border bg-muted/30"
                      >
                        <span className="font-medium">{skip.companyName}</span>
                        <span className="text-muted-foreground"> — {skip.detailAr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
          <Button
            onClick={apply}
            disabled={applying || applied || !plan || plan.items.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {applying ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ الترحيل…</>
            ) : applied ? (
              <><CheckCircle2 className="h-4 w-4" /> تم الترحيل</>
            ) : (
              <>تنفيذ الترحيل ({plan?.items.length ?? 0})</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
