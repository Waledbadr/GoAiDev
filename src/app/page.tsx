'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardWrapper } from '@/components/dashboard/dashboard-wrapper';
import { useResidences } from '@/context/residences-context';
import { useContracts } from '@/context/contracts-context';
import { useIncomeExpenseTransactions } from '@/context/income-expense-transactions-context';
import { useInventory } from '@/context/inventory-context';
import { useLanguage } from '@/context/language-context';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts';
import { Building2, FileText, Home, PieChart as PieChartIcon, Truck, Users, Wallet, Clock, ArrowRight, Activity, Bell, AlertTriangle, TrendingUp, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// --- Reusable Widget Card ---
const WidgetCard = ({ title, icon: Icon, children, href, className }: { title: string, icon: any, children: React.ReactNode, href?: string, className?: string }) => (
  <div className={cn("bg-white dark:bg-gray-800/80 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm flex flex-col h-full", className)}>
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      {href && (
        <Link href={href} className="text-gray-400 hover:text-blue-500 transition-colors">
          <ArrowRight className="w-5 h-5" />
        </Link>
      )}
    </div>
    <div className="flex-1 flex flex-col">
      {children}
    </div>
  </div>
);

function DashboardContent() {
  const { dict, locale } = useLanguage();
  const isAr = locale === 'ar';

  // Contexts
  const { residences = [], pendingTransfers = [] } = useResidences();
  const { contracts = [] } = useContracts();
  const { transactions = [] } = useIncomeExpenseTransactions();
  const { items: inventoryItems = [], transfers = [] } = useInventory();
  
  // Local states for custom queries
  const [timesheet7Days, setTimesheet7Days] = useState<any[]>([]);
  const [todayRecords, setTodayRecords] = useState<any[]>([]);

  // Fetch recent timesheet data (Last 7 Days)
  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        if (!db) return;
        const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd'); // Includes today (7 days total)
        const q = query(
          collection(db, 'attendanceRecords'),
          where('date', '>=', sevenDaysAgo)
        );
        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(doc => doc.data());
        
        setTimesheet7Days(records);
        
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        setTodayRecords(records.filter(r => r.date === todayStr));
      } catch (err) {
        console.error('Failed to fetch attendance for dashboard:', err);
      }
    };
    fetchAttendance();
  }, []);

  // --- 1. Accommodation Computations ---
  const totalCapacity = useMemo(() => residences.reduce((acc, r) => acc + (r.capacity || 0), 0), [residences]);
  const totalOccupied = useMemo(() => residences.reduce((acc, r) => acc + (r.occupancy || 0), 0), [residences]);
  const occupancyRate = totalCapacity > 0 ? ((totalOccupied / totalCapacity) * 100).toFixed(1) : 0;
  
  const residenceChartData = useMemo(() => {
    return residences.map(r => ({
      name: isAr ? r.nameAr || r.nameEn : r.nameEn || r.nameAr,
      Occupied: r.occupancy || 0,
      Vacant: (r.capacity || 0) - (r.occupancy || 0),
      capacity: r.capacity || 0,
      occupancyRatio: r.capacity ? ((r.occupancy || 0) / r.capacity) * 100 : 0
    })).sort((a, b) => b.occupancyRatio - a.occupancyRatio).slice(0, 10); // Top 10 most occupied
  }, [residences, isAr]);

  const bottleneckResidences = residenceChartData.filter(r => r.occupancyRatio >= 95);

  // --- 2. Timesheet Computations ---
  const presentCount = todayRecords.filter(r => r.status === 'Present').length;
  const leaveCount = todayRecords.filter(r => r.status === 'Leave').length;
  const absentCount = todayRecords.filter(r => r.status === 'Absent').length;
  
  const tsTrendData = useMemo(() => {
    const days: Record<string, { Present: number, Absent: number, Leave: number }> = {};
    for (let i = 6; i >= 0; i--) {
      days[format(subDays(new Date(), i), 'yyyy-MM-dd')] = { Present: 0, Absent: 0, Leave: 0 };
    }
    
    timesheet7Days.forEach(r => {
      if (days[r.date]) {
        if (r.status === 'Present') days[r.date].Present++;
        if (r.status === 'Absent') days[r.date].Absent++;
        if (r.status === 'Leave') days[r.date].Leave++;
      }
    });

    return Object.entries(days).map(([date, counts]) => ({
      date: date.slice(5), // Show MM-DD
      ...counts
    }));
  }, [timesheet7Days]);

  // --- 3. Contracts Computations ---
  const activeContracts = contracts.filter(c => c.status === 'active');
  const totalContractValue = activeContracts.reduce((acc, c) => acc + (c.totalAmount || 0), 0);
  
  const expiringContracts = activeContracts.filter(c => {
    if (!c.endDate) return false;
    const daysLeft = (new Date(c.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
    return daysLeft > 0 && daysLeft <= 30;
  });

  const contractCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    activeContracts.forEach(c => {
      const cat = c.contractCategory || 'Other';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [activeContracts]);

  // --- 4. Financials Computations ---
  const currentMonth = format(new Date(), 'yyyy-MM');
  const financialSummary = useMemo(() => {
    let income = 0; let expense = 0;
    transactions.forEach(t => {
      if (t.type === 'income') income += (t.amount || 0);
      else if (t.type === 'expense') expense += (t.amount || 0);
    });
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const expenseCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense' && t.date?.startsWith(currentMonth)).forEach(t => {
      const cat = t.category || 'Uncategorized';
      map[cat] = (map[cat] || 0) + (t.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [transactions, currentMonth]);

  const topExpenses = useMemo(() => {
    return transactions.filter(t => t.type === 'expense' && t.date?.startsWith(currentMonth))
      .sort((a,b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 5);
  }, [transactions, currentMonth]);

  // --- 5. Materials Computations ---
  const lowStockItems = inventoryItems.filter(i => (i.quantity || 0) <= (i.minQuantity || 5));
  
  const topConsumedItems = useMemo(() => {
    const consumptionMap: Record<string, number> = {};
    const itemNames: Record<string, string> = {};
    transfers.filter(t => t.status === 'Completed').forEach(t => {
      t.items?.forEach(item => {
        consumptionMap[item.id] = (consumptionMap[item.id] || 0) + (item.quantity || 0);
        itemNames[item.id] = isAr ? item.nameAr || item.nameEn : item.nameEn || item.nameAr;
      });
    });
    return Object.entries(consumptionMap)
      .map(([id, qty]) => ({ name: itemNames[id] || id, quantity: qty }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [transfers, isAr]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 p-4 sm:p-6 lg:p-8 pb-20">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            {isAr ? 'لوحة القيادة المتقدمة' : 'Advanced Dashboard'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {isAr ? 'تحليلات تفصيلية ورؤى شاملة لجميع الأقسام.' : 'Detailed analytics and comprehensive insights across all modules.'}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {format(new Date(), 'EEEE, dd MMMM yyyy')}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* === Accommodation Widget === */}
        <WidgetCard title={isAr ? 'إشغال المجمعات' : 'Residences Occupancy'} icon={Home} href="/accommodation" className="xl:col-span-2">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{isAr ? 'نسبة الإشغال الكلية' : 'Total Occupancy Rate'}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{occupancyRate}%</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{isAr ? 'السعة الكلية' : 'Total Capacity'}</p>
              <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mt-1">{totalCapacity}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{isAr ? 'الساكنين حالياً' : 'Current Residents'}</p>
              <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mt-1">{totalOccupied}</p>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={residenceChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px' }} />
                <Legend />
                <Bar dataKey="Occupied" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} name={isAr ? 'مشغول' : 'Occupied'} />
                <Bar dataKey="Vacant" stackId="a" fill="#e5e7eb" radius={[4, 4, 0, 0]} name={isAr ? 'شاغر' : 'Vacant'} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {bottleneckResidences.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">{isAr ? 'تنبيه اختناق' : 'Bottleneck Alert'}</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {isAr ? 'المجمعات التالية بلغت طاقتها الاستيعابية (أكثر من 95%):' : 'The following residences are at over 95% capacity:'} 
                  {' '} {bottleneckResidences.map(r => r.name).join(', ')}
                </p>
              </div>
            </div>
          )}
        </WidgetCard>

        {/* === Timesheet Widget === */}
        <WidgetCard title={isAr ? 'توجه الحضور الأسبوعي' : 'Weekly Attendance Trend'} icon={Users} href="/timesheet">
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <p className="text-2xl font-bold text-green-600">{presentCount}</p>
              <p className="text-xs font-medium text-gray-500 mt-1">{isAr ? 'حاضر اليوم' : 'Present Today'}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
              <p className="text-2xl font-bold text-yellow-600">{leaveCount}</p>
              <p className="text-xs font-medium text-gray-500 mt-1">{isAr ? 'مجاز اليوم' : 'Leave Today'}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
              <p className="text-2xl font-bold text-red-600">{absentCount}</p>
              <p className="text-xs font-medium text-gray-500 mt-1">{isAr ? 'غائب اليوم' : 'Absent Today'}</p>
            </div>
          </div>
          
          <div className="h-[250px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tsTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                <RechartsTooltip contentStyle={{ borderRadius: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="Present" stroke="#10b981" strokeWidth={3} dot={{r: 4}} name={isAr ? 'حضور' : 'Present'} />
                <Line type="monotone" dataKey="Absent" stroke="#ef4444" strokeWidth={2} dot={{r: 3}} name={isAr ? 'غياب' : 'Absent'} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </WidgetCard>

        {/* === Financials Widget === */}
        <WidgetCard title={isAr ? 'الملخص المالي والمصروفات' : 'Financials & Expenses'} icon={Wallet} href="/income-expenses" className="xl:col-span-2">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="flex-1 bg-green-50/50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800/30">
              <p className="text-sm text-green-600 dark:text-green-400">{isAr ? 'إجمالي الإيرادات' : 'Total Income'}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{financialSummary.income.toLocaleString()} <span className="text-sm font-normal">SAR</span></p>
            </div>
            <div className="flex-1 bg-red-50/50 dark:bg-red-900/20 rounded-xl p-4 border border-red-100 dark:border-red-800/30">
              <p className="text-sm text-red-600 dark:text-red-400">{isAr ? 'إجمالي المصروفات' : 'Total Expenses'}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{financialSummary.expense.toLocaleString()} <span className="text-sm font-normal">SAR</span></p>
            </div>
            <div className="flex-1 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30">
              <p className="text-sm text-blue-600 dark:text-blue-400">{isAr ? 'صافي الرصيد' : 'Net Balance'}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{financialSummary.balance.toLocaleString()} <span className="text-sm font-normal">SAR</span></p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6 h-[250px]">
            {/* Donut Chart */}
            <div className="flex-1 h-full">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 text-center mb-2">
                {isAr ? `توزيع مصروفات (${currentMonth})` : `Expenses Breakdown (${currentMonth})`}
              </h4>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategoryData}
                    cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}
                    dataKey="value"
                  >
                    {expenseCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => `${value.toLocaleString()} SAR`} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Expenses List */}
            <div className="flex-1 h-full overflow-hidden flex flex-col">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-4">
                {isAr ? 'أعلى 5 منصرفات' : 'Top 5 Expenses'}
              </h4>
              <div className="space-y-3 overflow-y-auto pr-2">
                {topExpenses.length > 0 ? topExpenses.map((expense, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{expense.description || expense.category}</p>
                      <p className="text-xs text-gray-500">{expense.date}</p>
                    </div>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400 whitespace-nowrap ml-3">
                      {expense.amount?.toLocaleString()}
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500">{isAr ? 'لا توجد منصرفات' : 'No expenses found'}</p>
                )}
              </div>
            </div>
          </div>
        </WidgetCard>

        {/* === Contracts Widget === */}
        <WidgetCard title={isAr ? 'نظرة على العقود' : 'Contracts Overview'} icon={FileText} href="/contracts">
           <div className="grid grid-cols-2 gap-4 mb-6">
             <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
               <p className="text-sm text-gray-500 dark:text-gray-400">{isAr ? 'العقود الفعالة' : 'Active Contracts'}</p>
               <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{activeContracts.length}</p>
             </div>
             <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 rounded-xl p-4">
               <p className="text-sm text-orange-600 dark:text-orange-400">{isAr ? 'تنتهي قريباً (30 يوم)' : 'Expiring Soon'}</p>
               <p className="text-3xl font-bold text-orange-700 dark:text-orange-300 mt-1 flex items-center gap-2">
                 {expiringContracts.length}
                 {expiringContracts.length > 0 && <Bell className="w-5 h-5 animate-pulse" />}
               </p>
             </div>
           </div>

           <div className="h-[200px] w-full mt-auto">
             <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 text-center mb-2">
               {isAr ? 'توزيع أنواع العقود' : 'Contracts by Category'}
             </h4>
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={contractCategoryData}
                   cx="50%" cy="50%" outerRadius={70}
                   dataKey="value"
                   labelLine={false}
                   label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                     const RADIAN = Math.PI / 180;
                     const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                     const x = cx + radius * Math.cos(-midAngle * RADIAN);
                     const y = cy + radius * Math.sin(-midAngle * RADIAN);
                     return percent > 0.05 ? (
                       <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11}>
                         {`${(percent * 100).toFixed(0)}%`}
                       </text>
                     ) : null;
                   }}
                 >
                   {contractCategoryData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <RechartsTooltip contentStyle={{ borderRadius: '12px' }} />
               </PieChart>
             </ResponsiveContainer>
           </div>
        </WidgetCard>

        {/* === Materials Widget === */}
        <WidgetCard title={isAr ? 'حركة المخزون' : 'Inventory Movements'} icon={Truck} href="/Materials" className="xl:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            
            {/* KPI Column */}
            <div className="flex flex-col gap-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm text-purple-600 dark:text-purple-400">{isAr ? 'إجمالي الأصناف' : 'Total Items'}</p>
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-300 mt-1">{inventoryItems.length}</p>
                </div>
                <ShoppingCart className="w-10 h-10 text-purple-200 dark:text-purple-800" />
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm text-red-600 dark:text-red-400">{isAr ? 'نواقص في المخزون' : 'Low Stock Alerts'}</p>
                  <p className="text-3xl font-bold text-red-700 dark:text-red-300 mt-1">{lowStockItems.length}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-red-200 dark:text-red-800" />
              </div>
            </div>

            {/* Top Consumed Items */}
            <div className="md:col-span-2 flex flex-col h-full min-h-[250px]">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-4">
                {isAr ? 'الأصناف الأكثر استهلاكاً (منقولة)' : 'Top Consumed/Transferred Items'}
              </h4>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topConsumedItems} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1}/>
                    <XAxis type="number" axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 11}} width={100} />
                    <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px' }} />
                    <Bar dataKey="quantity" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} name={isAr ? 'الكمية' : 'Quantity'} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </WidgetCard>

      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <DashboardWrapper>
      <DashboardContent />
    </DashboardWrapper>
  );
}
