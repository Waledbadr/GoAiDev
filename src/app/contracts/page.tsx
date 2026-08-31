'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useContracts } from '@/context/contracts-context';
import { useAccommodation } from '@/context/accommodation-context';
import { useLanguage } from '@/context/language-context';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Edit, Trash2, FileText, TrendingUp, TrendingDown, Calendar, Moon,
  Building2, Check, X, AlertTriangle, RefreshCw, Search, Filter,
  DollarSign, Users, Home, Store, Wrench, Droplets, Flame, Wifi,
  Clock, MoreHorizontal, Printer, Download, Eye, Ban, Play, Paperclip,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FilePlus, Layers, Activity
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatHijriSubtext } from '@/lib/hijri-date-utils';
import { ContractWizardDialog } from '@/components/contracts/ContractWizardDialog';
import { MigrationPreviewDialog } from '@/components/contracts/MigrationPreviewDialog';
import { EditLinkedResidencesDialog } from '@/components/contracts/EditLinkedResidencesDialog';
import {
  type Contract, type ContractFormData, type ContractType, type ContractStatus,
  type BillingType, type ContractService, type PartyType, type RenewalType,
  CONTRACT_TYPES, getContractTypeInfo, getContractCategoryLabel,
  getContractStatusLabel, getBillingTypeLabel, getRenewalTypeLabel, formatSAR,
  getMonthlyValue
} from '@/types/contracts';

// ---- Icons Map ----
const typeIcons: Record<string, React.ReactNode> = {
  Users: <Users className="h-5 w-5" />,
  Store: <Store className="h-5 w-5" />,
  Building2: <Building2 className="h-5 w-5" />,
  Home: <Home className="h-5 w-5" />,
  Wrench: <Wrench className="h-5 w-5" />,
  Droplets: <Droplets className="h-5 w-5" />,
  Flame: <Flame className="h-5 w-5" />,
  Wifi: <Wifi className="h-5 w-5" />,
};

// --- Reusable Widget Card (matches Dashboard) ---
const WidgetCard = ({ title, icon: Icon, children, href, className, headerAction }: { 
  title: string; 
  icon: any; 
  children: React.ReactNode; 
  href?: string; 
  className?: string;
  headerAction?: React.ReactNode;
}) => (
  <div className={cn("bg-white dark:bg-gray-800/80 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm flex flex-col", className)}>
    <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
          <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      {headerAction ? headerAction : href ? (
        <Link href={href} className="text-gray-400 hover:text-indigo-500 transition-colors">
          <ChevronRight className="w-5 h-5 rtl:rotate-180" />
        </Link>
      ) : null}
    </div>
    <div className="flex-1 flex flex-col">
      {children}
    </div>
  </div>
);

