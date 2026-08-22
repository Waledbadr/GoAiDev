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
import { Building2, FileText, Home, PieChart as PieChartIcon, Truck, Users, Wallet, Clock, ArrowRight, Activity, Bell, AlertTriangle, TrendingUp, ShoppingCart, Wrench, ClipboardList, UserCog, GitBranch, ListOrdered, LifeBuoy, Settings, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { collection, query, where, getDocs, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { getEffectiveContractStatus } from '@/types/contracts';
import { getTransactionTypeDef } from '@/types/income-expense-transactions';

// --- Lightweight module stats (counts only, cached) ---
// Mirrors the pattern already used in accommodation-context.tsx's
// refreshDashboardStats: aggregate getCountFromServer queries (billed as a
// handful of reads regardless of collection size) instead of subscribing to
// full collections, cached in localStorage so repeat visits don't re-query.
interface ModuleStats {
  maintenanceByStatus: { name: string; value: number }[];
  maintenanceOpen: number;
  maintenanceHighPriority: number;
  ordersPending: number;
  ordersInDelivery: number;
  ordersDelivered: number;
  serviceOrdersDispatched: number;
  serviceOrdersCompleted: number;
  usersByRole: { name: string; value: number }[];
  usersTotal: number;
  usersAdmins: number;
  residenceOccupancy: Record<string, number>; // residenceId -> active occupant count
  totalActiveOccupants: number;
}

const MODULE_STATS_CACHE_KEY = 'dash_module_stats_v2';
const MODULE_STATS_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function fetchModuleStats(): Promise<ModuleStats | null> {
  if (!db) return null;

  // Serve from cache if fresh — avoids re-querying on every navigation back to "/"
  if (typeof window !== 'undefined') {
    try {
      const cached = window.localStorage.getItem(MODULE_STATS_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < MODULE_STATS_TTL_MS) return data as ModuleStats;
      }
    } catch {}
  }

  try {
    const count = async (col: string, field?: string, op?: any, value?: any) => {
      const ref = collection(db!, col);
      const q = field ? query(ref, where(field, op, value)) : ref;
      return (await getCountFromServer(q as any)).data().count;
    };

    // Active occupants (until == null): one bounded fetch, tallied by residenceId in
    // memory — same technique already used by accommodation-context.tsx's
    // refreshDashboardStats, chosen there over N per-residence count queries.
    const occupantsPromise = getDocs(query(collection(db!, 'occupants'), where('until', '==', null)));

    const [
      mntPending, mntInProgress, mntCompleted, mntCancelled, mntHighPriority,
      ordPending, ordApproved, ordPartial, ordDelivered,
      svcDispatched, svcCompleted,
      usrAdmin, usrSupervisor, usrTechnician, usrWorker,
      occupantsSnap,
    ] = await Promise.all([
      count('maintenanceRequests', 'status', '==', 'Pending'),
      count('maintenanceRequests', 'status', '==', 'In Progress'),
      count('maintenanceRequests', 'status', '==', 'Completed'),
      count('maintenanceRequests', 'status', '==', 'Cancelled'),
      count('maintenanceRequests', 'priority', '==', 'High'),
      count('orders', 'status', '==', 'Pending'),
      count('orders', 'status', '==', 'Approved'),
      count('orders', 'status', '==', 'Partially Delivered'),
      count('orders', 'status', '==', 'Delivered'),
      count('serviceOrders', 'status', 'in', ['DISPATCHED', 'PARTIAL_RETURN']),
      count('serviceOrders', 'status', '==', 'COMPLETED'),
      count('users', 'role', '==', 'Admin'),
      count('users', 'role', '==', 'Supervisor'),
      count('users', 'role', '==', 'Technician'),
      count('users', 'role', '==', 'Worker'),
      occupantsPromise,
    ]);

    const residenceOccupancy: Record<string, number> = {};
    occupantsSnap.forEach(docSnap => {
      const resId = (docSnap.data() as { residenceId?: string }).residenceId;
      if (resId) residenceOccupancy[resId] = (residenceOccupancy[resId] || 0) + 1;
    });

    const stats: ModuleStats = {
      maintenanceByStatus: [
        { name: 'Pending', value: mntPending },
        { name: 'In Progress', value: mntInProgress },
        { name: 'Completed', value: mntCompleted },
        { name: 'Cancelled', value: mntCancelled },
      ],
      maintenanceOpen: mntPending + mntInProgress,
      maintenanceHighPriority: mntHighPriority,
      ordersPending: ordPending,
      ordersInDelivery: ordApproved + ordPartial,
      ordersDelivered: ordDelivered,
      serviceOrdersDispatched: svcDispatched,
      serviceOrdersCompleted: svcCompleted,
      usersByRole: [
        { name: 'Admin', value: usrAdmin },
        { name: 'Supervisor', value: usrSupervisor },
        { name: 'Technician', value: usrTechnician },
        { name: 'Worker', value: usrWorker },
      ],
      usersTotal: usrAdmin + usrSupervisor + usrTechnician + usrWorker,
      usersAdmins: usrAdmin,
      residenceOccupancy,
      totalActiveOccupants: occupantsSnap.size,
    };

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(MODULE_STATS_CACHE_KEY, JSON.stringify({ data: stats, timestamp: Date.now() }));
      } catch {}
    }
    return stats;
  } catch (err) {
    console.error('Failed to fetch module stats:', err);
    return null;
  }
}

