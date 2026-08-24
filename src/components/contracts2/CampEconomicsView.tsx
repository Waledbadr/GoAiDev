'use client';

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { useContracts } from '@/context/contracts-context';
import { useAccommodation } from '@/context/accommodation-context';
import { useLanguage } from '@/context/language-context';
import { type Contract, formatSAR, getMonthlyValue, getContractTypeInfo } from '@/types/contracts';

interface CampEconomicsViewProps {
  onSelectContract?: (contractId: string) => void;
}

export function CampEconomicsView({ onSelectContract }: CampEconomicsViewProps) {
  const { contracts } = useContracts();
  const { residences } = useAccommodation();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';

  const campEconomics = useMemo(() => {
    let totalPortfolioRevenue = 0;
    let totalPortfolioExpense = 0;

    const list = residences.map((res) => {
      const linkedContracts = contracts.filter(
        (c) =>
          !c.archivedAt &&
          c.status === 'Active' &&
          c.linkedResidences &&
          c.linkedResidences.includes(res.id)
      );

      let campRevenue = 0;
      let campExpense = 0;
      const revenueContracts: Contract[] = [];
      const expenseContracts: Contract[] = [];

      linkedContracts.forEach((c) => {
        const val = getMonthlyValue(c).amount || 0;
        if (c.contractCategory === 'revenue') {
          campRevenue += val;
          revenueContracts.push(c);
        } else {
          campExpense += val;
          expenseContracts.push(c);
        }
      });

      totalPortfolioRevenue += campRevenue;
      totalPortfolioExpense += campExpense;

      const netProfit = campRevenue - campExpense;
      const marginPct = campRevenue > 0 ? Math.round((netProfit / campRevenue) * 100) : 0;

      return {
        residence: res,
        revenue: campRevenue,
        expense: campExpense,
        netProfit,
        marginPct,
        revenueContracts,
        expenseContracts,
        totalContractsCount: linkedContracts.length,
      };
    });

    const portfolioNet = totalPortfolioRevenue - totalPortfolioExpense;

    return {
      campList: list,
      totalRevenue: totalPortfolioRevenue,
      totalExpense: totalPortfolioExpense,
      portfolioNet,
    };
  }, [contracts, residences]);

  return (
    <div className="space-y-6 text-start" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top Portfolio Summary Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold">
              {isAr ? 'منظومة اقتصاديات وربحية السكنات' : 'Camp & Residence Economics OS'}
            </h2>
          </div>
          <p className="text-xs text-slate-300">
            {isAr
              ? 'تحليل التدفق المالي لكل مجمع سكني (إيرادات تسكين الشركات vs تكاليف الإيجار والتشغيل والصيانة)'
              : 'Camp-by-camp P&L analysis: Company accommodation revenue vs building lease and op-costs'}
          </p>
        </div>

        {/* Global Net Indicator */}
        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
          <div>
            <span className="text-[11px] text-slate-300 block">
              {isAr ? 'صافي الأرباح التشغيلية للمحفظة' : 'Portfolio Net Operating Cashflow'}
            </span>
            <span
              className={`font-extrabold text-2xl font-mono ${
                campEconomics.portfolioNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatSAR(campEconomics.portfolioNet)} SAR
            </span>
            <span className="text-[10px] text-slate-400 block">
              {isAr ? 'شهرياً بعد خصم كافة الالتزامات' : 'Monthly Net Profit Margin'}
            </span>
          </div>
        </div>
      </div>

      {/* Camp Economics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campEconomics.campList.map((item) => {
          const isProfitable = item.netProfit >= 0;

          return (
            <div
              key={item.residence.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all space-y-4 flex flex-col justify-between"
            >
              {/* Camp Header */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                        {item.residence.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {item.totalContractsCount} {isAr ? 'عقود تشغيلية وإسكانية' : 'linked active contracts'}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold ${
                      isProfitable
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
                    }`}
                  >
                    {isAr ? `هامش الربح: ${item.marginPct}%` : `Margin: ${item.marginPct}%`}
                  </Badge>
                </div>

                {/* Financial Health Bar */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{isAr ? 'الإيراد 🟢' : 'Revenue 🟢'}</span>
                    <span className="font-bold font-mono text-emerald-600 text-xs">
                      +{formatSAR(item.revenue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{isAr ? 'المصروف 🔴' : 'OpEx 🔴'}</span>
                    <span className="font-bold font-mono text-rose-600 text-xs">
                      -{formatSAR(item.expense)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block">
                      {isAr ? 'صافي الربح 💰' : 'Net Profit 💰'}
                    </span>
                    <span
                      className={`font-extrabold font-mono text-xs ${
                        isProfitable ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatSAR(item.netProfit)}
                    </span>
                  </div>
                </div>

                {/* Revenue Contracts List */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    {isAr ? `عقود الإيراد والتسكين (${item.revenueContracts.length}):` : `Accommodation Revenue (${item.revenueContracts.length}):`}
                  </span>
                  {item.revenueContracts.length === 0 ? (
                    <p className="text-[10px] text-slate-400">{isAr ? 'لا توجد عقود تسكين مسجلة بهذا السكن' : 'No accommodation contracts linked'}</p>
                  ) : (
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {item.revenueContracts.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => onSelectContract && onSelectContract(c.id)}
                          className="p-1.5 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-[10px] flex items-center justify-between cursor-pointer hover:bg-emerald-100/60 transition-all"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                            {c.partyName}
                          </span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                            +{formatSAR(getMonthlyValue(c).amount)} SAR
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expense Contracts List */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    {isAr
                      ? `عقود الإيجار والتشغيل والمصروفات (${item.expenseContracts.length}):`
                      : `Operating Expenses & Leases (${item.expenseContracts.length}):`}
                  </span>
                  {item.expenseContracts.length === 0 ? (
                    <p className="text-[10px] text-slate-400">{isAr ? 'لا توجد عقود مصروفات مرتبطة' : 'No expense contracts linked'}</p>
                  ) : (
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {item.expenseContracts.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => onSelectContract && onSelectContract(c.id)}
                          className="p-1.5 rounded-lg bg-rose-50/40 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-[10px] flex items-center justify-between cursor-pointer hover:bg-rose-100/60 transition-all"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                            {c.partyName} ({isAr ? getContractTypeInfo(c.contractType).labelAr.split('(')[0] : getContractTypeInfo(c.contractType).labelEn.split('(')[0]})
                          </span>
                          <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                            -{formatSAR(getMonthlyValue(c).amount)} SAR
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
