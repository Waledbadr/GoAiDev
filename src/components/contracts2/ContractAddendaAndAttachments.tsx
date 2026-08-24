'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Paperclip,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Upload,
  Layers,
  Wrench,
  DollarSign,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import {
  type Contract,
  type ContractGuarantee,
  type ContractService,
  formatSAR,
  getContractTypeInfo,
} from '@/types/contracts';
import { useContracts } from '@/context/contracts-context';
import { useToast } from '@/hooks/use-toast';

interface ContractAddendaAndAttachmentsProps {
  contract: Contract;
  isAr?: boolean;
}

export function ContractAddendaAndAttachments({
  contract,
  isAr = true,
}: ContractAddendaAndAttachmentsProps) {
  const { contracts, updateContract, createContract } = useContracts();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'attachments' | 'addenda' | 'guarantees' | 'services'>('attachments');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);

  // Addenda linked to this contract (or having parentContractId === contract.id)
  const linkedAddenda = contracts.filter(
    (c) =>
      !c.archivedAt &&
      (c.parentContractId === contract.id ||
        (c.partyName === contract.partyName && c.contractRelationType === 'addendum' && c.id !== contract.id))
  );

  // Existing attachments
  const attachmentsList: Array<{ url: string; name: string }> = [];
  if (contract.attachments && Array.isArray(contract.attachments)) {
    contract.attachments.forEach((att, idx) => {
      if (typeof att === 'string') {
        attachmentsList.push({
          url: att,
          name: (contract as any).attachmentName || att.split('/').pop() || `Attachment ${idx + 1}`,
        });
      }
    });
  }
  if ((contract as any).attachmentUrl && !attachmentsList.some((a) => a.url === (contract as any).attachmentUrl)) {
    attachmentsList.push({
      url: (contract as any).attachmentUrl,
      name: (contract as any).attachmentName || (contract as any).attachmentUrl.split('/').pop() || 'Contract PDF',
    });
  }

  // Handle Add Attachment
  const handleSaveAttachment = async () => {
    if (!newAttachmentUrl.trim()) return;
    try {
      const existing = contract.attachments || [];
      const updated = [...existing, newAttachmentUrl.trim()];
      await updateContract(contract.id, {
        attachments: updated,
        attachmentUrl: newAttachmentUrl.trim(),
        attachmentName: newAttachmentName.trim() || newAttachmentUrl.split('/').pop() || 'Contract Document',
      } as any);

      setNewAttachmentUrl('');
      setNewAttachmentName('');
      setIsAddingAttachment(false);
      toast({
        title: isAr ? 'تمت إضافة المرفق بنجاح 📎' : 'Attachment Added Successfully 📎',
      });
    } catch (err: any) {
      toast({
        title: isAr ? 'خطأ' : 'Error',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Handle Remove Attachment
  const handleRemoveAttachment = async (urlToRemove: string) => {
    try {
      const existing = contract.attachments || [];
      const updated = existing.filter((u) => u !== urlToRemove);
      await updateContract(contract.id, {
        attachments: updated,
        attachmentUrl: updated.length > 0 ? updated[0] : null,
      } as any);
      toast({
        title: isAr ? 'تم حذف المرفق' : 'Attachment Removed',
      });
    } catch (err: any) {
      toast({
        title: isAr ? 'خطأ' : 'Error',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      {/* Sub Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('attachments')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'attachments'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>{isAr ? `المرفقات والمستندات (${attachmentsList.length})` : `Attachments (${attachmentsList.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('addenda')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'addenda'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isAr ? `ملاحق العقد (${linkedAddenda.length})` : `Addenda (${linkedAddenda.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guarantees')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'guarantees'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isAr ? `الضمانات المالية (${contract.guarantees?.length || 0})` : `Guarantees (${contract.guarantees?.length || 0})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'services'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>{isAr ? `بنود الخدمات (${contract.services?.length || 0})` : `Services (${contract.services?.length || 0})`}</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ATTACHMENTS & SCANNED PDFS */}
      {activeTab === 'attachments' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isAr ? 'المستندات والعقود الممسوحة ضوئياً (PDF / الصور):' : 'Scanned PDF Attachments & Documents:'}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddingAttachment(!isAddingAttachment)}
              className="text-xs h-7 gap-1 text-indigo-600 hover:bg-indigo-50 border-indigo-200"
            >
              <Plus className="w-3 h-3" />
              {isAr ? 'إضافة مرفق' : 'Add Attachment'}
            </Button>
          </div>

          {isAddingAttachment && (
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-900/50 space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] mb-1 block">{isAr ? 'اسم المستند / الوصف' : 'Document Name'}</Label>
                  <Input
                    value={newAttachmentName}
                    onChange={(e) => setNewAttachmentName(e.target.value)}
                    placeholder={isAr ? 'عقد الإيجار الموقع 2026' : 'Signed Contract 2026'}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] mb-1 block">{isAr ? 'رابط الملف (URL أو مسار الملف)' : 'File URL / Path'}</Label>
                  <Input
                    value={newAttachmentUrl}
                    onChange={(e) => setNewAttachmentUrl(e.target.value)}
                    placeholder="/contracts/contract-doc.pdf"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setIsAddingAttachment(false)} className="text-xs h-7">
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button size="sm" onClick={handleSaveAttachment} className="bg-indigo-600 text-white text-xs h-7">
                  {isAr ? 'حفظ المرفق' : 'Save'}
                </Button>
              </div>
            </div>
          )}

          {attachmentsList.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-400">
              <Paperclip className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
              <p>{isAr ? 'لا توجد مستندات مرفقة بهذا العقد حتى الآن' : 'No attachments linked yet'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {attachmentsList.map((att, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-2 bg-red-50 text-red-600 rounded-lg shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">
                        {att.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono truncate block">
                        {att.url}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title={isAr ? 'فتح المستند' : 'Open Document'}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.url)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title={isAr ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONTRACT ADDENDA */}
      {activeTab === 'addenda' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isAr ? 'الملاحق والاتفاقيات التكميلية الملحقة بهذا العقد:' : 'Linked Contract Addenda & Amendments:'}
            </span>
          </div>

          {linkedAddenda.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-400">
              <Layers className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
              <p>{isAr ? 'لا توجد ملاحق مسجلة لهذا العقد (عقد أساسي مستقل)' : 'No addenda attached to this contract'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedAddenda.map((addendum) => (
                <div
                  key={addendum.id}
                  className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-purple-200 dark:border-purple-900/40 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px]">
                        📑 {isAr ? 'ملحق عقد' : 'Addendum'}
                      </Badge>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {addendum.contractNumber || `ADD-${addendum.id.slice(0, 6).toUpperCase()}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {isAr ? 'ساري من: ' : 'From: '} {addendum.startDate} {isAr ? ' إلى: ' : ' To: '} {addendum.endDate}
                    </p>
                  </div>

                  <div className="text-end">
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block">
                      {formatSAR(addendum.billingRate)} SAR
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GUARANTEES */}
      {activeTab === 'guarantees' && (
        <div className="space-y-3">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            {isAr ? 'الضمانات المالية والشيكات والتأمينات:' : 'Financial Guarantees & Security Deposits:'}
          </span>

          {(!contract.guarantees || contract.guarantees.length === 0) ? (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-400">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
              <p>{isAr ? 'لا توجد ضمانات مالية أو تأمينات مسجلة' : 'No financial guarantees recorded'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {contract.guarantees.map((g, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">
                      {g.type === 'security_deposit' ? 'تأمين نقدي' : g.type === 'check' ? 'شيك ضمان' : 'خطاب ضمان بنكي'}
                    </Badge>
                    <span className="font-mono font-bold text-emerald-600">
                      {formatSAR(g.amount)} SAR
                    </span>
                  </div>
                  {g.bankName && <p className="text-[11px] text-slate-500">البنك: {g.bankName}</p>}
                  {g.referenceNumber && <p className="text-[11px] text-slate-400 font-mono">رقم المرجع: {g.referenceNumber}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SERVICES */}
      {activeTab === 'services' && (
        <div className="space-y-3">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            {isAr ? 'بنود الخدمات والصيانة المشمولة بالعقد:' : 'Included Contract Services:'}
          </span>

          {(!contract.services || contract.services.length === 0) ? (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-400">
              <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
              <p>{isAr ? 'لا توجد بنود خدمات تفصيلية مخصصة' : 'No custom service line items'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contract.services.map((s, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">{s.name}</span>
                    {s.description && <p className="text-[11px] text-slate-400">{s.description}</p>}
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {formatSAR(s.rate)} SAR
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
