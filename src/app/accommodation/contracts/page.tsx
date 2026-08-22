"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useAccommodation, type Contract } from '@/context/accommodation-context';
import { useUsers } from '@/context/users-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, FileText, TrendingUp, Calendar, Building2, Check, AlertTriangle } from 'lucide-react';
import { flagLegacyContract, hasCritical, type RateFlag } from '@/lib/contract-data-quality';
import { useSearchParams } from 'next/navigation';

export default function ContractsPage() {
  const searchParams = useSearchParams();
  const companyFilter = searchParams?.get('company');
  
  const { contracts, companies, residences, occupants, workers, saveContract, deleteContract, getInvoicesByContract } = useAccommodation();
  const { currentUser } = useUsers();
  
  // Filter residences based on user role
  const filteredResidences = useMemo(() => {
    if (!currentUser) return residences;
    if (currentUser.role === 'Admin') return residences;
    return residences.filter(r => currentUser.assignedResidences.includes(r.id));
  }, [currentUser, residences]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    companyId: '',
    residenceIds: [] as string[], // Changed to array for multi-select
    startDate: '',
    endDate: '',
    ratePerPersonPerMonth: 0,
    // الوحدة الحقيقية للاتفاقات يومية، فهي المبدئية للعقود الجديدة.
    rateUnit: 'daily' as 'daily' | 'monthly',
    expectedWorkers: 0,
    status: 'Active' as Contract['status'],
    notes: '',
  });

  // Helper to check if all residences are selected
  const isAllResidences = formData.residenceIds.includes('all');

  // Toggle residence selection
  const toggleResidence = (residenceId: string) => {
    setFormData(prev => {
      const currentIsAll = prev.residenceIds.includes('all');
      
      if (residenceId === 'all') {
        // If clicking "all", toggle between all and none
        return { ...prev, residenceIds: currentIsAll ? [] : ['all'] };
      } else {
        // If clicking individual residence
        if (currentIsAll) {
          // Switch from "all" to specific selections (all except clicked)
          const allIds = filteredResidences.map(r => r.id).filter(id => id !== residenceId);
          return { ...prev, residenceIds: allIds };
        } else if (prev.residenceIds.includes(residenceId)) {
          // Remove from selection
          return { ...prev, residenceIds: prev.residenceIds.filter(id => id !== residenceId) };
        } else {
          // Add to selection
          const newIds = [...prev.residenceIds, residenceId];
          // If all residences are now selected, switch to 'all'
          if (newIds.length === filteredResidences.length) {
            return { ...prev, residenceIds: ['all'] };
          } else {
            return { ...prev, residenceIds: newIds };
          }
        }
      }
    });
  };

  // فحص جودة البيانات لكل العقود، لا للمعروضة فقط: عقد بسعر خاطئ مخفيّ خلف
  // فلتر لا يزال يصدر فواتير خاطئة.
  const contractFlags = useMemo(() => {
    const map: Record<string, RateFlag[]> = {};
    contracts.forEach(contract => {
      const flags = flagLegacyContract(contract);
      if (flags.length > 0) map[contract.id] = flags;
    });
    return map;
  }, [contracts]);

  const criticalContracts = useMemo(
    () => contracts.filter(c => hasCritical(contractFlags[c.id] || [])),
    [contracts, contractFlags]
  );

  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => {
      // Company filter from URL
      if (companyFilter && contract.companyId !== companyFilter) return false;
      
      // Status filter
      if (statusFilter !== 'all' && contract.status !== statusFilter) return false;
      
      // Search filter
      if (searchTerm) {
        const company = companies.find(c => c.id === contract.companyId);
        const residence = residences.find(r => r.id === contract.residenceId);
        const searchLower = searchTerm.toLowerCase();
        
        if (
          !company?.name.toLowerCase().includes(searchLower) &&
          !residence?.name.toLowerCase().includes(searchLower) &&
          !contract.id.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      
      return true;
    });
  }, [contracts, statusFilter, searchTerm, companyFilter, companies, residences]);

  const handleOpenDialog = (contract?: Contract) => {
    if (contract) {
      setEditingContract(contract);
      // Load residenceIds - use new array if available, otherwise fallback to single residenceId
      const loadedResidenceIds = contract.residenceIds && contract.residenceIds.length > 0
        ? contract.residenceIds
        : (contract.residenceId ? [contract.residenceId] : []);
      
      setFormData({
        companyId: contract.companyId,
        residenceIds: loadedResidenceIds,
        startDate: contract.startDate.split('T')[0],
        endDate: contract.endDate.split('T')[0],
        ratePerPersonPerMonth: contract.ratePerPersonPerMonth,
        // العقود المحفوظة قبل وجود الحقل تصل بلا وحدة؛ تُترك فارغة ليختارها
        // المستخدم بدل أن تُملأ بقيمة مبدئية قد تكون خاطئة.
        rateUnit: contract.rateUnit ?? ('' as unknown as 'daily' | 'monthly'),
        expectedWorkers: contract.expectedWorkers || 0,
        status: contract.status,
        notes: contract.notes || '',
      });
    } else {
      setEditingContract(null);
      setFormData({
        companyId: companyFilter || '',
        residenceIds: [],
        startDate: '',
        endDate: '',
        ratePerPersonPerMonth: 0,
        rateUnit: 'daily',
        expectedWorkers: 0,
        status: 'Active',
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  /**
   * حسم وحدة الأجرة لعقد قائم. لا يغيّر الرقم — يسجّل فقط ما يعنيه، وهو ما كان
   * ناقصاً منذ البداية.
   */
  const setRateUnit = async (contract: Contract, unit: 'daily' | 'monthly') => {
    try {
      await saveContract({ ...contract, rateUnit: unit });
    } catch (error) {
      console.error('Failed to set rate unit:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.residenceIds.length === 0) {
      alert('الرجاء اختيار سكن واحد على الأقل');
      return;
    }

    if (formData.rateUnit !== 'daily' && formData.rateUnit !== 'monthly') {
      alert('حدّد وحدة الأجرة: لكل يوم أم لكل شهر. بدونها لا يمكن إصدار فواتير لهذا العقد.');
      return;
    }
    
    try {
      // Use the first residenceId for legacy compatibility, store all in residenceIds
      const primaryResidenceId = formData.residenceIds.includes('all') 
        ? 'all' 
        : formData.residenceIds[0];
      
      if (editingContract) {
        await saveContract({
          ...editingContract,
          companyId: formData.companyId,
          residenceId: primaryResidenceId,
          residenceIds: formData.residenceIds,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: new Date(formData.endDate).toISOString(),
          ratePerPersonPerMonth: formData.ratePerPersonPerMonth,
          rateUnit: formData.rateUnit,
          expectedWorkers: formData.expectedWorkers,
          status: formData.status,
          notes: formData.notes,
        });
      } else {
        await saveContract({
          companyId: formData.companyId,
          residenceId: primaryResidenceId,
          residenceIds: formData.residenceIds,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: new Date(formData.endDate).toISOString(),
          ratePerPersonPerMonth: formData.ratePerPersonPerMonth,
          rateUnit: formData.rateUnit,
          expectedWorkers: formData.expectedWorkers,
          status: formData.status,
          notes: formData.notes,
          createdAt: new Date().toISOString(),
        });
      }
      setDialogOpen(false);
      setEditingContract(null);
    } catch (error) {
      console.error('Failed to save contract:', error);
    }
  };

  const handleDelete = async (contractId: string) => {
    if (!confirm('Are you sure you want to delete this contract?')) return;
    try {
      await deleteContract(contractId);
    } catch (error) {
      console.error('Failed to delete contract:', error);
    }
  };

  // Helper to get all residence IDs for a contract
  const getContractResidenceIds = (contract: Contract): string[] => {
    if (contract.residenceIds && contract.residenceIds.length > 0) {
      if (contract.residenceIds.includes('all')) {
        return residences.map(r => r.id);
      }
      return contract.residenceIds;
    }
    if (contract.residenceId) {
      return [contract.residenceId];
    }
    return [];
  };

  // Get display text for residences
  const getResidencesDisplay = (contract: Contract) => {
    if (contract.residenceIds?.includes('all')) {
      return { text: 'جميع السكنات', badge: 'All', count: residences.length };
    }
    const ids = getContractResidenceIds(contract);
    if (ids.length === 0) {
      return { text: null, badge: null, count: 0 };
    }
    if (ids.length === 1) {
      const residence = residences.find(r => r.id === ids[0]);
      return { text: residence?.name || ids[0], badge: null, count: 1 };
    }
    const names = ids.map(id => residences.find(r => r.id === id)?.name || id);
    return { text: names.slice(0, 2).join(', '), badge: `+${ids.length - 2}`, count: ids.length };
  };

  const getActualWorkers = (contract: Contract) => {
    const residenceIds = getContractResidenceIds(contract);
    if (residenceIds.length === 0) return 0;
    
    // Count unique workers across all residences in this contract
    // Note: This shows ALL workers in the residence, not filtered by company
    // The invoice generation will filter by company when billing
    const workerIds = new Set<string>();
    
    for (const residenceId of residenceIds) {
      occupants.forEach(occ => {
        if (occ.residenceId !== residenceId) return;
        if (occ.until) return; // Exclude checked-out occupants
        
        workerIds.add(occ.workerId);
      });
    }
    
    return workerIds.size;
  };

  const getStatusBadge = (status: Contract['status']) => {
    const variants: Record<Contract['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
      Active: 'default',
      Expired: 'secondary',
      Cancelled: 'destructive',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contracts</h1>
          <p className="text-muted-foreground mt-2">Manage accommodation contracts with sister companies</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              New Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingContract ? 'Edit Contract' : 'Create New Contract'}</DialogTitle>
                <DialogDescription>
                  {editingContract ? 'Update contract details' : 'Set up a new accommodation contract'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="companyId">Company *</Label>
                  <Select
                    value={formData.companyId}
                    onValueChange={(value) => setFormData({ ...formData, companyId: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map(company => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Multi-select Residences - Using simple divs instead of Checkbox to avoid Radix conflicts */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Residences / السكنات *
                  </Label>
                  <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                    {/* All Residences option */}
                    <button
                      type="button"
                      className={`w-full flex items-center gap-3 p-2 rounded cursor-pointer transition-colors text-left ${
                        isAllResidences 
                          ? 'bg-primary/10 border border-primary' 
                          : 'hover:bg-muted border border-transparent'
                      }`}
                      onClick={() => toggleResidence('all')}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isAllResidences ? 'bg-primary border-primary' : 'border-input'}`}>
                        {isAllResidences && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">جميع السكنات / All Residences</span>
                        <p className="text-xs text-muted-foreground">
                          العقد يشمل جميع السكنات ({filteredResidences.length})
                        </p>
                      </div>
                    </button>
                    
                    <div className="border-t my-2" />
                    
                    {/* Individual residences */}
                    {filteredResidences.map(residence => {
                      const isSelected = formData.residenceIds.includes('all') || formData.residenceIds.includes(residence.id);
                      return (
                      <button
                        type="button"
                        key={residence.id}
                        className={`w-full flex items-center gap-3 p-2 rounded cursor-pointer transition-colors text-left ${
                          isSelected
                            ? 'bg-primary/10 border border-primary' 
                            : 'hover:bg-muted border border-transparent'
                        } ${isAllResidences ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => !isAllResidences && toggleResidence(residence.id)}
                        disabled={isAllResidences}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-input'}`}>
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1">
                          <span className="font-medium">{residence.name}</span>
                          {residence.city && (
                            <p className="text-xs text-muted-foreground">{residence.city}</p>
                          )}
                        </div>
                      </button>
                    )})}
                  </div>
                  {formData.residenceIds.length > 0 && !isAllResidences && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {formData.residenceIds.length} residence(s)
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ratePerPersonPerMonth">
                      أجرة الفرد (ر.س) <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="ratePerPersonPerMonth"
                        type="number"
                        step="0.01"
                        value={formData.ratePerPersonPerMonth}
                        onChange={(e) => setFormData({ ...formData, ratePerPersonPerMonth: parseFloat(e.target.value) })}
                        required
                        className="flex-1"
                      />
                      {/* الوحدة تُختار صراحةً. كان الحقل معنوناً «Rate per
                          Person/Month» بينما الاتفاق يومي، فأُدخلت أرقام يومية
                          وأخرى شهرية في نفس الخانة ولا شيء يميّزها. */}
                      <Select
                        value={formData.rateUnit}
                        onValueChange={(value: 'daily' | 'monthly') => setFormData({ ...formData, rateUnit: value })}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">لكل يوم</SelectItem>
                          <SelectItem value="monthly">لكل شهر</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formData.rateUnit === 'daily'
                        ? `يُفوتَر ${(formData.ratePerPersonPerMonth || 0).toFixed(2)} ر.س عن كل يوم إشغال لكل فرد.`
                        : `${(formData.ratePerPersonPerMonth || 0).toFixed(2)} ر.س شهرياً = ${((formData.ratePerPersonPerMonth || 0) / 30).toFixed(2)} ر.س لكل يوم إشغال.`}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expectedWorkers">Expected Workers</Label>
                    <Input
                      id="expectedWorkers"
                      type="number"
                      value={formData.expectedWorkers}
                      onChange={(e) => setFormData({ ...formData, expectedWorkers: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as Contract['status'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes or terms..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingContract ? 'Update Contract' : 'Create Contract'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search contracts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Expired">Expired</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {criticalContracts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {criticalContracts.length} عقد لا تُصدر له فواتير حالياً
            </CardTitle>
            <CardDescription>
              الحقل كان معنوناً «Rate per Person/Month» بينما الاتفاقات بالأجرة اليومية،
              فاختلطت الوحدتان في خانة واحدة. حدّد وحدة كل عقد أدناه — لا شيء يُحفظ
              إلا بضغطك، ولن تُصدر فاتورة قبل ذلك.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalContracts.map(contract => {
              const company = companies.find(c => c.id === contract.companyId);
              const flags = (contractFlags[contract.id] || []).filter(f => f.severity === 'critical');
              const unitFlag = flags.find(f => f.kind === 'unresolved_rate_unit');
              return (
                <div key={contract.id} className="text-sm border-s-2 border-destructive ps-3">
                  <div className="font-medium">
                    {company?.name || contract.companyId}
                    <span className="text-muted-foreground font-normal text-xs">
                      {' '}· {new Date(contract.startDate).toLocaleDateString()} — {new Date(contract.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  {flags.map((flag, i) => (
                    <div key={i} className="text-xs text-muted-foreground mt-0.5" dir="rtl">
                      {flag.messageAr}
                    </div>
                  ))}
                  {unitFlag && (
                    <div className="flex flex-wrap items-center gap-2 mt-2" dir="rtl">
                      <span className="text-xs text-muted-foreground">
                        {contract.ratePerPersonPerMonth} ر.س هي:
                      </span>
                      <Button
                        size="sm"
                        variant={unitFlag.suggested === 'daily' ? 'default' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() => setRateUnit(contract, 'daily')}
                      >
                        أجرة يومية ← {unitFlag.ifDaily}
                        {unitFlag.suggested === 'daily' ? ' (المرجّح)' : ''}
                      </Button>
                      <Button
                        size="sm"
                        variant={unitFlag.suggested === 'monthly' ? 'default' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() => setRateUnit(contract, 'monthly')}
                      >
                        أجرة شهرية ← {unitFlag.ifMonthly}
                        {unitFlag.suggested === 'monthly' ? ' (المرجّح)' : ''}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Contracts ({filteredContracts.length})</CardTitle>
          <CardDescription>Active and historical contracts</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredContracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No contracts found</p>
              <Button onClick={() => handleOpenDialog()} className="mt-4" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create your first contract
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Residence</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">الأجرة</TableHead>
                    <TableHead className="text-center">Workers</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => {
                    const company = companies.find(c => c.id === contract.companyId);
                    const residencesDisplay = getResidencesDisplay(contract);
                    const actualWorkers = getActualWorkers(contract);
                    const invoices = getInvoicesByContract(contract.id);
                    // السعر هو ما يقرّر المبلغ المُصدَر، فيُعرض الخلل عند الرقم
                    // نفسه لا في تنبيه عام أعلى الصفحة.
                    const rateFlag = contractFlags[contract.id]?.find(
                      f => f.kind === 'unresolved_rate_unit' || f.kind === 'yearly_rate_in_monthly_field' || f.kind === 'zero_rate'
                    );

                    return (
                      <TableRow key={contract.id}>
                        <TableCell>
                          <div className="font-medium">{company?.name || contract.companyId}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {residencesDisplay.text ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span>{residencesDisplay.text}</span>
                                {residencesDisplay.badge && (
                                  <Badge variant="secondary" className="text-xs">
                                    {residencesDisplay.badge}
                                  </Badge>
                                )}
                                {residencesDisplay.count > 1 && (
                                  <span className="text-xs text-muted-foreground">
                                    ({residencesDisplay.count} سكن)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-destructive text-xs">⚠️ No Residence</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(contract.startDate).toLocaleDateString()} - {new Date(contract.endDate).toLocaleDateString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <div className="flex flex-col items-end gap-1">
                            <span className={rateFlag ? 'text-destructive' : undefined}>
                              {contract.ratePerPersonPerMonth.toFixed(2)} SAR
                              <span className="text-[11px] font-normal text-muted-foreground">
                                {contract.rateUnit === 'daily'
                                  ? ' / يوم'
                                  : contract.rateUnit === 'monthly'
                                    ? ' / شهر'
                                    : ''}
                              </span>
                            </span>
                            {rateFlag && (
                              <span
                                className="text-[11px] font-normal text-destructive flex items-center gap-1 text-right"
                                title={rateFlag.messageAr}
                              >
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span dir="rtl">الوحدة غير محدَّدة</span>
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="text-sm">
                            <span className="font-medium">{actualWorkers}</span>
                            {contract.expectedWorkers ? (
                              <span className="text-muted-foreground"> / {contract.expectedWorkers}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(contract.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDialog(contract)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(contract.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contracts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {contracts.filter(c => c.status === 'Active').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Expired Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {contracts.filter(c => c.status === 'Expired').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {contracts
                .filter(c => c.status === 'Active')
                .reduce((sum, c) => {
                  const workers = getActualWorkers(c);
                  return sum + (workers * c.ratePerPersonPerMonth);
                }, 0)
                .toFixed(2)} SAR
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