// --- App Overview Card (top-level grid linking to every module) ---
const AppCard = ({ title, icon: Icon, href, color, stat, statLabel, badge, badgeTone }: {
  title: string; icon: any; href: string; color: string;
  stat: string | number; statLabel: string;
  badge?: string; badgeTone?: 'green' | 'red' | 'yellow' | 'gray';
}) => {
  const toneClasses: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    yellow: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  };
  return (
    <Link
      href={href}
      className="group relative bg-white dark:bg-gray-800/80 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col gap-3"
    >
      <div className="flex items-start justify-between">
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-rtl:rotate-180 transition-colors" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{stat}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{statLabel}</p>
      </div>
      {badge && (
        <span className={cn("absolute top-3 rtl:left-3 ltr:right-9 text-[10px] font-semibold px-2 py-0.5 rounded-full", toneClasses[badgeTone || 'gray'])}>
          {badge}
        </span>
      )}
    </Link>
  );
};

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
  const { residences = [] } = useResidences();
  const { contracts = [] } = useContracts();
  const { transactions = [] } = useIncomeExpenseTransactions();
  const { items: inventoryItems = [], transfers = [] } = useInventory();

  // Local states for custom queries
  const [timesheet7Days, setTimesheet7Days] = useState<any[]>([]);
  const [todayRecords, setTodayRecords] = useState<any[]>([]);
  const [moduleStats, setModuleStats] = useState<ModuleStats | null>(null);

  // Maintenance / Material Requests / Service Orders / Users — one lightweight
  // aggregate-count fetch on mount (cached 30 min), not a live listener.
  useEffect(() => {
    let cancelled = false;
    fetchModuleStats().then(stats => { if (!cancelled) setModuleStats(stats); });
    return () => { cancelled = true; };
  }, []);

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
  // Complex (residence) has no top-level capacity/occupancy fields — capacity lives on
  // each room, nested under buildings[].floors[].rooms[] (already loaded in memory, so
  // summing it costs nothing extra). Occupant headcount comes from moduleStats'
  // residenceOccupancy map (see fetchModuleStats).
  const residenceCapacity = useMemo(() => {
    const map: Record<string, number> = {};
    residences.forEach(r => {
      let cap = 0;
      (r.buildings || []).forEach(b => (b.floors || []).forEach(f => (f.rooms || []).forEach(room => {
        cap += room.capacity || 0;
      })));
      map[r.id] = cap;
    });
    return map;
  }, [residences]);

  const totalCapacity = useMemo(() => Object.values(residenceCapacity).reduce((a, b) => a + b, 0), [residenceCapacity]);
  const totalOccupied = moduleStats?.totalActiveOccupants ?? 0;
  const occupancyRate = totalCapacity > 0 ? ((totalOccupied / totalCapacity) * 100).toFixed(1) : 0;

  const residenceChartData = useMemo(() => {
    return residences.map(r => {
      const capacity = residenceCapacity[r.id] || 0;
      const occupied = moduleStats?.residenceOccupancy?.[r.id] || 0;
      return {
        name: isAr ? r.nameAr || r.nameEn : r.nameEn || r.nameAr,
        Occupied: occupied,
        Vacant: Math.max(capacity - occupied, 0),
        capacity,
        occupancyRatio: capacity ? (occupied / capacity) * 100 : 0
      };
    }).sort((a, b) => b.occupancyRatio - a.occupancyRatio).slice(0, 10); // Top 10 most occupied
  }, [residences, residenceCapacity, moduleStats, isAr]);

  const bottleneckResidences = residenceChartData.filter(r => r.occupancyRatio >= 95);

  // --- 2. Timesheet Computations ---
  // Real status values (src/types/timesheet.ts): 'Present' | 'Absent' | 'Incomplete' |
  // 'On Leave' | 'Permission' | 'Sick Leave' | 'Holiday' | 'Reduced Hours' | 'Weekend' |
  // 'Transferred' | 'Future'. Note: 'On Leave', not 'Leave'.
  const presentCount = todayRecords.filter(r => r.status === 'Present').length;
  const leaveCount = todayRecords.filter(r => r.status === 'On Leave').length;
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
        if (r.status === 'On Leave') days[r.date].Leave++;
      }
    });

    return Object.entries(days).map(([date, counts]) => ({
      date: date.slice(5), // Show MM-DD
      ...counts
    }));
  }, [timesheet7Days]);

  // --- 3. Contracts Computations ---
  // Contract.status uses 'Active' (capitalized); getEffectiveContractStatus also
  // downgrades to 'Expired' when past endDate, matching what the Contracts module shows.
  const activeContracts = contracts.filter(c => getEffectiveContractStatus(c) === 'Active');
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
  // FinanceTransaction (src/types/income-expense-transactions.ts) uses `kind` (not `type`),
  // `transactionDate` (not `date`), and `typeKey` (not `category`) — resolve the label via
  // getTransactionTypeDef.
  const currentMonth = format(new Date(), 'yyyy-MM');
  const financialSummary = useMemo(() => {
    let income = 0; let expense = 0;
    transactions.forEach(t => {
      if (t.kind === 'income') income += (t.amount || 0);
      else if (t.kind === 'expense') expense += (t.amount || 0);
    });
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const expenseCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.kind === 'expense' && t.transactionDate?.startsWith(currentMonth)).forEach(t => {
      const typeDef = getTransactionTypeDef(t.typeKey);
      const cat = (isAr ? typeDef?.labelAr : typeDef?.labelEn) || t.typeKey || 'Uncategorized';
      map[cat] = (map[cat] || 0) + (t.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [transactions, currentMonth, isAr]);

  const topExpenses = useMemo(() => {
    return transactions.filter(t => t.kind === 'expense' && t.transactionDate?.startsWith(currentMonth))
      .map(t => {
        const typeDef = getTransactionTypeDef(t.typeKey);
        const label = (isAr ? typeDef?.labelAr : typeDef?.labelEn) || t.typeKey;
        const subtitle = typeDef?.buildSubtitle?.(t.details || {});
        return { ...t, description: subtitle || label, category: label, date: t.transactionDate };
      })
      .sort((a,b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 5);
  }, [transactions, currentMonth, isAr]);

  // --- 5. Materials Computations ---
  // InventoryItem uses `stock` (total across residences), not `quantity`/`minQuantity`.
  const lowStockItems = inventoryItems.filter(i => (i.stock ?? 0) <= 5);
  
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

  // --- 6-9. Maintenance / Material Requests / Service Orders / Users ---
  // Sourced from the cached aggregate-count fetch (moduleStats), not live listeners.
  const maintenanceStatusData = moduleStats?.maintenanceByStatus ?? [];
  const openMaintenanceCount = moduleStats?.maintenanceOpen ?? 0;
  const highPriorityMaintenanceCount = moduleStats?.maintenanceHighPriority ?? 0;
  const ordersPendingCount = moduleStats?.ordersPending ?? 0;
  const ordersInDeliveryCount = moduleStats?.ordersInDelivery ?? 0;
  const ordersDeliveredCount = moduleStats?.ordersDelivered ?? 0;
  const serviceOrdersDispatchedCount = moduleStats?.serviceOrdersDispatched ?? 0;
  const serviceOrdersCompletedCount = moduleStats?.serviceOrdersCompleted ?? 0;
  const usersByRole = moduleStats?.usersByRole ?? [];
  const usersTotalCount = moduleStats?.usersTotal ?? 0;
  const usersAdminCount = moduleStats?.usersAdmins ?? 0;
  const statsLoading = moduleStats === null;

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

      {/* All Applications Overview */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {isAr ? 'جميع التطبيقات' : 'All Applications'}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <AppCard
            title={isAr ? 'الإسكان' : 'Accommodation'} icon={Home} href="/accommodation"
            color="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
            stat={`${occupancyRate}%`} statLabel={isAr ? 'نسبة الإشغال' : 'Occupancy'}
            badge={bottleneckResidences.length > 0 ? (isAr ? 'اختناق' : 'Bottleneck') : undefined} badgeTone="red"
          />
          <AppCard
            title={isAr ? 'العقود' : 'Contracts'} icon={FileText} href="/contracts"
            color="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
            stat={activeContracts.length} statLabel={isAr ? 'عقود فعالة' : 'Active Contracts'}
            badge={expiringContracts.length > 0 ? `${expiringContracts.length} ${isAr ? 'تنتهي قريباً' : 'expiring'}` : undefined} badgeTone="yellow"
          />
          <AppCard
            title={isAr ? 'سجل الدوام' : 'Timesheet'} icon={Users} href="/timesheet"
            color="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            stat={presentCount} statLabel={isAr ? 'حاضر اليوم' : 'Present Today'}
            badge={absentCount > 0 ? `${absentCount} ${isAr ? 'غائب' : 'absent'}` : undefined} badgeTone="red"
          />
          <AppCard
            title={isAr ? 'الدخل والمصروفات' : 'Income & Expenses'} icon={Wallet} href="/income-expenses"
            color="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            stat={`${financialSummary.balance.toLocaleString()}`} statLabel={isAr ? 'صافي الرصيد (SAR)' : 'Net Balance (SAR)'}
          />
          <AppCard
            title={isAr ? 'المخزون والمواد' : 'Inventory & Materials'} icon={Truck} href="/Materials"
            color="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
            stat={inventoryItems.length} statLabel={isAr ? 'إجمالي الأصناف' : 'Total Items'}
            badge={lowStockItems.length > 0 ? `${lowStockItems.length} ${isAr ? 'نواقص' : 'low stock'}` : undefined} badgeTone="red"
          />
          <AppCard
            title={isAr ? 'الصيانة' : 'Maintenance'} icon={Wrench} href="/maintenance"
            color="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
            stat={statsLoading ? '…' : openMaintenanceCount} statLabel={isAr ? 'طلبات مفتوحة' : 'Open Requests'}
            badge={highPriorityMaintenanceCount > 0 ? `${highPriorityMaintenanceCount} ${isAr ? 'عالية الأولوية' : 'high priority'}` : undefined} badgeTone="red"
          />
          <AppCard
            title={isAr ? 'طلبات المواد' : 'Material Requests'} icon={ListOrdered} href="/inventory/orders"
            color="bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400"
            stat={statsLoading ? '…' : ordersPendingCount} statLabel={isAr ? 'قيد الانتظار' : 'Pending Approval'}
            badge={ordersInDeliveryCount > 0 ? `${ordersInDeliveryCount} ${isAr ? 'قيد التسليم' : 'in delivery'}` : undefined} badgeTone="yellow"
          />
          <AppCard
            title={isAr ? 'أوامر الخدمة' : 'Service Orders'} icon={GitBranch} href="/inventory/service-orders"
            color="bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400"
            stat={statsLoading ? '…' : serviceOrdersDispatchedCount} statLabel={isAr ? 'قيد التنفيذ خارجياً' : 'Dispatched'}
            badge={serviceOrdersCompletedCount > 0 ? `${serviceOrdersCompletedCount} ${isAr ? 'مكتمل' : 'completed'}` : undefined} badgeTone="green"
          />
          <AppCard
            title={isAr ? 'المستخدمون' : 'Users'} icon={UserCog} href="/users"
            color="bg-slate-50 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400"
            stat={statsLoading ? '…' : usersTotalCount} statLabel={isAr ? 'إجمالي المستخدمين' : 'Total Users'}
            badge={statsLoading ? undefined : `${usersAdminCount} ${isAr ? 'مدير' : 'admins'}`} badgeTone="gray"
          />
          <AppCard
            title={isAr ? 'الملاحظات' : 'Feedback'} icon={LifeBuoy} href="/feedback"
            color="bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
            stat={isAr ? 'عرض' : 'View'} statLabel={isAr ? 'الآراء والاقتراحات' : 'Feedback Board'}
          />
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

        {/* === Maintenance Widget === */}
        <WidgetCard title={isAr ? 'طلبات الصيانة' : 'Maintenance Requests'} icon={Wrench} href="/maintenance">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 rounded-xl p-4">
              <p className="text-sm text-orange-600 dark:text-orange-400">{isAr ? 'طلبات مفتوحة' : 'Open Requests'}</p>
              <p className="text-3xl font-bold text-orange-700 dark:text-orange-300 mt-1">{statsLoading ? '…' : openMaintenanceCount}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-xl p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{isAr ? 'عالية الأولوية' : 'High Priority'}</p>
              <p className="text-3xl font-bold text-red-700 dark:text-red-300 mt-1">{statsLoading ? '…' : highPriorityMaintenanceCount}</p>
            </div>
          </div>
          <div className="h-[200px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maintenanceStatusData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} name={isAr ? 'العدد' : 'Count'}>
                  {maintenanceStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </WidgetCard>

        {/* === Material Requests & Service Orders Widget === */}
        <WidgetCard title={isAr ? 'طلبات المواد وأوامر الخدمة' : 'Material Requests & Service Orders'} icon={ListOrdered} href="/inventory/orders">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800/30 rounded-xl p-4">
              <p className="text-sm text-cyan-600 dark:text-cyan-400">{isAr ? 'طلبات مواد (MR) قيد الانتظار' : 'Material Requests Pending'}</p>
              <p className="text-3xl font-bold text-cyan-700 dark:text-cyan-300 mt-1">{statsLoading ? '…' : ordersPendingCount}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl p-4">
              <p className="text-sm text-blue-600 dark:text-blue-400">{isAr ? 'قيد التسليم' : 'In Delivery'}</p>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-1">{statsLoading ? '…' : ordersInDeliveryCount}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/30 rounded-xl p-4">
              <p className="text-sm text-teal-600 dark:text-teal-400">{isAr ? 'أوامر خدمة قيد التنفيذ' : 'Service Orders Dispatched'}</p>
              <p className="text-3xl font-bold text-teal-700 dark:text-teal-300 mt-1">{statsLoading ? '…' : serviceOrdersDispatchedCount}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-4">
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{isAr ? 'إجمالي الطلبات المُسلَّمة' : 'Total Delivered Orders'}</p>
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{statsLoading ? '…' : ordersDeliveredCount}</p>
            </div>
          </div>
        </WidgetCard>

        {/* === Users Widget === */}
        <WidgetCard title={isAr ? 'المستخدمون والفريق' : 'Users & Team'} icon={UserCog} href="/users">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{isAr ? 'إجمالي المستخدمين' : 'Total Users'}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{statsLoading ? '…' : usersTotalCount}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{isAr ? 'المديرون' : 'Admins'}</p>
              <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mt-1">{statsLoading ? '…' : usersAdminCount}</p>
            </div>
          </div>
          <div className="h-[200px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={usersByRole}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={5}
                  dataKey="value"
                >
                  {usersByRole.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ borderRadius: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
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
