'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Receipt,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Download,
  Search,
  Eye,
} from 'lucide-react';
import { useContracts } from '@/context/contracts-context';
import { useLanguage } from '@/context/language-context';
import { type ContractInvoice, formatSAR } from '@/types/contracts';
import { useToast } from '@/hooks/use-toast';

interface ContractInvoicesRadarProps {
  onSelectContractById?: (contractId: string) => void;
}

export function ContractInvoicesRadar({
  onSelectContractById,
}: ContractInvoicesRadarProps) {
  const { contracts, invoices, generateMonthlyInvoices, updateInvoiceStatus } = useContracts();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isRunningEngine, setIsRunningEngine] = useState(false);

  const contractsMap = useMemo(() => {
    const map = new Map<string, { partyName: string; contractNumber?: string; category: string }>();
    contracts.forEach((c) => {
      map.set(c.id, {
        partyName: c.partyName,
        contractNumber: c.contractNumber,
        category: c.contractCategory,
      });
    });
    return map;
  }, [contracts]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.month) set.add(inv.month);
    });
    return Array.from(set).sort().reverse();
  }, [invoices]);

  const invoiceStats = useMemo(() => {
    let total = 0;
    let paid = 0;
    let overdue = 0;
    let issued = 0;

    invoices.forEach((inv) => {
      const amt = Number(inv.amount) || 0;
      total += amt;
      if (inv.status === 'Paid') paid += amt;
      else if (inv.status === 'Overdue') overdue += amt;
      else issued += amt;
    });

    return { total, paid, overdue, issued };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const contractInfo = contractsMap.get(inv.contractId);
      const party = contractInfo?.partyName?.toLowerCase() || '';
      const num = (inv.invoiceNumber || inv.id).toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch = !term || party.includes(term) || num.includes(term);
      const matchesMonth = selectedMonth === 'all' || inv.month === selectedMonth;
      const matchesStatus = selectedStatus === 'all' || inv.status === selectedStatus;

      return matchesSearch && matchesMonth && matchesStatus;
    });
  }, [invoices, contractsMap, searchTerm, selectedMonth, selectedStatus]);

  const handleRunMonthlyEngine = async () => {
    setIsRunningEngine(true);
    try {
      await generateMonthlyInvoices();
      toast({
        title: isAr ? 'تم تشغيل محرك الفوترة الشهري ⚡' : 'Monthly Billing Engine Completed ⚡',
        description: isAr
          ? 'تم إصدار وتحديث فواتير الشهر الحالي لجميع العقود النشطة بنجاح.'
          : 'Generated and updated current month invoices for all active contracts.',
      });
    } catch (err: any) {
      toast({
        title: isAr ? 'خطأ أثناء تشغيل الفوترة' : 'Billing Engine Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsRunningEngine(false);
    }
  };

  const handleExportCSV = () => {
    const rows = [
      isAr
        ? ['رقم الفاتورة', 'الطرف / الشركة', 'الشهر المالي', 'المبلغ (ر.س)', 'الحالة', 'تاريخ الإصدار', 'تاريخ السداد']
        : ['Invoice #', 'Party / Company', 'Billing Month', 'Amount (SAR)', 'Status', 'Issued Date', 'Paid Date'],
      ...filteredInvoices.map((inv) => [
        inv.invoiceNumber || inv.id,
        contractsMap.get(inv.contractId)?.partyName || '---',
        inv.month,
        inv.amount,
        inv.status,
        inv.issuedAt?.split('T')[0] || '',
        inv.paidAt?.split('T')[0] || '',
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `contracts-invoices-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-start" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold">
              {isAr ? 'مركز الفوترة والتحصيل المالي 2.0' : 'Invoices & Billing Hub 2.0'}
            </h2>
          </div>
          <p className="text-xs text-slate-300">
            {isAr
              ? 'توليد الفواتير الدورية آلياً، متابعة مستحقات العقود الإسكانية والتشغيلية، وضبط التدفقات النقدية'
              : 'Automated recurring billing, worker occupancy invoices, and payment tracking'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportCSV}
            variant="outline"
            size="sm"
            className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {isAr ? 'تصدير تقرير CSV' : 'Export CSV'}
          </Button>

          <Button
            onClick={handleRunMonthlyEngine}
            disabled={isRunningEngine}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 shadow-lg shadow-emerald-600/30 px-5"
          >
            <Sparkles className="w-4 h-4" />
            {isRunningEngine
              ? (isAr ? 'جاري الفوترة...' : 'Billing in progress...')
              : (isAr ? 'تشغيل محرك الفوترة لجميع العقود ⚡' : 'Run Monthly Billing Engine ⚡')}
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">
                {isAr ? 'إجمالي الفواتير الصادرة' : 'Total Invoiced'}
              </span>
              <p className="text-xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
                {formatSAR(invoiceStats.total)} SAR
              </p>
              <span className="text-[11px] text-slate-400 block">{invoices.length} {isAr ? 'فاتورة مسجلة' : 'invoices recorded'}</span>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Receipt className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-emerald-600 font-medium">
                {isAr ? 'المبالغ المحصلة (مدفوعة)' : 'Paid & Collected'}
              </span>
              <p className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                {formatSAR(invoiceStats.paid)} SAR
              </p>
              <span className="text-[11px] text-slate-400 block">
                {invoices.filter((i) => i.status === 'Paid').length} {isAr ? 'فاتورة مسددة' : 'paid invoices'}
              </span>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-blue-600 font-medium">
                {isAr ? 'مستحقة قيد السداد (مصدرة)' : 'Outstanding (Issued)'}
              </span>
              <p className="text-xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
                {formatSAR(invoiceStats.issued)} SAR
              </p>
              <span className="text-[11px] text-slate-400 block">
                {invoices.filter((i) => i.status === 'Issued').length} {isAr ? 'فاتورة مفتوحة' : 'pending invoices'}
              </span>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-rose-600 font-medium">
                {isAr ? 'متأخرات في التحصيل' : 'Overdue Invoices'}
              </span>
              <p className="text-xl font-extrabold font-mono text-rose-600 dark:text-rose-400">
                {formatSAR(invoiceStats.overdue)} SAR
              </p>
              <span className="text-[11px] text-slate-400 block">
                {invoices.filter((i) => i.status === 'Overdue').length} {isAr ? 'فاتورة متأخرة' : 'overdue invoices'}
              </span>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900/70 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-slate-400 ${isAr ? 'right-3' : 'left-3'}`} />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isAr ? 'ابحث برقم الفاتورة أو اسم الشركة...' : 'Search by invoice # or company...'}
              className={`${isAr ? 'pr-9' : 'pl-9'} h-9 text-xs`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue placeholder={isAr ? 'الشهر المالي' : 'Billing Month'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? 'كل الأشهر' : 'All Months'}</SelectItem>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue placeholder={isAr ? 'حالة الفاتورة' : 'Invoice Status'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? 'كل الحالات' : 'All Statuses'}</SelectItem>
              <SelectItem value="Paid">{isAr ? 'مدفوعة ✓' : 'Paid ✓'}</SelectItem>
              <SelectItem value="Issued">{isAr ? 'مصدرة ⏳' : 'Issued ⏳'}</SelectItem>
              <SelectItem value="Overdue">{isAr ? 'متأخرة ⚠️' : 'Overdue ⚠️'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Invoices Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-800/60">
            <TableRow>
              <TableHead className={isAr ? 'text-right text-xs' : 'text-left text-xs'}>{isAr ? 'رقم الفاتورة' : 'Invoice #'}</TableHead>
              <TableHead className={isAr ? 'text-right text-xs' : 'text-left text-xs'}>{isAr ? 'الطرف / المنشأة' : 'Party / Client'}</TableHead>
              <TableHead className={isAr ? 'text-right text-xs' : 'text-left text-xs'}>{isAr ? 'الشهر المالي' : 'Month'}</TableHead>
              <TableHead className={isAr ? 'text-right text-xs' : 'text-left text-xs'}>{isAr ? 'قيمة الفاتورة' : 'Amount'}</TableHead>
              <TableHead className={isAr ? 'text-right text-xs' : 'text-left text-xs'}>{isAr ? 'الحالة' : 'Status'}</TableHead>
              <TableHead className={isAr ? 'text-right text-xs' : 'text-left text-xs'}>{isAr ? 'تاريخ الإصدار' : 'Issued Date'}</TableHead>
              <TableHead className="text-center text-xs">{isAr ? 'الإجراءات' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                  {isAr ? 'لا توجد فواتير مطابقة لخيارات البحث' : 'No invoices matching filters'}
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices.map((inv) => {
                const contract = contractsMap.get(inv.contractId);
                return (
                  <TableRow key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs">
                    <TableCell className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {inv.invoiceNumber || `INV-${inv.id.slice(0, 6).toUpperCase()}`}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                        {contract?.partyName || (isAr ? 'طرف غير معرف' : 'Unknown Party')}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {inv.month}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {formatSAR(inv.amount)} SAR
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          inv.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : inv.status === 'Overdue'
                            ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300'
                        }`}
                      >
                        {inv.status === 'Paid'
                          ? (isAr ? 'مدفوعة ✓' : 'Paid ✓')
                          : inv.status === 'Overdue'
                          ? (isAr ? 'متأخرة ⚠️' : 'Overdue ⚠️')
                          : (isAr ? 'مصدرة ⏳' : 'Issued ⏳')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 font-mono text-[11px]">
                      {inv.issuedAt?.split('T')[0]}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {inv.status !== 'Paid' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateInvoiceStatus(inv.id, 'Paid')}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-[11px] h-7 px-2"
                          >
                            {isAr ? 'سداد ✓' : 'Pay ✓'}
                          </Button>
                        )}
                        {onSelectContractById && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onSelectContractById(inv.contractId)}
                            className="text-slate-600 hover:text-indigo-600 text-[11px] h-7 px-2"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
