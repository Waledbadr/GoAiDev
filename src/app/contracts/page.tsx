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
  Plus, Edit, Trash2, FileText, TrendingUp, TrendingDown, Calendar, Moon,
  Building2, Check, X, AlertTriangle, RefreshCw, Search, Filter,
  DollarSign, Users, Home, Store, Wrench, Droplets, Flame, Wifi,
  Clock, MoreHorizontal, Printer, Download, Eye, Ban, Play,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FilePlus, Layers
} from 'lucide-react';
import Link from 'next/link';
import { formatHijriSubtext } from '@/lib/hijri-date-utils';
import { ContractWizardDialog } from '@/components/contracts/ContractWizardDialog';
import {
  type Contract, type ContractFormData, type ContractType, type ContractStatus,
  type BillingType, type ContractService, type PartyType, type RenewalType,
  CONTRACT_TYPES, getContractTypeInfo, getContractCategoryLabel,
  getContractStatusLabel, getBillingTypeLabel, getRenewalTypeLabel, formatSAR
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

export default function ContractsPage() {
  const {
    contracts, invoices, loading, stats,
    createContract, updateContract, deleteContract,
    renewContract, suspendContract, cancelContract, activateContract,
    generateMonthlyInvoices, getInvoicesByContract,
    searchContracts, filterContracts, checkExpiringContracts,
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
      checkExpiringContracts();
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
      totalValue: ownerContracts.reduce((sum, item) => sum + (item.billingRate || 0), 0),
      activeCount: ownerContracts.filter(item => item.status === 'Active' || item.status === 'active').length,
      expiredCount: ownerContracts.filter(item => item.status === 'Expired' || item.status === 'expired').length,
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
  const OverviewCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card className="border-l-4 border-l-green-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {c.totalActiveContracts || 'Total Active Contracts'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-green-600">{stats.activeContracts}</div>
            <FileText className="h-8 w-8 text-green-200" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {c.outOf || 'out of'} {stats.totalContracts} {isAr ? 'عقد' : (c.contractsCount || 'contracts')}
          </p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-emerald-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {c.monthlyRevenue || 'Monthly Revenue'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-emerald-600">
              {formatSAR(stats.totalMonthlyRevenue)}
            </div>
            <TrendingUp className="h-8 w-8 text-emerald-200" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{c.sarPerMonth || 'SAR / month'}</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-rose-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {c.monthlyExpense || 'Monthly Expense'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-rose-600">
              {formatSAR(stats.totalMonthlyExpense)}
            </div>
            <TrendingDown className="h-8 w-8 text-rose-200" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{c.sarPerMonth || 'SAR / month'}</p>
        </CardContent>
      </Card>

      <Card className={`border-l-4 ${stats.expiringThisMonth > 0 ? 'border-l-orange-500' : 'border-l-blue-500'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {stats.expiringThisMonth > 0
              ? (c.expiringSoon || 'Expiring Soon')
              : (c.netMonthly || 'Net Monthly')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.expiringThisMonth > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-orange-600">{stats.expiringThisMonth}</div>
                <AlertTriangle className="h-8 w-8 text-orange-200" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{c.expiresThisMonth || 'expires this month'}</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-blue-600">
                  {formatSAR(stats.totalMonthlyRevenue - stats.totalMonthlyExpense)}
                </div>
                <DollarSign className="h-8 w-8 text-blue-200" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{isAr ? 'صافي الربح / الشهر' : 'Net profit / month'}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ---- Contract Type Distribution ----
  const TypeDistribution = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{c.contractTypeDistribution || 'Contract Type Distribution'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {CONTRACT_TYPES.map(type => {
            const count = stats.contractsByType[type.type] || 0;
            if (count === 0) return null;
            const total = stats.totalContracts || 1;
            const percentage = Math.round((count / total) * 100);
            return (
              <div key={type.type} className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted">
                  {typeIcons[type.icon] || <FileText className="h-4 w-4" />}
                </div>
              <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{isAr ? type.labelAr : type.labelEn}</span>
                    <span className="text-muted-foreground">{count} {isAr ? 'عقد' : (c.contract || 'contract')} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${type.category === 'revenue' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
              </div>
            </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  // ---- Filters Bar ----
  const FiltersBar = () => (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Filter className="h-5 w-5" />
          {c.filterAndSearch || 'Filter & Search'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label>{c.search || 'Search'}</Label>
            <div className="relative mt-1">
              <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 h-4 w-4 text-muted-foreground`} />
              <Input
                placeholder={c.searchPartyPlaceholder || 'Party name...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={isAr ? 'pr-9' : 'pl-9'}
              />
            </div>
          </div>
          <div>
            <Label>{c.category || 'Category'}</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={c.all || 'All'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{c.all || 'All'}</SelectItem>
                <SelectItem value="revenue">{c.revenue || 'Revenue'}</SelectItem>
                <SelectItem value="expense">{c.expense || 'Expense'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{c.status || 'Status'}</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={c.all || 'All'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{c.all || 'All'}</SelectItem>
                <SelectItem value="Active">{c.active || 'Active'}</SelectItem>
                <SelectItem value="Suspended">{c.suspended || 'Suspended'}</SelectItem>
                <SelectItem value="Expired">{c.expired || 'Expired'}</SelectItem>
                <SelectItem value="Cancelled">{c.cancelled || 'Cancelled'}</SelectItem>
                <SelectItem value="Draft">{c.draft || 'Draft'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{c.contractType || 'Contract Type'}</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={c.all || 'All'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{c.all || 'All'}</SelectItem>
                {CONTRACT_TYPES.map(t => (
                  <SelectItem key={t.type} value={t.type}>{isAr ? t.labelAr : t.labelEn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{c.residence || 'Residence'}</Label>
            <Select value={filterResidence} onValueChange={setFilterResidence}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={c.all || 'All'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{c.all || 'All'}</SelectItem>
                {residences.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {(searchTerm || filterType !== 'all' || filterCategory !== 'all' || filterStatus !== 'all' || filterResidence !== 'all') && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <span className="text-sm text-muted-foreground">
              {c.results || 'Results'}: {filteredContracts.length} {isAr ? 'عقد' : (c.contract || 'contract')}
            </span>
            <Button variant="ghost" size="sm" onClick={() => {
              setSearchTerm('');
              setFilterType('all');
              setFilterCategory('all');
              setFilterStatus('all');
              setFilterResidence('all');
            }}>
              <X className="h-3 w-3 ml-1" />
              {c.reset || 'Reset'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ---- Grouped by Owner View (Collapsible Accordion Cards) ----
  const GroupedByOwnerView = () => {
    const [openOwners, setOpenOwners] = useState<Record<string, boolean>>({});

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
                                  <p className="font-mono font-bold text-slate-900 dark:text-slate-100">{contract.contractNumber}</p>
                                  <p className="text-muted-foreground text-[11px]">{contract.title || (isAr ? info.labelAr : info.labelEn)}</p>
                                </div>
                              </TableCell>

                              <TableCell>
                                {contract.contractRelationType === 'addendum' ? (
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
                                    📑 {isAr ? 'ملحق عقد' : 'Addendum'}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-[10px]">
                                    📄 {isAr ? 'عقد أساسي' : 'Primary'}
                                  </Badge>
                                )}
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
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant="ghost" title={isAr ? 'تعديل العقد' : 'Edit'} onClick={() => openEditDialog(contract)}>
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title={isAr ? 'عمل ملحق أو عقد جديد' : 'New Addendum'}
                                    onClick={() => {
                                      setSelectedContract(contract);
                                      setDialogMode('create');
                                      setShowForm(true);
                                    }}
                                  >
                                    <FilePlus className="h-3.5 w-3.5 text-purple-600" />
                                  </Button>
                                  {(isActive || isExpired) && (
                                    <Button size="sm" variant="ghost" title={isAr ? 'تجديد العقد' : 'Renew'} onClick={() => {
                                      setSelectedContract(contract);
                                      setNewEndDate(contract.endDate || '');
                                      setDialogMode('renew');
                                    }}>
                                      <Clock className="h-3.5 w-3.5 text-emerald-600" />
                                    </Button>
                                  )}
                                </div>
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

  // ---- Contracts Table ----
  const ContractsTable = () => {
    if (viewMode === 'grouped_by_owner') {
      return <GroupedByOwnerView />;
    }

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">{c.contractList || 'Contract List'}</CardTitle>
              <div className="flex items-center bg-muted p-1 rounded-lg border text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    viewMode === 'table' ? 'bg-background text-foreground shadow-xs font-bold' : 'text-muted-foreground'
                  }`}
                >
                  📋 {isAr ? 'جدول العقود' : 'Table'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grouped_by_owner')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    viewMode === 'grouped_by_owner' ? 'bg-background text-foreground shadow-xs font-bold' : 'text-muted-foreground'
                  }`}
                >
                  🏢 {isAr ? 'تجميع حسب المالك (قابل للطي)' : 'By Owner'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => generateMonthlyInvoices()}>
                <RefreshCw className="h-4 w-4 ml-1" />
                {c.generateMonthlyInvoices || 'Generate Monthly Invoices'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => checkExpiringContracts()}>
                <AlertTriangle className="h-4 w-4 ml-1" />
                {c.checkAlerts || 'Check Alerts'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{c.noContractsFound || 'No contracts match the filters'}</p>
              <Button variant="link" onClick={openCreateDialog}>{c.createFirstContract || 'Create your first contract'}</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">{c.contractAndType || 'Contract / Type'}</TableHead>
                    <TableHead>{c.party || 'Party'}</TableHead>
                    <TableHead>{c.residences || 'Residences'}</TableHead>
                    <TableHead>{c.duration || 'Duration'}</TableHead>
                    <TableHead>{c.value || 'Value'}</TableHead>
                    <TableHead>{c.status || 'Status'}</TableHead>
                    <TableHead className={`${isAr ? 'text-right' : 'text-left'} w-[120px]`}>{c.actions || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => {
                    const info = getContractTypeInfo(contract.contractType);
                    const isActive = contract.status === 'Active';
                    const expiringSoon = isExpiringSoon(contract);
                    return (
                      <TableRow key={contract.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              contract.contractCategory === 'revenue'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}>
                              {typeIcons[info.icon] || <FileText className="h-5 w-5" />}
                            </div>
                            <div>
                              <p className="font-medium">{isAr ? info.labelAr : info.labelEn}</p>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                <Badge variant="outline" className={`text-xs ${
                                  contract.contractCategory === 'revenue'
                                    ? 'border-emerald-200 text-emerald-700'
                                    : 'border-rose-200 text-rose-700'
                                }`}>
                                  {getContractCategoryLabel(contract.contractCategory, isAr)}
                                </Badge>
                                {contract.contractRelationType === 'addendum' && (
                                  <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                                    {isAr ? 'ملحق عقد' : 'Addendum'}
                                  </Badge>
                                )}
                                {expiringSoon && (
                                  <Badge variant="outline" className="text-xs border-orange-200 text-orange-700">
                                    <AlertTriangle className="h-3 w-3 ml-1" />
                                    {isAr ? 'ينتهي قريباً' : 'Expiring Soon'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{contract.partyName}</p>
                            <Badge variant="secondary" className="text-xs">
                              {getPartyTypeLabel(contract.partyType)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {contract.linkedResidences.slice(0, 3).map(resId => {
                              const res = residences.find(r => r.id === resId);
                              return (
                                <Badge key={resId} variant="outline" className="text-xs">
                                  {res?.name || resId}
                                </Badge>
                              );
                            })}
                            {contract.linkedResidences.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{contract.linkedResidences.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span>{isAr ? 'من' : (c.from || 'from')} {contract.startDate}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span>{isAr ? 'إلى' : (c.to || 'to')} {contract.endDate}</span>
                            </div>
                            {contract.isOpenEnded && (
                              <Badge variant="secondary" className="text-xs">{c.openEnded || 'Open-ended'}</Badge>
                            )}
                            {/* Subtext note for Hijri contracts ONLY */}
                            {contract.dateSystem === 'hijri' && (
                              <div className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded-md flex items-center gap-1 mt-1 font-medium">
                                <Moon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span>{isAr ? 'ملاحظة (هجري):' : 'Hijri note:'} {formatHijriSubtext(contract.startDate, isAr)} - {formatHijriSubtext(contract.endDate, isAr)}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className={`font-bold ${
                              contract.contractCategory === 'revenue' ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {contract.contractCategory === 'revenue' ? '' : '-'}
                              {formatSAR(contract.billingRate)} {isAr ? 'ر.س' : 'SAR'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {getBillingTypeLabel(contract.billingType, isAr)}
                            </p>
                            {contract.services && contract.services.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {contract.services.length} {c.services || 'services'}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className={getStatusBadge(contract.status)}>
                              {getContractStatusLabel(contract.status, isAr)}
                            </Badge>
                            {contract.autoRenew ? (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/60 w-fit">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin-slow" />
                                <span>{isAr ? getRenewalTypeLabel(contract.renewalType, isAr) : 'Auto'}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500 font-normal px-1.5 py-0.5">
                                {isAr ? 'يدوي' : 'Manual'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" title={isAr ? 'تعديل العقد' : 'Edit Contract'} onClick={() => openEditDialog(contract)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title={isAr ? 'عمل ملحق أو عقد جديد لنفس المالك' : 'Add Addendum / New Contract'}
                              onClick={() => {
                                setSelectedContract(contract);
                                setDialogMode('create');
                                setShowForm(true);
                              }}
                            >
                              <FilePlus className="h-4 w-4 text-purple-600" />
                            </Button>
                            {(isActive || contract.status === 'Expired') && (
                              <>
                                <Button size="sm" variant="ghost" title={isAr ? 'تجديد العقد' : 'Renew Contract'} onClick={() => {
                                  setSelectedContract(contract);
                                  setNewEndDate(contract.endDate || '');
                                  setDialogMode('renew');
                                }}>
                                  <Clock className="h-4 w-4 text-emerald-600" />
                                </Button>
                                <Button size="sm" variant="ghost" title={isAr ? 'حذف العقد' : 'Delete Contract'} onClick={() => {
                                  setSelectedContract(contract);
                                  setDialogMode('delete');
                                }}>
                                  <Trash2 className="h-4 w-4 text-rose-500" />
                                </Button>
                              </>
                            )}
                            {contract.status === 'Suspended' && (
                              <Button size="sm" variant="ghost" onClick={() => activateContract(contract.id)}>
                                <Play className="h-4 w-4 text-green-500" />
                              </Button>
                            )}
                            {isActive && (
                              <Button size="sm" variant="ghost" onClick={() => {
                                setConfirmDialog({ open: true, action: 'suspend', contractId: contract.id });
                              }}>
                                <Ban className="h-4 w-4 text-yellow-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ---- Invoices Tab ----
  const InvoicesTab = () => {
    const updateInvoiceStatus = useContracts().updateInvoiceStatus;
    return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{c.invoices || 'Invoices'}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => generateMonthlyInvoices()}>
            <RefreshCw className="h-4 w-4 ml-1" />
            {c.generateMonthlyInvoices || 'Generate Monthly Invoices'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {invoices.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{c.noInvoicesYet || 'No invoices yet'}</p>
            <p className="text-sm">{c.createInvoicesHint || 'Click "Generate Monthly Invoices" to create invoices'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{c.invoiceNumber || 'Invoice Number'}</TableHead>
                  <TableHead>{c.month || 'Month'}</TableHead>
                  <TableHead>{c.contract || 'Contract'}</TableHead>
                  <TableHead>{c.amount || 'Amount'}</TableHead>
                  <TableHead>{c.status || 'Status'}</TableHead>
                  <TableHead>{c.actions || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.slice(0, 50).map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-sm">
                      {invoice.invoiceNumber || `#${invoice.id.slice(0, 8)}`}
                    </TableCell>
                    <TableCell>{invoice.month}</TableCell>
                    <TableCell>
                      {contracts.find(c => c.id === invoice.contractId)?.partyName || (isAr ? 'غير معروف' : 'Unknown')}
                    </TableCell>
                    <TableCell className="font-medium">{formatSAR(invoice.amount)} {isAr ? 'ر.س' : 'SAR'}</TableCell>
                    <TableCell>
                      <Badge variant={
                        invoice.status === 'Paid' ? 'secondary' :
                        invoice.status === 'Overdue' ? 'destructive' : 'outline'
                      }>
                        {invoice.status === 'Draft' ? (isAr ? 'مسودة' : 'Draft') :
                         invoice.status === 'Issued' ? (isAr ? 'مرسلة' : 'Issued') :
                         invoice.status === 'Paid' ? (c.paid || 'Paid') :
                         invoice.status === 'Overdue' ? (c.overdue || 'Overdue') : invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {invoice.status === 'Draft' && (
                          <Button size="sm" variant="ghost" onClick={() => updateInvoiceStatus(invoice.id, 'Issued' as any)}>
                            {c.send || 'Send'}
                          </Button>
                        )}
                        {invoice.status === 'Issued' && (
                          <Button size="sm" variant="outline" className="text-green-600" onClick={() => updateInvoiceStatus(invoice.id, 'Paid' as any)}>
                            {c.pay || 'Pay'}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
    );
  };

  // ---- Create/Edit Wizard Dialog ----
  const ContractFormDialog = () => (
    <ContractWizardDialog
      open={showForm}
      onOpenChange={setShowForm}
      mode={dialogMode === 'edit' ? 'edit' : 'create'}
      selectedContract={selectedContract}
      companies={companies}
      residences={residences}
      onSubmit={async (newFormData) => {
        if (dialogMode === 'edit' && selectedContract) {
          await updateContract(selectedContract.id, newFormData as any);
        } else {
          await createContract(newFormData);
        }
        setDialogMode(null);
        setSelectedContract(null);
        setShowForm(false);
      }}
      isAr={isAr}
    />
  );

  // ---- Renew Dialog ----
  const RenewDialog = () => {
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
  const ReportsTab = () => (
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
  const DeleteDialog = () => {
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
  const ConfirmActionDialog = () => {
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
    <div className={`container mx-auto p-4 space-y-6`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{c.title || 'Contracts'}</h1>
          <p className="text-muted-foreground">{c.description || 'Comprehensive contract management system'}</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4 ml-1" />
          {c.newContract || 'New Contract'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full md:w-auto grid-cols-3 md:inline-flex">
          <TabsTrigger value="overview">{c.overview || 'Overview'}</TabsTrigger>
          <TabsTrigger value="invoices">{c.invoices || 'Invoices'}</TabsTrigger>
          <TabsTrigger value="reports">{c.reports || 'Reports'}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewCards />
          <TypeDistribution />
          <FiltersBar />
          <ContractsTable />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesTab />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ContractFormDialog />
      <RenewDialog />
      <DeleteDialog />
      <ConfirmActionDialog />
    </div>
  );
}

