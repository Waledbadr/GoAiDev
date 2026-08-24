'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Building2,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Trash2,
  Check,
  Home,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useContracts } from '@/context/contracts-context';
import { type Contract, getContractTypeInfo } from '@/types/contracts';

interface ResidenceOption {
  id: string;
  name: string;
  city?: string;
  address?: string;
  code?: string;
}

interface EditLinkedResidencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract | null;
  residences: ResidenceOption[];
  isAr?: boolean;
}

export function EditLinkedResidencesDialog({
  open,
  onOpenChange,
  contract,
  residences,
  isAr = true,
}: EditLinkedResidencesDialogProps) {
  const { updateContract } = useContracts();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Initialize selected IDs when contract changes or dialog opens
  useEffect(() => {
    if (contract && open) {
      setSelectedIds(contract.linkedResidences || []);
      setSearchQuery('');
    }
  }, [contract, open]);

  // Find legacy / unregistered residence identifiers currently in the contract
  const unregisteredIds = useMemo(() => {
    if (!contract || !contract.linkedResidences) return [];
    return contract.linkedResidences.filter(
      (id) => !residences.some((r) => r.id === id)
    );
  }, [contract, residences]);

  // Filter registered residences by search query
  const filteredResidences = useMemo(() => {
    if (!searchQuery.trim()) return residences;
    const q = searchQuery.toLowerCase();
    return residences.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.city && r.city.toLowerCase().includes(q)) ||
        (r.code && r.code.toLowerCase().includes(q))
    );
  }, [residences, searchQuery]);

  // Toggle residence selection
  const toggleResidence = (residenceId: string) => {
    setSelectedIds((prev) =>
      prev.includes(residenceId)
        ? prev.filter((id) => id !== residenceId)
        : [...prev, residenceId]
    );
  };

  // Select all registered residences
  const handleSelectAll = () => {
    const allValidIds = residences.map((r) => r.id);
    setSelectedIds(allValidIds);
  };

  // Deselect all
  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  // Clean up all unregistered / legacy IDs from selection
  const handleCleanLegacyIds = () => {
    setSelectedIds((prev) =>
      prev.filter((id) => residences.some((r) => r.id === id))
    );
  };

  // Save changes
  const handleSave = async () => {
    if (!contract) return;
    try {
      setIsSaving(true);
      const names = selectedIds.map(
        (id) => residences.find((r) => r.id === id)?.name || id
      );

      await updateContract(contract.id, {
        linkedResidences: selectedIds,
        linkedResidenceNames: names,
      });

      onOpenChange(false);
    } catch (err) {
      console.error('Failed to update contract residences:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!contract) return null;

  const info = getContractTypeInfo(contract.contractType);
  const hasUnregistered = unregisteredIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-indigo-200 dark:border-indigo-900 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 border-b border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 font-medium">
                  {isAr ? 'تعديل السكنات والعقارات المرتبطة' : 'Edit Linked Residences'}
                </Badge>
                {contract.contractNumber && (
                  <span className="text-xs font-mono text-amber-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {contract.contractNumber}
                  </span>
                )}
              </div>
              <DialogTitle className="text-xl font-bold mt-1 text-white flex items-center gap-2">
                <Home className="w-5 h-5 text-indigo-400" />
                {contract.partyName}
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-xs mt-0.5">
                {contract.title || (isAr ? info.labelAr : info.labelEn)}
              </DialogDescription>
            </div>

            <div className="text-left rtl:text-right bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 block">
                {isAr ? 'عدد السكنات المحددة:' : 'Selected Residences:'}
              </span>
              <span className="text-base font-bold text-indigo-300">
                {selectedIds.length} {isAr ? 'سكن' : 'residences'}
              </span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-background">
          {/* Legacy / Unregistered IDs Alert */}
          {hasUnregistered && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <span>
                    {isAr
                      ? `تم العثور على (${unregisteredIds.length}) اسم/معرّف سكن غير مسجل في النظام!`
                      : `Found (${unregisteredIds.length}) unregistered residence name(s)!`}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCleanLegacyIds}
                  className="text-xs h-7 gap-1 bg-amber-100 dark:bg-amber-950/50 hover:bg-amber-200 text-amber-900 dark:text-amber-200 border-amber-300 font-semibold shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-amber-700" />
                  {isAr ? 'إزالة الأسماء غير المسجلة' : 'Remove Unregistered'}
                </Button>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                {isAr
                  ? 'هذه الأسماء أُضيفت أثناء القراءة السابقة أو الاستيراد ولم تعد مطابقة لأي سكن مسجل حالياً. يمكنك إزالتها وتحديد السكنات الصحيحة من القائمة أدناه:'
                  : 'These names were added during previous reading/import and do not match registered residences. Select the correct residences below:'}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {unregisteredIds.map((badId) => (
                  <Badge
                    key={badId}
                    variant="outline"
                    className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 text-xs py-0.5 px-2 flex items-center gap-1"
                  >
                    <span>⚠️ {badId}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIds((prev) => prev.filter((id) => id !== badId))
                      }
                      className="hover:text-rose-900 dark:hover:text-white"
                      title={isAr ? 'إزالة' : 'Remove'}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Currently Selected Residences Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {isAr ? 'السكنات المختارة حالياً لهذا العقد:' : 'Currently Selected Residences:'}
              </Label>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold"
                >
                  {isAr ? 'إلغاء تحديد الكل' : 'Clear All'}
                </button>
              )}
            </div>

            {selectedIds.length === 0 ? (
              <div className="p-3 bg-muted/40 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                {isAr
                  ? 'لم يتم تحديد أي سكن بعد. اختر السكن الصحيح من القائمة أدناه.'
                  : 'No residence selected. Pick from the list below.'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 p-3 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40 max-h-28 overflow-y-auto">
                {selectedIds.map((id) => {
                  const res = residences.find((r) => r.id === id);
                  const isRegistered = !!res;
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className={`text-xs py-1 px-2.5 gap-1.5 ${
                        isRegistered
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-emerald-300 dark:border-emerald-700 shadow-xs'
                          : 'bg-rose-50 text-rose-700 border-rose-300'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-semibold">{res?.name || id}</span>
                      {res?.city && (
                        <span className="text-[10px] text-muted-foreground">
                          ({res.city})
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleResidence(id)}
                        className="text-gray-400 hover:text-rose-600 transition-colors p-0.5 rounded-full"
                        title={isAr ? 'إلغاء الاختيار' : 'Remove'}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search & Selection of Registered Residences */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <Label className="text-sm font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Building2 className="h-4 w-4 text-indigo-600" />
                {isAr
                  ? `قائمة السكنات المعتمدة والمسجلة في النظام (${residences.length}):`
                  : `Available Registered Residences (${residences.length}):`}
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAll}
                  className="text-xs h-7 bg-background hover:bg-muted font-medium"
                >
                  <Check className="w-3.5 h-3.5 mr-1 ml-1 text-emerald-600" />
                  {isAr ? 'تحديد كل السكنات' : 'Select All'}
                </Button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 h-4 w-4 text-muted-foreground`} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr
                    ? 'بحث باسم السكن أو المدينة أو الرمز...'
                    : 'Search residence by name, city, code...'
                }
                className={`${isAr ? 'pr-9' : 'pl-9'} bg-background text-xs h-9 rounded-xl`}
              />
            </div>

            {/* Residences List Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1 border rounded-xl bg-muted/10">
              {filteredResidences.length === 0 ? (
                <div className="col-span-full text-center p-6 text-muted-foreground text-xs">
                  {isAr ? 'لا يوجد سكن مطابق للبحث' : 'No matching residences found'}
                </div>
              ) : (
                filteredResidences.map((res) => {
                  const isChecked = selectedIds.includes(res.id);
                  return (
                    <label
                      key={res.id}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        isChecked
                          ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500/20'
                          : 'border-border bg-card hover:bg-muted/50 hover:border-gray-300 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleResidence(res.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{res.name}</p>
                        {res.city && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            📍 {res.city}
                          </p>
                        )}
                        {res.code && (
                          <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.2 rounded mt-1 inline-block">
                            {res.code}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-muted/30 border-t flex items-center justify-between sm:justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {isAr
              ? `سيتم حفظ ${selectedIds.length} سكن لهذا العقد.`
              : `${selectedIds.length} residence(s) will be linked.`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl gap-2 shadow-sm"
            >
              {isSaving ? (
                <span>{isAr ? 'جارٍ الحفظ...' : 'Saving...'}</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isAr ? 'حفظ وتحديث السكنات' : 'Save Residences'}</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
