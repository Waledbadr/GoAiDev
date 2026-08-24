'use client';

import React, { useState, useEffect } from 'react';
import { useContracts } from '@/context/contracts-context';
import { useAccommodation } from '@/context/accommodation-context';
import { useLanguage } from '@/context/language-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Layers,
  Building2,
  Calendar,
  Receipt,
  Download,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  Globe,
} from 'lucide-react';
import Link from 'next/link';
import { ContractWorkspaceView } from '@/components/contracts2/ContractWorkspaceView';
import { CampEconomicsView } from '@/components/contracts2/CampEconomicsView';
import { TimelineRadarView } from '@/components/contracts2/TimelineRadarView';
import { ContractInvoicesRadar } from '@/components/contracts2/ContractInvoicesRadar';
import { ContractQuickRenewDialog } from '@/components/contracts2/ContractQuickRenewDialog';
import { type Contract } from '@/types/contracts';
import { useToast } from '@/hooks/use-toast';

export default function Contracts2Page() {
  const { contracts, loading, renewContract, reconcileContractLifecycle } = useContracts();
  const { locale, toggleLanguage } = useLanguage();
  const isAr = locale === 'ar';
  const { toast } = useToast();

  // Active Perspective: 'workspace' | 'economics' | 'timeline' | 'billing'
  const [activePerspective, setActivePerspective] = useState<'workspace' | 'economics' | 'timeline' | 'billing'>('workspace');

  // Quick Renew Dialog State
  const [contractToRenew, setContractToRenew] = useState<Contract | null>(null);

  useEffect(() => {
    reconcileContractLifecycle().catch(() => {});
  }, [reconcileContractLifecycle]);

  return (
    <div
      className="p-4 sm:p-8 space-y-6 max-w-[1700px] mx-auto text-start"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Top Header & Perspective Switcher Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-600/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {isAr ? 'منظومة العقود الذكية 2.0' : 'Contracts OS 2.0'}
              </h1>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 text-[10px] py-0.5">
                {isAr ? 'إصدار الجيل الثاني ✨' : 'Next-Gen Edition ✨'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAr
                ? 'مساحة العمل المتكاملة لإدارة وتعديل وتجديد العقود وربحية السكنات بدون نوافذ منبثقة'
                : 'Frictionless command center for contract lifecycle, camp economics, and instant billing'}
            </p>
          </div>
        </div>

        {/* 4 Next-Gen Perspectives */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setActivePerspective('workspace')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activePerspective === 'workspace'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{isAr ? 'مساحة العمل الحية' : 'Live Workspace'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePerspective('economics')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activePerspective === 'economics'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>{isAr ? 'اقتصاديات السكنات' : 'Camp Economics'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePerspective('timeline')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activePerspective === 'timeline'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>{isAr ? 'الرادار الزمني 2026' : 'Timeline Radar'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePerspective('billing')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activePerspective === 'billing'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>{isAr ? 'مركز الفوترة' : 'Billing Radar'}</span>
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={toggleLanguage}
            className="h-10 px-3 rounded-xl text-xs gap-1.5 font-bold text-slate-700 dark:text-slate-300"
          >
            <Globe className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? 'English' : 'عربي'}</span>
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="text-center py-24">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-semibold">
            {isAr ? 'جاري تهيئة مساحة العمل...' : 'Initializing Workspace...'}
          </p>
        </div>
      ) : (
        <>
          {/* PERSPECTIVE 1: Interactive Live Master-Detail Workspace */}
          {activePerspective === 'workspace' && <ContractWorkspaceView />}

          {/* PERSPECTIVE 2: Camp Economics & Asset Profitability */}
          {activePerspective === 'economics' && (
            <CampEconomicsView
              onSelectContract={(id) => {
                setActivePerspective('workspace');
              }}
            />
          )}

          {/* PERSPECTIVE 3: Visual Timeline Radar */}
          {activePerspective === 'timeline' && (
            <TimelineRadarView
              onSelectContract={(id) => {
                setActivePerspective('workspace');
              }}
              onRenewContract={(c) => {
                setContractToRenew(c);
              }}
            />
          )}

          {/* PERSPECTIVE 4: Invoices & Billing Center */}
          {activePerspective === 'billing' && (
            <ContractInvoicesRadar
              onSelectContractById={(id) => {
                setActivePerspective('workspace');
              }}
            />
          )}
        </>
      )}

      {/* Quick Renew Modal */}
      <ContractQuickRenewDialog
        contract={contractToRenew}
        open={Boolean(contractToRenew)}
        onOpenChange={(open) => !open && setContractToRenew(null)}
        onRenew={async (id, date) => {
          await renewContract(id, date);
          toast({
            title: isAr ? 'تم تجديد العقد بنجاح ⚡' : 'Contract Renewed Successfully ⚡',
            description: isAr ? `تم تمديد السريان حتى ${date}` : `Extended until ${date}`,
          });
        }}
      />
    </div>
  );
}
