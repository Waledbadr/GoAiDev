'use client';

import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useContracts } from '@/context/contracts-context';
import { useLanguage } from '@/context/language-context';
import { type Contract, formatSAR, getContractTypeInfo, getMonthlyValue } from '@/types/contracts';
import { parseISO, differenceInDays } from 'date-fns';

interface TimelineRadarViewProps {
  onSelectContract?: (contractId: string) => void;
  onRenewContract?: (contract: Contract) => void;
}

export function TimelineRadarView({
  onSelectContract,
  onRenewContract,
}: TimelineRadarViewProps) {
  const { contracts } = useContracts();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  const months = [
    { num: '01', nameAr: 'يناير', nameEn: 'January' },
    { num: '02', nameAr: 'فبراير', nameEn: 'February' },
    { num: '03', nameAr: 'مارس', nameEn: 'March' },
    { num: '04', nameAr: 'أبريل', nameEn: 'April' },
    { num: '05', nameAr: 'مايو', nameEn: 'May' },
    { num: '06', nameAr: 'يونيو', nameEn: 'June' },
    { num: '07', nameAr: 'يوليو', nameEn: 'July' },
    { num: '08', nameAr: 'أغسطس', nameEn: 'August' },
    { num: '09', nameAr: 'سبتمبر', nameEn: 'September' },
    { num: '10', nameAr: 'أكتوبر', nameEn: 'October' },
    { num: '11', nameAr: 'نوفمبر', nameEn: 'November' },
    { num: '12', nameAr: 'ديسمبر', nameEn: 'December' },
  ];

  const timelineMatrix = useMemo(() => {
    return months.map((m) => {
      const monthStr = `${selectedYear}-${m.num}`;

      const expiringContracts = contracts.filter((c) => {
        if (!c.endDate || c.isOpenEnded || c.archivedAt) return false;
        return c.endDate.startsWith(monthStr);
      });

      let activeRev = 0;
      let activeExp = 0;
      contracts.forEach((c) => {
        if (c.archivedAt || c.status !== 'Active') return false;
        const val = getMonthlyValue(c).amount || 0;
        if (c.contractCategory === 'revenue') activeRev += val;
        else activeExp += val;
      });

      return {
        ...m,
        monthStr,
        expiringContracts,
        projectedRevenue: activeRev,
        projectedExpense: activeExp,
        netCashflow: activeRev - activeExp,
      };
    });
  }, [contracts, selectedYear]);

  const urgentExpiring = useMemo(() => {
    const today = new Date();
    return contracts.filter((c) => {
      if (!c.endDate || c.isOpenEnded || c.archivedAt || c.status !== 'Active') return false;
      try {
        const diff = differenceInDays(parseISO(c.endDate), today);
        return diff >= 0 && diff <= 45;
      } catch {
        return false;
      }
    });
  }, [contracts]);

  return (
    <div className="space-y-6 text-start" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold">
              {isAr ? 'الرادار الزمني واستحقاقات العقود' : 'Timeline & Expiration Radar'}
            </h2>
          </div>
          <p className="text-xs text-slate-300">
            {isAr
              ? 'تتبع التوزيع الزمني لانتهاء العقود، مواعيد التجديد، والتوقعات المالية لشهر بشهر'
              : 'Month-by-month expiry milestones, upcoming renewals, and cashflow projections'}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setSelectedYear((y) => y - 1)}
            className="p-1 hover:bg-white/20 rounded-lg text-white"
          >
            {isAr ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <span className="font-bold font-mono px-2">{selectedYear}</span>
          <button
            type="button"
            onClick={() => setSelectedYear((y) => y + 1)}
            className="p-1 hover:bg-white/20 rounded-lg text-white"
          >
            {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Urgent Expirations Banner */}
      {urgentExpiring.length > 0 && (
        <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {isAr
                ? `عقود تتطلب التجديد العاجل (${urgentExpiring.length} عقود تنتهي قريباً):`
                : `Expiring Soon Radar (${urgentExpiring.length} contracts within 45 days):`}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {urgentExpiring.map((c) => {
              const diff = differenceInDays(parseISO(c.endDate), new Date());
              return (
                <div
                  key={c.id}
                  className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/40 shadow-sm flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                      {c.partyName}
                    </span>
                    <p className="text-[11px] text-amber-600 font-semibold">
                      {isAr ? `متبقي ${diff} يوماً فقط! (${c.endDate})` : `${diff} days remaining (${c.endDate})`}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => onRenewContract && onRenewContract(c)}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] h-7 px-3 rounded-lg gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {isAr ? 'تجديد' : 'Renew'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Timeline Calendar Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {timelineMatrix.map((item) => {
          const hasExpirations = item.expiringContracts.length > 0;

          return (
            <div
              key={item.num}
              className={`p-4 rounded-3xl border transition-all space-y-3 flex flex-col justify-between ${
                hasExpirations
                  ? 'bg-amber-50/30 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/50 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {isAr ? item.nameAr : item.nameEn} {selectedYear}
                </span>
                {hasExpirations ? (
                  <Badge className="bg-amber-500 text-white text-[10px] py-0">
                    {item.expiringContracts.length} {isAr ? 'ينتهي' : 'Expiring'}
                  </Badge>
                ) : (
                  <span className="text-[11px] text-slate-400">{isAr ? 'مستقر' : 'Stable'}</span>
                )}
              </div>

              <div className="space-y-1.5 flex-1">
                {hasExpirations ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {item.expiringContracts.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => onSelectContract && onSelectContract(c.id)}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/40 text-[11px] cursor-pointer hover:border-amber-400 space-y-0.5"
                      >
                        <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                          <span className="truncate max-w-[140px]">{c.partyName}</span>
                          <span className="font-mono text-[10px] text-slate-500">{c.endDate?.slice(8)}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {isAr ? getContractTypeInfo(c.contractType).labelAr : getContractTypeInfo(c.contractType).labelEn}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 text-center py-4">
                    {isAr ? 'لا توجد عقود تنتهي في هذا الشهر' : 'No contracts expiring this month'}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">{isAr ? 'صافي التدفق:' : 'Net Flow:'}</span>
                <span className="font-bold text-emerald-600">
                  +{formatSAR(item.netCashflow)} SAR
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