export default function ContractsPage() {
  const {
    contracts, invoices, loading, stats,
    createContract, updateContract, deleteContract,
    renewContract, suspendContract, cancelContract, activateContract,
    generateMonthlyInvoices, getInvoicesByContract, updateInvoiceStatus,
    reconcileContractLifecycle,
  } = useContracts();
  const { companies, residences } = useAccommodation();
  const { locale, dict: t } = useLanguage();
  const isAr = locale === 'ar';
  const c = t.contracts || {} as any;

  // ---- State ----
  const searchParams = useSearchParams();
  const urlTab = searchParams?.get('tab');
  const urlCategory = searchParams?.get('category');
  const urlStatus = searchParams?.get('status');
  const urlAction = searchParams?.get('action');
  const [activeTab, setActiveTab] = useState(urlTab || 'overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterResidence, setFilterResidence] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grouped_by_owner'>('table');

  // Dialog states
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'renew' | 'delete' | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedContract, setExpandedContract] = useState<string | null>(null);
  const [showMigration, setShowMigration] = useState(false);
  const [isExpiredOpen, setIsExpiredOpen] = useState(false);
  const [residenceEditContract, setResidenceEditContract] = useState<Contract | null>(null);
  const [openOwners, setOpenOwners] = useState<Record<string, boolean>>({});

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'suspend' | 'cancel' | 'activate';
    contractId: string;
  }>({ open: false, action: 'suspend', contractId: '' });

  // Form state
  const [formData, setFormData] = useState<ContractFormData>({
    contractType: 'worker_housing_revenue',
    contractCategory: 'revenue',
    partyType: 'company',
    partyId: '',
    partyName: '',
    linkedResidences: [],
    startDate: '',
    endDate: '',
    isOpenEnded: false,
    billingType: 'per_person_per_day',
    billingRate: 0,
    billingUnit: isAr ? 'شخص/يوم' : 'person/day',
    notes: '',
    renewalType: 'manual',
    autoRenew: false,
    noticePeriodDays: 30,
  });

  const [newEndDate, setNewEndDate] = useState('');

  // ---- Apply URL params on mount ----
  useEffect(() => {
    if (urlCategory && urlCategory !== 'all') {
      setFilterCategory(urlCategory);
    }
    if (urlStatus && urlStatus !== 'all') {
      setFilterStatus(urlStatus);
    }
    if (urlAction === 'generate-invoices') {
      generateMonthlyInvoices();
    }
    if (urlAction === 'check-alerts') {
      reconcileContractLifecycle();
    }
  }, []);

  // ---- Filtered Contracts ----
  const filteredContracts = useMemo(() => {
    let result = [...contracts];

    // Search
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.partyName.toLowerCase().includes(lower) ||
        c.notes?.toLowerCase().includes(lower)
      );
    }

    // Type filter
    if (filterType !== 'all') {
      result = result.filter(c => c.contractType === filterType);
    }

    // Category filter
    if (filterCategory !== 'all') {
      result = result.filter(c => c.contractCategory === filterCategory);
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(c => c.status === filterStatus);
    }

    // Residence filter
    if (filterResidence !== 'all') {
      result = result.filter(c => c.linkedResidences.includes(filterResidence));
    }

    return result;
  }, [contracts, searchTerm, filterType, filterCategory, filterStatus, filterResidence]);

  // Grouped by owner calculation
  const contractsByOwner = useMemo(() => {
    const groups: Record<string, Contract[]> = {};
    filteredContracts.forEach(contract => {
      const party = contract.partyName?.trim() || (isAr ? 'طرف غير محدد' : 'Unspecified Party');
      if (!groups[party]) {
        groups[party] = [];
      }
      groups[party].push(contract);
    });
    return Object.entries(groups).map(([ownerName, ownerContracts]) => ({
      ownerName,
      contracts: ownerContracts,
      // `billingRate` وحده يخلط سعر الفرد بإيجار مبنى كامل، فتُطبَّع كل الأنواع
      // إلى مكافئ شهري كما في إحصائيات الصفحة.
      totalValue: ownerContracts.reduce((sum, item) => sum + getMonthlyValue(item).amount, 0),
      activeCount: ownerContracts.filter(item => item.status === 'Active').length,
      expiredCount: ownerContracts.filter(item => item.status === 'Expired').length,
      partyType: ownerContracts[0]?.partyType || 'company',
    }));
  }, [filteredContracts, isAr]);

  // ---- Form Handlers ----
  const handleTypeChange = (type: ContractType) => {
    const info = getContractTypeInfo(type);
    setFormData(prev => ({
      ...prev,
      contractType: type,
      contractCategory: info.category,
      billingType: info.defaultBillingType,
      billingUnit: info.defaultBillingUnit,
      services: info.hasServices ? [] : undefined,
    }));
  };

  const handlePartyChange = (partyId: string) => {
    const company = companies.find(c => c.id === partyId);
    setFormData(prev => ({
      ...prev,
      partyId,
      partyName: company?.name || '',
      partyContact: company?.contactEmail || '',
      partyPhone: company?.contactPhone || '',
    }));
  };

  const toggleResidence = (residenceId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedResidences: prev.linkedResidences.includes(residenceId)
        ? prev.linkedResidences.filter(id => id !== residenceId)
        : [...prev.linkedResidences, residenceId],
    }));
  };

  const handleSubmit = async () => {
    try {
      if (dialogMode === 'edit' && selectedContract) {
        await updateContract(selectedContract.id, formData as any);
      } else {
        await createContract(formData);
      }
      setDialogMode(null);
      setSelectedContract(null);
      setShowForm(false);
    } catch (error) {
      console.error('Error submitting contract:', error);
    }
  };

  const handleRenew = async () => {
    if (selectedContract && newEndDate) {
      await renewContract(selectedContract.id, newEndDate);
      setDialogMode(null);
      setSelectedContract(null);
      setNewEndDate('');
    }
  };

  const handleDelete = async () => {
    if (selectedContract) {
      await deleteContract(selectedContract.id);
      setDialogMode(null);
      setSelectedContract(null);
    }
  };

  const openEditDialog = (contract: Contract) => {
    setSelectedContract(contract);
    setFormData({
      contractType: contract.contractType,
      contractCategory: contract.contractCategory,
      partyType: contract.partyType,
      partyId: contract.partyId,
      partyName: contract.partyName,
      partyContact: contract.partyContact,
      partyPhone: contract.partyPhone,
      linkedResidences: contract.linkedResidences,
      startDate: contract.startDate,
      endDate: contract.endDate,
      isOpenEnded: contract.isOpenEnded,
      billingType: contract.billingType,
      billingRate: contract.billingRate,
      billingUnit: contract.billingUnit,
      paymentTerms: contract.paymentTerms,
      advancePayment: contract.advancePayment,
      services: contract.services,
      notes: contract.notes,
      renewalType: contract.renewalType,
      autoRenew: contract.autoRenew,
      noticePeriodDays: contract.noticePeriodDays,
    });
    setDialogMode('edit');
    setShowForm(true);
  };

  const openCreateDialog = () => {
    setSelectedContract(null);
    setFormData({
      contractType: 'worker_housing_revenue',
      contractCategory: 'revenue',
      partyType: 'company',
      partyId: '',
      partyName: '',
      linkedResidences: [],
      startDate: '',
      endDate: '',
      isOpenEnded: false,
      billingType: 'per_person_per_day',
      billingRate: 0,
      billingUnit: isAr ? 'شخص/يوم' : 'person/day',
      notes: '',
      renewalType: 'manual',
      autoRenew: false,
      noticePeriodDays: 30,
    });
    setDialogMode('create');
    setShowForm(true);
  };

  // ---- Get status badge color ----
  const getStatusBadge = (status: ContractStatus) => {
    const colors: Record<ContractStatus, string> = {
      Active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      Suspended: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      Expired: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      Cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      Draft: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    };
    return colors[status];
  };

  // ---- Check if contract is expiring soon ----
  const isExpiringSoon = (contract: Contract) => {
    if (contract.status !== 'Active') return false;
    const end = new Date(contract.endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 && diff <= 30;
  };

  // ---- Helper to get party type label ----
  const getPartyTypeLabel = (type: PartyType) => {
    const labels: Record<PartyType, string> = {
      company: isAr ? 'شركة' : 'Company',
      vendor: isAr ? 'مورد' : 'Vendor',
      individual: isAr ? 'فرد' : 'Individual',
    };
    return labels[type];
  };

  // ---- Overview Cards ----
  const renderOverviewCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Active Contracts */}
      <div className="bg-white dark:bg-gray-800/80 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-all flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {stats.activeContracts}/{stats.totalContracts}
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {c.totalActiveContracts || (isAr ? 'العقود الفعالة' : 'Total Active Contracts')}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{stats.activeContracts}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {c.outOf || (isAr ? 'من إجمالي' : 'out of')} {stats.totalContracts} {isAr ? 'عقد' : 'contracts'}
          </p>
        </div>
      </div>

      {/* Monthly Revenue */}
      <div className="bg-white dark:bg-gray-800/80 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-all flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {c.monthlyRevenue || (isAr ? 'الإيراد الشهري' : 'Monthly Revenue')}
          </p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatSAR(stats.totalMonthlyRevenue)} {isAr ? 'ر.س' : 'SAR'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {c.sarPerMonth || (isAr ? 'شهرياً' : 'SAR / month')}
            {stats.estimatedMonthlyRevenue > 0 && (
              <span className="block text-amber-600 dark:text-amber-400">
                {isAr
                  ? `منها ${formatSAR(stats.estimatedMonthlyRevenue)} تقديري`
                  : `incl. ${formatSAR(stats.estimatedMonthlyRevenue)} estimated`}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Monthly Expense */}
      <div className="bg-white dark:bg-gray-800/80 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-all flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {c.monthlyExpense || (isAr ? 'المصروف الشهري' : 'Monthly Expense')}
          </p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
            {formatSAR(stats.totalMonthlyExpense)} {isAr ? 'ر.س' : 'SAR'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {c.sarPerMonth || (isAr ? 'شهرياً' : 'SAR / month')}
            {stats.unvaluedContracts > 0 && (
              <span className="block text-amber-600 dark:text-amber-400">
                {isAr
                  ? `${stats.unvaluedContracts} عقد بلا قيمة شهرية ثابتة`
                  : `${stats.unvaluedContracts} variable active contract(s)`}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Net Monthly / Expiring */}
      <div className="bg-white dark:bg-gray-800/80 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-all flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg ${stats.expiringThisMonth > 0
            ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
            : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
          }`}>
            {stats.expiringThisMonth > 0
              ? <AlertTriangle className="w-5 h-5" />
              : <DollarSign className="w-5 h-5" />
            }
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {stats.expiringThisMonth > 0
              ? (c.expiringSoon || (isAr ? 'تنتهي هذا الشهر' : 'Expiring Soon'))
              : (c.netMonthly || (isAr ? 'صافي الإيراد الشهري' : 'Net Monthly'))}
          </p>
          {stats.expiringThisMonth > 0 ? (
            <>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{stats.expiringThisMonth}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{c.expiresThisMonth || (isAr ? 'عقود تنتهي خلال الشهر الحالي' : 'expires this month')}</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
                {formatSAR(stats.totalMonthlyRevenue - stats.totalMonthlyExpense)} {isAr ? 'ر.س' : 'SAR'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{isAr ? 'صافي شهري' : 'Net monthly'}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ---- Contract Type Distribution ----
  const renderTypeDistribution = () => (
    <WidgetCard
      title={c.contractTypeDistribution || (isAr ? 'توزيع أنواع العقود' : 'Contract Type Distribution')}
      icon={Layers}
      className="mb-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CONTRACT_TYPES.map(type => {
          const count = stats.contractsByType[type.type] || 0;
          if (count === 0) return null;
          const total = stats.totalContracts || 1;
          const percentage = Math.round((count / total) * 100);
          return (
            <div key={type.type} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700/40 flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-xs border border-gray-100 dark:border-gray-700/50 shrink-0">
                {typeIcons[type.icon] || <FileText className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center text-sm mb-1.5">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">{isAr ? type.labelAr : type.labelEn}</span>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0">{count} ({percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700/60 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${type.category === 'revenue' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );

  // ---- Filters Bar ----
  const renderFiltersBar = () => (
    <WidgetCard
      title={c.filterAndSearch || (isAr ? 'البحث والتصفية' : 'Filter & Search')}
      icon={Filter}
      className="mb-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">{c.search || (isAr ? 'البحث' : 'Search')}</Label>
          <div className="relative mt-1.5">
            <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 h-4 w-4 text-gray-400`} />
            <Input
              placeholder={c.searchPartyPlaceholder || (isAr ? 'اسم الطرف / العقد...' : 'Party name...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${isAr ? 'pr-9' : 'pl-9'} rounded-xl bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700`}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">{c.category || (isAr ? 'التصنيف' : 'Category')}</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="mt-1.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
              <SelectValue placeholder={c.all || (isAr ? 'الكل' : 'All')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{c.all || (isAr ? 'الكل' : 'All')}</SelectItem>
              <SelectItem value="revenue">{c.revenue || (isAr ? 'إيرادات' : 'Revenue')}</SelectItem>
              <SelectItem value="expense">{c.expense || (isAr ? 'مصروفات' : 'Expense')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">{c.status || (isAr ? 'الحالة' : 'Status')}</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="mt-1.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
              <SelectValue placeholder={c.all || (isAr ? 'الكل' : 'All')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{c.all || (isAr ? 'الكل' : 'All')}</SelectItem>
              <SelectItem value="Active">{c.active || (isAr ? 'نشط' : 'Active')}</SelectItem>
              <SelectItem value="Suspended">{c.suspended || (isAr ? 'موقوف' : 'Suspended')}</SelectItem>
              <SelectItem value="Expired">{c.expired || (isAr ? 'منتهي' : 'Expired')}</SelectItem>
              <SelectItem value="Cancelled">{c.cancelled || (isAr ? 'ملغي' : 'Cancelled')}</SelectItem>
              <SelectItem value="Draft">{c.draft || (isAr ? 'مسودة' : 'Draft')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">{c.contractType || (isAr ? 'نوع العقد' : 'Contract Type')}</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="mt-1.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
              <SelectValue placeholder={c.all || (isAr ? 'الكل' : 'All')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{c.all || (isAr ? 'الكل' : 'All')}</SelectItem>
              {CONTRACT_TYPES.map(t => (
                <SelectItem key={t.type} value={t.type}>{isAr ? t.labelAr : t.labelEn}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">{c.residence || (isAr ? 'المجمع السكني' : 'Residence')}</Label>
          <Select value={filterResidence} onValueChange={setFilterResidence}>
            <SelectTrigger className="mt-1.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
              <SelectValue placeholder={c.all || (isAr ? 'الكل' : 'All')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{c.all || (isAr ? 'الكل' : 'All')}</SelectItem>
              {residences.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {(searchTerm || filterType !== 'all' || filterCategory !== 'all' || filterStatus !== 'all' || filterResidence !== 'all') && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {c.results || (isAr ? 'النتائج' : 'Results')}: <span className="font-bold text-gray-900 dark:text-white">{filteredContracts.length}</span> {isAr ? 'عقد' : 'contract(s)'}
          </span>
          <Button variant="ghost" size="sm" onClick={() => {
            setSearchTerm('');
            setFilterType('all');
            setFilterCategory('all');
            setFilterStatus('all');
            setFilterResidence('all');
          }} className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30">
            <X className="h-3.5 w-3.5 mr-1 ml-1" />
            {c.reset || (isAr ? 'إعادة ضبط' : 'Reset')}
          </Button>
        </div>
      )}
    </WidgetCard>
  );

  // ---- Grouped by Owner View (Collapsible Accordion Cards) ----
  const renderGroupedByOwnerView = () => {
    const toggleOwner = (ownerName: string) => {
      setOpenOwners(prev => ({ ...prev, [ownerName]: !prev[ownerName] }));
    };

    if (contractsByOwner.length === 0) {
      return (
        <Card className="p-8 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>{c.noContractsFound || 'No contracts match the filters'}</p>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {contractsByOwner.map(({ ownerName, contracts: ownerContracts, totalValue, activeCount, expiredCount }) => {
          const isOpen = openOwners[ownerName] !== false; // Default expanded
          const firstContract = ownerContracts[0];

          return (
            <Card key={ownerName} className="overflow-hidden border-2 shadow-xs">
              <CardHeader
                className="bg-slate-50/80 dark:bg-slate-900/60 p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors select-none"
                onClick={() => toggleOwner(ownerName)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{ownerName}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {getPartyTypeLabel(firstContract?.partyType || 'company')}
                        </Badge>
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold text-xs">
                          {ownerContracts.length} {isAr ? 'عقود مسجلة' : 'contracts'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isAr ? 'إجمالي قيمة العقود الشهري:' : 'Total Monthly Value:'}{' '}
                        <span className="font-bold text-emerald-600">{formatSAR(totalValue)} ر.س</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-xs">
                      {activeCount} {isAr ? 'ساري' : 'Active'}
                    </Badge>
                    {expiredCount > 0 && (
                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 text-xs">
                        {expiredCount} {isAr ? 'منتهي' : 'Expired'}
                      </Badge>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 font-semibold"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (firstContract) {
                          setSelectedContract(firstContract);
                          setDialogMode('create');
                          setShowForm(true);
                        }
                      }}
                    >
                      <FilePlus className="w-3.5 h-3.5 text-purple-600" />
                      <span>{isAr ? '+ ملحق / عقد جديد' : '+ Addendum / New Contract'}</span>
                    </Button>

                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                      {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isOpen && (
                <CardContent className="p-0 border-t">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/10 text-xs">
                          <TableHead>{c.contractAndType || 'Contract / Type'}</TableHead>
                          <TableHead>{isAr ? 'العلاقة' : 'Relation'}</TableHead>
                          <TableHead>{c.residences || 'Residences'}</TableHead>
                          <TableHead>{c.duration || 'Duration'}</TableHead>
                          <TableHead>{c.value || 'Value'}</TableHead>
                          <TableHead>{c.status || 'Status'}</TableHead>
                          <TableHead className={`${isAr ? 'text-right' : 'text-left'}`}>{c.actions || 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ownerContracts.map(contract => {
                          const info = getContractTypeInfo(contract.contractType);
                          const isActive = contract.status === 'Active';
                          const isExpired = contract.status === 'Expired';

                          return (
                            <TableRow key={contract.id} className="hover:bg-muted/30 text-xs">
                              <TableCell>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-mono font-bold text-slate-900 dark:text-slate-100">{contract.contractNumber}</p>
                                    {((contract.attachments && contract.attachments.length > 0) || (contract as any).attachmentUrl) && (
                                      <a
                                        href={contract.attachments?.[0] || (contract as any).attachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={isAr ? 'عقد PDF مرفق (اضغط للفتح)' : 'PDF Attachment (Click to open)'}
                                        className="text-blue-500 hover:text-blue-600 transition-colors p-0.5 rounded"
                                      >
                                        <Paperclip className="h-3.5 w-3.5" />
                                      </a>
                                    )}
                                  </div>
                                  <p className="text-muted-foreground text-[11px]">{contract.title || (isAr ? info.labelAr : info.labelEn)}</p>
                                </div>
                              </TableCell>

                              <TableCell>
                                {contract.contractRelationType === 'addendum' ? (
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800 text-[10px]">
                                    📑 {isAr ? 'ملحق عقد' : 'Addendum'}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-[10px]">
                                    📄 {isAr ? 'عقد أساسي' : 'Primary'}
                                  </Badge>
                                )}
                              </TableCell>

                              <TableCell>
                                <div
                                  onClick={() => setResidenceEditContract(contract)}
                                  className="cursor-pointer group flex flex-wrap items-center gap-1 max-w-[180px] hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 p-1 rounded-lg transition-colors"
                                  title={isAr ? 'اضغط لتعديل وتعيين السكنات' : 'Click to edit linked residences'}
                                >
                                  {(!contract.linkedResidences || contract.linkedResidences.length === 0) ? (
                                    <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 border-dashed hover:bg-amber-100 flex items-center gap-0.5">
                                      <Plus className="w-2.5 h-2.5" />
                                      {isAr ? 'تعيين سكن' : 'Assign'}
                                    </Badge>
                                  ) : (
                                    <>
                                      {contract.linkedResidences.slice(0, 2).map(resId => {
                                        const res = residences.find(r => r.id === resId);
                                        const isRegistered = !!res;
                                        return (
                                          <Badge
                                            key={resId}
                                            variant="outline"
                                            className={`text-[10px] py-0 px-1.5 ${
                                              isRegistered
                                                ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-800 dark:text-slate-200'
                                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 border-rose-300'
                                            }`}
                                          >
                                            {!isRegistered && <AlertTriangle className="w-2.5 h-2.5 mr-0.5 ml-0.5 inline text-rose-600" />}
                                            {res?.name || resId}
                                          </Badge>
                                        );
                                      })}
                                      {contract.linkedResidences.length > 2 && (
                                        <Badge variant="outline" className="text-[10px] py-0 px-1 bg-slate-50 border-slate-200">
                                          +{contract.linkedResidences.length - 2}
                                        </Badge>
                                      )}
                                      <Edit className="w-2.5 h-2.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                <div className="space-y-0.5">
                                  <div>📅 {contract.startDate} ⬅️ {contract.endDate}</div>
                                  {contract.dateSystem === 'hijri' && (
                                    <div className="text-[10px] text-emerald-700 font-medium">
                                      🌙 {formatHijriSubtext(contract.startDate, isAr)} - {formatHijriSubtext(contract.endDate, isAr)}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                <p className="font-bold text-emerald-600">{formatSAR(contract.billingRate)} {isAr ? 'ر.س' : 'SAR'}</p>
                                <p className="text-[10px] text-muted-foreground">{getBillingTypeLabel(contract.billingType, isAr)}</p>
                              </TableCell>

                              <TableCell>
                                <div className="space-y-1">
                                  <Badge className={getStatusBadge(contract.status)}>
                                    {getContractStatusLabel(contract.status, isAr)}
                                  </Badge>
                                  {contract.autoRenew && (
                                    <div className="text-[10px] text-emerald-700 font-medium">
                                      🔄 {getRenewalTypeLabel(contract.renewalType, isAr)}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className={`${isAr ? 'text-right' : 'text-left'}`}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 rounded-lg hover:bg-muted focus:ring-1 focus:ring-primary"
                                      title={isAr ? 'خيارات العقد' : 'Contract Actions'}
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                      <span className="sr-only">{c.actions || 'Actions'}</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align={isAr ? 'start' : 'end'} className="w-52">
                                    {((contract.attachments && contract.attachments.length > 0) || (contract as any).attachmentUrl) && (
                                      <DropdownMenuItem asChild>
                                        <a
                                          href={contract.attachments?.[0] || (contract as any).attachmentUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                        >
                                          <FileText className="h-4 w-4" />
                                          <span>{isAr ? 'عرض العقد المرفق (PDF)' : 'View Attached PDF'}</span>
                                        </a>
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      onClick={() => openEditDialog(contract)}
                                      className="flex items-center gap-2 cursor-pointer"
                                    >
                                      <Edit className="h-4 w-4 text-slate-500" />
                                      <span>{isAr ? 'تعديل بيانات العقد' : 'Edit Contract'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setResidenceEditContract(contract)}
                                      className="flex items-center gap-2 cursor-pointer text-indigo-600 dark:text-indigo-400 font-medium"
                                    >
                                      <Building2 className="h-4 w-4" />
                                      <span>{isAr ? 'تعديل السكنات المرتبطة' : 'Edit Linked Residences'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedContract(contract);
                                        setDialogMode('create');
                                        setShowForm(true);
                                      }}
                                      className="flex items-center gap-2 cursor-pointer"
                                    >
                                      <FilePlus className="h-4 w-4 text-purple-600" />
                                      <span>{isAr ? 'إنشاء ملحق / عقد جديد' : 'New Addendum / Contract'}</span>
                                    </DropdownMenuItem>
                                    {(isActive || isExpired) && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedContract(contract);
                                          setNewEndDate(contract.endDate || '');
                                          setDialogMode('renew');
                                        }}
                                        className="flex items-center gap-2 cursor-pointer text-emerald-600"
                                      >
                                        <Clock className="h-4 w-4" />
                                        <span>{isAr ? 'تجديد العقد' : 'Renew Contract'}</span>
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedContract(contract);
                                        setDialogMode('delete');
                                      }}
                                      className="flex items-center gap-2 cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span>{isAr ? 'حذف العقد' : 'Delete Contract'}</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    );
  };

  // شريط التبديل والإجراءات.
  const renderListToolbar = () => (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl text-xs">
        <button
          type="button"
          onClick={() => setViewMode('table')}
          aria-pressed={viewMode === 'table'}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            viewMode === 'table' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs font-bold' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          📋 {isAr ? 'جدول العقود' : 'Table'}
        </button>
        <button
          type="button"
          onClick={() => setViewMode('grouped_by_owner')}
          aria-pressed={viewMode === 'grouped_by_owner'}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            viewMode === 'grouped_by_owner' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs font-bold' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          🏢 {isAr ? 'تجميع حسب المالك' : 'By Owner'}
        </button>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => generateMonthlyInvoices()}
        className="rounded-xl border-gray-200 dark:border-gray-700 text-xs"
      >
        <RefreshCw className="h-3.5 w-3.5 ml-1 mr-1" />
        {c.generateMonthlyInvoices || (isAr ? 'توليد الفواتير' : 'Invoices')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => reconcileContractLifecycle()}
        className="rounded-xl border-gray-200 dark:border-gray-700 text-xs"
        title={isAr
          ? 'يجدّد العقود المضبوطة على التجديد التلقائي، ويثبّت حالة «منتهٍ» لما تجاوز مدته.'
          : 'Renews auto-renew contracts and persists Expired status for the rest.'}
      >
        <Clock className="h-3.5 w-3.5 ml-1 mr-1" />
        {isAr ? 'تحديث دورة الحياة' : 'Lifecycle'}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowMigration(true)}
        className="rounded-xl border-gray-200 dark:border-gray-700 text-xs"
      >
        <Layers className="h-3.5 w-3.5 ml-1 mr-1" />
        {isAr ? 'ترحيل العقود' : 'Migrate'}
      </Button>
    </div>
  );


  // ---- Render Single Contract Row ----
  const renderContractRow = (contract: Contract) => {

    const info = getContractTypeInfo(contract.contractType);
    const isActive = contract.status === 'Active';
    const expiringSoon = isExpiringSoon(contract);

    return (
      <TableRow key={contract.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700/40 transition-colors">
        <TableCell>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              contract.contractCategory === 'revenue'
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
            }`}>
              {typeIcons[info.icon] || <FileText className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{isAr ? info.labelAr : info.labelEn}</p>
                {((contract.attachments && contract.attachments.length > 0) || (contract as any).attachmentUrl) && (
                  <a
                    href={contract.attachments?.[0] || (contract as any).attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={isAr ? 'عقد PDF مرفق (اضغط للفتح)' : 'PDF Attachment (Click to open)'}
                    className="text-blue-500 hover:text-blue-600 transition-colors p-0.5 rounded"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {contract.contractRelationType === 'addendum' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    {isAr ? 'ملحق عقد' : 'Addendum'}
                  </span>
                )}
                {expiringSoon && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 flex items-center gap-0.5">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {isAr ? 'ينتهي قريباً' : 'Expiring'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="space-y-1">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{contract.partyName}</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 inline-block">
              {getPartyTypeLabel(contract.partyType)}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <div
            onClick={() => setResidenceEditContract(contract)}
            className="cursor-pointer group flex flex-wrap items-center gap-1 max-w-[220px] hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 p-1.5 rounded-xl transition-colors"
            title={isAr ? 'اضغط لتعديل وتعيين السكنات المرتبطة بهذا العقد' : 'Click to edit linked residences'}
          >
            {(!contract.linkedResidences || contract.linkedResidences.length === 0) ? (
              <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 border-dashed hover:bg-amber-100 flex items-center gap-1">
                <Plus className="w-3 h-3" />
                {isAr ? 'تعيين سكن' : 'Assign Residence'}
              </Badge>
            ) : (
              <>
                {contract.linkedResidences.slice(0, 3).map(resId => {
                  const res = residences.find(r => r.id === resId);
                  const isRegistered = !!res;
                  return (
                    <Badge
                      key={resId}
                      variant="outline"
                      className={`text-xs ${
                        isRegistered
                          ? 'bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300'
                      }`}
                    >
                      {!isRegistered && <AlertTriangle className="w-2.5 h-2.5 mr-0.5 ml-0.5 inline text-rose-600" />}
                      {res?.name || resId}
                    </Badge>
                  );
                })}
                {contract.linkedResidences.length > 3 && (
                  <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700">
                    +{contract.linkedResidences.length - 3}
                  </Badge>
                )}
                <Edit className="w-3 h-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
              </>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
              <Calendar className="h-3 w-3 text-gray-400" />
              <span>{isAr ? 'من' : (c.from || 'from')} {contract.startDate}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
              <Calendar className="h-3 w-3 text-gray-400" />
              <span>{isAr ? 'إلى' : (c.to || 'to')} {contract.endDate}</span>
            </div>
            {contract.isOpenEnded && (
              <Badge variant="secondary" className="text-[10px]">{c.openEnded || 'Open-ended'}</Badge>
            )}
            {/* Subtext note for Hijri contracts ONLY */}
            {contract.dateSystem === 'hijri' && (
              <div className="text-[10px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1 mt-1 font-medium">
                <Moon className="h-3 w-3 text-emerald-600 shrink-0" />
                <span>{isAr ? 'ملاحظة (هجري):' : 'Hijri note:'} {formatHijriSubtext(contract.startDate, isAr)} - {formatHijriSubtext(contract.endDate, isAr)}</span>
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="text-sm">
            <p className={`font-bold ${
              contract.contractCategory === 'revenue' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {contract.contractCategory === 'revenue' ? '' : '-'}
              {formatSAR(contract.billingRate)} {isAr ? 'ر.س' : 'SAR'}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {getBillingTypeLabel(contract.billingType, isAr)}
            </p>
          </div>
        </TableCell>
        <TableCell>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full inline-block ${
            isActive
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : contract.status === 'Suspended'
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : contract.status === 'Expired'
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {getContractStatusLabel(contract.status, isAr)}
          </span>
        </TableCell>
        <TableCell className={isAr ? 'text-right' : 'text-left'}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isAr ? 'start' : 'end'} className="w-52 rounded-xl">
              {((contract.attachments && contract.attachments.length > 0) || (contract as any).attachmentUrl) && (
                <DropdownMenuItem asChild>
                  <a
                    href={contract.attachments?.[0] || (contract as any).attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 cursor-pointer text-blue-600 font-medium"
                  >
                    <FileText className="h-4 w-4" />
                    <span>{isAr ? 'عرض العقد المرفق (PDF)' : 'View Attached PDF'}</span>
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => openEditDialog(contract)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Edit className="h-4 w-4 text-slate-500" />
                <span>{isAr ? 'تعديل بيانات العقد' : 'Edit Contract'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setResidenceEditContract(contract)}
                className="flex items-center gap-2 cursor-pointer text-indigo-600 dark:text-indigo-400 font-medium"
              >
                <Building2 className="h-4 w-4" />
                <span>{isAr ? 'تعديل السكنات المرتبطة' : 'Edit Linked Residences'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedContract(contract);
                  setDialogMode('create');
                  setShowForm(true);
                }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <FilePlus className="h-4 w-4 text-purple-600" />
                <span>{isAr ? 'إنشاء ملحق / عقد جديد' : 'New Addendum / Contract'}</span>
              </DropdownMenuItem>
              {(isActive || contract.status === 'Expired') && (
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedContract(contract);
                    setNewEndDate(contract.endDate || '');
                    setDialogMode('renew');
                  }}
                  className="flex items-center gap-2 cursor-pointer text-emerald-600"
                >
                  <Clock className="h-4 w-4" />
                  <span>{isAr ? 'تجديد العقد' : 'Renew Contract'}</span>
                </DropdownMenuItem>
              )}
              {isActive && (
                <DropdownMenuItem
                  onClick={() => {
                    setConfirmDialog({ open: true, action: 'suspend', contractId: contract.id });
                  }}
                  className="flex items-center gap-2 cursor-pointer text-amber-600"
                >
                  <Ban className="h-4 w-4" />
                  <span>{isAr ? 'إيقاف مؤقت' : 'Suspend Contract'}</span>
                </DropdownMenuItem>
              )}
              {contract.status === 'Suspended' && (
                <DropdownMenuItem
                  onClick={() => activateContract(contract.id)}
                  className="flex items-center gap-2 cursor-pointer text-green-600"
                >
                  <Play className="h-4 w-4" />
                  <span>{isAr ? 'إعادة التفعيل' : 'Activate Contract'}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setSelectedContract(contract);
                  setDialogMode('delete');
                }}
                className="flex items-center gap-2 cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isAr ? 'حذف العقد' : 'Delete Contract'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  };

  // ---- Contracts Table & Expired Folded Card ----
  const renderContractsTable = () => {
    // Separate active/current contracts from expired contracts
    const activeContractsList = filterStatus === 'all' 
      ? filteredContracts.filter(c => c.status !== 'Expired')
      : filteredContracts;

    const expiredContractsList = filteredContracts.filter(c => c.status === 'Expired');

    if (viewMode === 'grouped_by_owner') {
      return (
        <div className="space-y-4">
          <WidgetCard
            title={isAr ? 'سجل العقود حسب المالك' : 'Contracts by Owner'}
            icon={Building2}
            headerAction={renderListToolbar()}
          >
            {renderGroupedByOwnerView()}
          </WidgetCard>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Main Active / Ongoing Contracts Card */}
        <WidgetCard
          title={isAr ? 'سجل العقود السارية' : 'Active Contracts Directory'}
          icon={FileText}
          headerAction={renderListToolbar()}
          className="overflow-hidden"
        >
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : activeContractsList.length === 0 ? (
            <div className="text-center p-12 text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">{c.noContractsFound || (isAr ? 'لا توجد عقود مطابقة' : 'No active contracts match the filters')}</p>
              <Button variant="link" onClick={openCreateDialog} className="text-indigo-600 dark:text-indigo-400 mt-2 font-semibold">
                {c.createFirstContract || (isAr ? 'إنشاء أول عقد' : 'Create your first contract')}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 -mb-6 mt-2">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 dark:bg-gray-900/60 hover:bg-gray-50/80 dark:hover:bg-gray-900/60 border-b border-gray-100 dark:border-gray-700/50">
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 w-[220px]">{c.contractAndType || 'Contract / Type'}</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{c.party || 'Party'}</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{c.residences || 'Residences'}</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{c.duration || 'Duration'}</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{c.value || 'Value'}</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{c.status || 'Status'}</TableHead>
                    <TableHead className={`font-semibold text-gray-700 dark:text-gray-300 ${isAr ? 'text-right' : 'text-left'} w-[100px]`}>{c.actions || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeContractsList.map(contract => renderContractRow(contract))}
                </TableBody>
              </Table>
            </div>
          )}
        </WidgetCard>

        {/* Expired Contracts (Collapsible / Folded Card at the bottom) */}
        {filterStatus === 'all' && (
          <div className="mt-6">
            <div 
              onClick={() => setIsExpiredOpen(prev => !prev)}
              className="bg-white dark:bg-gray-800/80 rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-700/50 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 dark:bg-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {isAr ? 'العقود المنتهية' : 'Expired Contracts'}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                      {expiredContractsList.length}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {isAr ? 'سجل العقود التي انتهت مدتها ولم يتم تجديدها (اضغط للعرض أو الإخفاء)' : 'Archived contracts that have reached expiration (click to expand/collapse)'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:inline">
                  {isExpiredOpen ? (isAr ? 'إخفاء' : 'Collapse') : (isAr ? 'عرض' : 'Expand')}
                </span>
                <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-gray-500">
                  {isExpiredOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </div>

            {isExpiredOpen && (
              <div className="mt-3 bg-white dark:bg-gray-800/80 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50">
                {expiredContractsList.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-6">
                    {isAr ? 'لا توجد عقود منتهية مسجلة' : 'No expired contracts found'}
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-6 -my-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/80 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-700/50">
                          <TableHead className="font-semibold text-gray-700 dark:text-gray-300 w-[220px]">{c.contractAndType || 'Contract / Type'}</TableHead>
                          <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{c.party || 'Party'}</TableHead>
                          <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{c.residences || 'Residences'}</TableHead>
                          <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{c.duration || 'Duration'}</TableHead>
                          <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{c.value || 'Value'}</TableHead>
                          <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{c.status || 'Status'}</TableHead>
                          <TableHead className={`font-semibold text-gray-700 dark:text-gray-300 ${isAr ? 'text-right' : 'text-left'} w-[100px]`}>{c.actions || 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expiredContractsList.map(contract => renderContractRow(contract))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ---- Invoices Tab ----
  const renderInvoicesTab = () => {
    return (
      <WidgetCard
        title={c.invoices || (isAr ? 'الفواتير والمستحقات' : 'Invoices')}
        icon={FileText}
        headerAction={
          <Button variant="outline" size="sm" onClick={() => generateMonthlyInvoices()} className="rounded-xl border-gray-200 dark:border-gray-700">
            <RefreshCw className="h-4 w-4 ml-1 mr-1" />
            {c.generateMonthlyInvoices || (isAr ? 'توليد الفواتير الشهرية' : 'Generate Monthly Invoices')}
          </Button>
        }
      >
        {invoices.length === 0 ? (
          <div className="text-center p-12 text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">{c.noInvoicesYet || (isAr ? 'لا توجد فواتير بعد' : 'No invoices yet')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 -mb-6 mt-2">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-700/50">
                  <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{(c as any).invoiceNumber || 'Invoice #'}</TableHead>
                  <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{(c as any).party || 'Party'}</TableHead>
                  <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{(c as any).billingPeriod || 'Period'}</TableHead>
                  <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{c.amount || 'Amount'}</TableHead>
                  <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{c.status || 'Status'}</TableHead>
                  <TableHead className={`font-semibold text-gray-700 dark:text-gray-300 ${isAr ? 'text-right' : 'text-left'}`}>{c.actions || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700/40">
                    <TableCell className="font-mono font-medium text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell className="font-semibold text-sm">{(inv as any).partyName || (inv as any).companyName || '-'}</TableCell>
                    <TableCell className="text-xs text-gray-500">{(inv as any).billingPeriod || inv.month || '-'}</TableCell>
                    <TableCell className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{formatSAR(inv.amount)} {isAr ? 'ر.س' : 'SAR'}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                        inv.status === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : inv.status === 'Overdue'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                        {inv.status}
                      </span>
                    </TableCell>
                    <TableCell className={isAr ? 'text-right' : 'text-left'}>
                      <Select value={inv.status} onValueChange={(val: any) => updateInvoiceStatus(inv.id, val)}>
                        <SelectTrigger className="h-8 w-28 rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pending">{(c as any).pending || 'Pending'}</SelectItem>
                          <SelectItem value="Paid">{(c as any).paid || 'Paid'}</SelectItem>
                          <SelectItem value="Overdue">{(c as any).overdue || 'Overdue'}</SelectItem>
                          <SelectItem value="Cancelled">{(c as any).cancelled || 'Cancelled'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </WidgetCard>
    );
  };


  // ---- Create/Edit Wizard Dialog ----
  const renderContractFormDialog = () => (
    <ContractWizardDialog
      open={showForm}
      onOpenChange={setShowForm}
      mode={dialogMode === 'edit' ? 'edit' : 'create'}
      selectedContract={selectedContract}
      companies={companies}
      residences={residences}
      onSubmit={async (newFormData, status) => {
        if (dialogMode === 'edit' && selectedContract) {
          await updateContract(selectedContract.id, newFormData as any);
        } else {
          await createContract(newFormData, status);
        }
        setDialogMode(null);
        setSelectedContract(null);
        setShowForm(false);
      }}
      isAr={isAr}
    />
  );

  // ---- Renew Dialog ----
  const renderRenewDialog = () => {
    const rd = c.renewDialog || {};

    const addExtension = (years: number, months: number = 0) => {
      if (!selectedContract) return;
      const baseStr = selectedContract.endDate || new Date().toISOString().split('T')[0];
      const base = new Date(baseStr);
      if (!isNaN(base.getTime())) {
        if (years) base.setFullYear(base.getFullYear() + years);
        if (months) base.setMonth(base.getMonth() + months);
        setNewEndDate(base.toISOString().split('T')[0]);
      }
    };

    return (
      <Dialog open={dialogMode === 'renew'} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-emerald-600" />
              {isAr ? 'تجديد العقد وتمديد مدة السريان' : (rd.title || 'Renew Contract')}
            </DialogTitle>
            <DialogDescription>
              {isAr ? 'اختر تاريخ الانتهاء الجديد أو استخدم خيارات التجديد السريع' : (rd.description || 'Enter the new end date for the contract')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Quick Extension Buttons */}
            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/40 space-y-2">
              <Label className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                {isAr ? 'تجديد وتمديد سريع بناءً على تاريخ انتهاء العقد الحالي:' : 'Quick Duration Additions:'}
              </Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addExtension(0, 6)}
                  className="text-xs bg-background hover:bg-emerald-100 hover:text-emerald-800"
                >
                  {isAr ? '+6 أشهر' : '+6 Months'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addExtension(1, 0)}
                  className="text-xs bg-background hover:bg-emerald-100 hover:text-emerald-800"
                >
                  {isAr ? '+سنة واحدة' : '+1 Year'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addExtension(2, 0)}
                  className="text-xs bg-background hover:bg-emerald-100 hover:text-emerald-800"
                >
                  {isAr ? '+سنتين' : '+2 Years'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addExtension(5, 0)}
                  className="text-xs bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
                >
                  {isAr ? '+5 سنوات 🔥' : '+5 Years 🔥'}
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">{rd.newEndDate || (isAr ? 'تاريخ نهاية العقد الجديد:' : 'New End Date:')}</Label>
              <Input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="mt-1.5 text-sm font-mono"
              />
            </div>

            {selectedContract && (
              <div className="p-3 bg-muted/60 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{isAr ? 'الطرف:' : 'Party:'}</span>
                  <span className="font-bold">{selectedContract.partyName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{isAr ? 'نهاية العقد الحالية:' : 'Current End Date:'}</span>
                  <span className="font-mono font-medium text-rose-600">{selectedContract.endDate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{isAr ? 'نظام التجديد التلقائي:' : 'Auto Renewal:'}</span>
                  <Badge variant="outline" className={selectedContract.autoRenew ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-700'}>
                    {selectedContract.autoRenew ? (isAr ? 'تلقائي (مفعل)' : 'Auto (Enabled)') : (isAr ? 'يدوي' : 'Manual')}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t">
                  <span>{isAr ? 'عدد مرات التجديد المنجزة:' : 'Prior Renewals:'}</span>
                  <span>{selectedContract.renewalCount || 0} {isAr ? 'مرة' : 'times'}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogMode(null)}>{rd.cancel || 'Cancel'}</Button>
            <Button onClick={handleRenew} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">{rd.renew || (isAr ? 'اعتماد التجديد' : 'Renew Contract')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ---- Reports Tab ----
  const renderReportsTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{c.revenueExpenseReport || 'Revenue & Expense Report'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between p-3 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
            <span>{c.totalMonthlyRevenue || 'Total Monthly Revenue'}</span>
            <span className="font-bold text-emerald-600">{formatSAR(stats.totalMonthlyRevenue)} {isAr ? 'ر.س' : 'SAR'}</span>
          </div>
          <div className="flex justify-between p-3 bg-rose-50 dark:bg-rose-950 rounded-lg">
            <span>{c.totalMonthlyExpense || 'Total Monthly Expense'}</span>
            <span className="font-bold text-rose-600">{formatSAR(stats.totalMonthlyExpense)} {isAr ? 'ر.س' : 'SAR'}</span>
          </div>
          <div className="flex justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <span>{c.netProfit || 'Net Monthly Profit'}</span>
            <span className="font-bold text-blue-600">{formatSAR(stats.totalMonthlyRevenue - stats.totalMonthlyExpense)} {isAr ? 'ر.س' : 'SAR'}</span>
          </div>
          <div className="pt-3 border-t">
            <Button variant="outline" className="w-full gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              {c.printReport || 'Print Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{c.contractStatus || 'Contract Status'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500" /> {c.active || 'Active'}</span>
              <Badge className="bg-green-100 text-green-800">{stats.activeContracts}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /> {c.expired || 'Expired'}</span>
              <Badge className="bg-red-100 text-red-800">{stats.expiredContracts}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500" /> {c.suspended || 'Suspended'}</span>
              <Badge className="bg-yellow-100 text-yellow-800">{stats.suspendedContracts}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /> {c.draft || 'Draft'}</span>
              <Badge className="bg-blue-100 text-blue-800">{stats.draftContracts}</Badge>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{isAr ? 'تنتهي هذا الشهر' : 'Expiring this month'}</span>
              <span>{stats.expiringThisMonth}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{isAr ? 'تنتهي الشهر القادم' : 'Expiring next month'}</span>
              <span>{stats.expiringNextMonth}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>{c.contractsByType || 'Contracts by Type'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CONTRACT_TYPES.map(type => {
              const count = stats.contractsByType[type.type] || 0;
              return (
                <div key={type.type} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 flex items-center justify-center rounded-md bg-background">
                    {typeIcons[type.icon] || <FileText className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{isAr ? type.labelAr : type.labelEn}</p>
                    <p className="text-xs text-muted-foreground">{count} {isAr ? 'عقد' : (c.contract || 'contract')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ---- Delete Confirmation Dialog ----
  const renderDeleteDialog = () => {
    const dd = c.deleteDialog || {};
    return (
    <Dialog open={dialogMode === 'delete'} onOpenChange={() => setDialogMode(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dd.title || 'Delete Contract'}</DialogTitle>
          <DialogDescription>
            {dd.description || 'Are you sure you want to delete this contract? All associated invoices and alerts will be deleted.'}
          </DialogDescription>
        </DialogHeader>
        {selectedContract && (
          <div className="p-3 bg-destructive/10 rounded-lg space-y-1">
            <p className="font-medium">{selectedContract.partyName}</p>
            <p className="text-sm text-muted-foreground">
              {isAr ? getContractTypeInfo(selectedContract.contractType).labelAr : getContractTypeInfo(selectedContract.contractType).labelEn}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatSAR(selectedContract.billingRate)} {isAr ? 'ر.س' : 'SAR'} / {getBillingTypeLabel(selectedContract.billingType, isAr)}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogMode(null)}>{dd.cancel || 'Cancel'}</Button>
          <Button variant="destructive" onClick={handleDelete}>{dd.delete || 'Delete'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    );
  };

  // ---- Confirm Action Dialog (Suspend/Cancel/Activate) ----
  const renderConfirmActionDialog = () => {
    const cd = c.confirmDialog || {};
    const handleConfirm = async () => {
      const { action, contractId } = confirmDialog;
      switch (action) {
        case 'suspend': await suspendContract(contractId); break;
        case 'cancel': await cancelContract(contractId); break;
        case 'activate': await activateContract(contractId); break;
      }
      setConfirmDialog({ open: false, action: 'suspend', contractId: '' });
    };

    const getTitle = () => {
      switch (confirmDialog.action) {
        case 'suspend': return cd.suspendTitle || 'Suspend Contract';
        case 'cancel': return cd.cancelTitle || 'Cancel Contract';
        case 'activate': return cd.activateTitle || 'Activate Contract';
      }
    };

    const getDescription = () => {
      switch (confirmDialog.action) {
        case 'suspend': return cd.suspendDescription || 'Are you sure you want to suspend this contract?';
        case 'cancel': return cd.cancelDescription || 'Are you sure you want to cancel this contract?';
        case 'activate': return cd.activateDescription || 'Are you sure you want to activate this contract?';
      }
    };

    const getConfirmLabel = () => {
      switch (confirmDialog.action) {
        case 'suspend': return isAr ? 'إيقاف' : 'Suspend';
        case 'cancel': return isAr ? 'إلغاء' : 'Cancel';
        case 'activate': return isAr ? 'تفعيل' : 'Activate';
      }
    };

    return (
      <Dialog open={confirmDialog.open} onOpenChange={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getTitle()}</DialogTitle>
            <DialogDescription>{getDescription()}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
              {cd.cancel || 'Cancel'}
            </Button>
            <Button 
              variant={confirmDialog.action === 'activate' ? 'default' : 'destructive'}
              onClick={handleConfirm}
            >
              {getConfirmLabel()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ---- Main Render ----
  return (
    <div className="space-y-8" dir={isAr ? 'rtl' : 'ltr'}>

      {/* Header Section (Matching Dashboard) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
              <FileText className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            {c.title || (isAr ? 'العقود' : 'Contracts')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {c.description || (isAr ? 'إدارة وتتبع عقود الإيجار والخدمات والمرافق.' : 'Detailed analytics and comprehensive insights across all contract modules.')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white dark:bg-gray-800/80 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {format(new Date(), 'EEEE, dd MMMM yyyy')}
            </span>
          </div>

          <Button onClick={openCreateDialog} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm px-4 py-2 font-medium">
            <Plus className="h-4 w-4" />
            {c.newContract || (isAr ? 'عقد جديد' : 'New Contract')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-gray-100 dark:border-gray-700/50'
          }`}
        >
          <Home className="w-4 h-4" />
          {c.overview || (isAr ? 'نظرة عامة' : 'Overview')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'invoices'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-gray-100 dark:border-gray-700/50'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          {c.invoices || (isAr ? 'الفواتير' : 'Invoices')}
          {invoices.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'invoices' ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {invoices.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'reports'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-gray-100 dark:border-gray-700/50'
          }`}
        >
          <Activity className="w-4 h-4" />
          {c.reports || (isAr ? 'التقارير' : 'Reports')}
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {renderOverviewCards()}
          {renderTypeDistribution()}
          {renderFiltersBar()}
          {renderContractsTable()}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="space-y-6">
          {renderInvoicesTab()}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          {renderReportsTab()}
        </div>
      )}

      {/* Dialogs */}
      {renderContractFormDialog()}
      {renderRenewDialog()}
      {renderDeleteDialog()}
      {renderConfirmActionDialog()}
      <MigrationPreviewDialog open={showMigration} onOpenChange={setShowMigration} />
      <EditLinkedResidencesDialog
        open={!!residenceEditContract}
        onOpenChange={(open) => !open && setResidenceEditContract(null)}
        contract={residenceEditContract}
        residences={residences}
        isAr={isAr}
      />
    </div>
  );
}

