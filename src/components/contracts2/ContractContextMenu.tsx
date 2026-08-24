'use client';

import React, { useEffect, useRef } from 'react';
import {
  RefreshCw,
  Receipt,
  Printer,
  Building2,
  Paperclip,
  PlayCircle,
  PauseCircle,
  Edit,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { type Contract } from '@/types/contracts';

interface ContractContextMenuProps {
  contract: Contract | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onQuickRenew: (contract: Contract) => void;
  onIssueInvoice: (contract: Contract) => void;
  onPrint: (contract: Contract) => void;
  onEditResidences: (contract: Contract) => void;
  onEdit: (contract: Contract) => void;
  onToggleSuspend: (contract: Contract) => void;
  onArchive: (contract: Contract) => void;
  isAr?: boolean;
}

export function ContractContextMenu({
  contract,
  position,
  onClose,
  onQuickRenew,
  onIssueInvoice,
  onPrint,
  onEditResidences,
  onEdit,
  onToggleSuspend,
  onArchive,
  isAr = true,
}: ContractContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!position || !contract) return null;

  // Ensure menu stays within window bounds
  const x = Math.min(position.x, window.innerWidth - 240);
  const y = Math.min(position.y, window.innerHeight - 340);

  return (
    <div
      ref={menuRef}
      style={{ top: `${y}px`, left: `${x}px` }}
      className="fixed z-50 w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 text-xs text-start animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100 dark:divide-slate-800"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Header Info */}
      <div className="px-3 py-2">
        <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{contract.partyName}</p>
        <span className="text-[10px] text-slate-400 font-mono">
          {contract.contractNumber || `CNT-${contract.id.slice(0, 6).toUpperCase()}`}
        </span>
      </div>

      {/* Main Actions Group */}
      <div className="py-1">
        <button
          type="button"
          onClick={() => {
            onQuickRenew(contract);
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 transition-colors font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isAr ? 'تجديد فوري ⚡' : 'Quick Renew ⚡'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onIssueInvoice(contract);
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 flex items-center gap-2 transition-colors font-medium"
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>{isAr ? 'إصدار فاتورة الشهر 📄' : 'Issue Monthly Invoice 📄'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onPrint(contract);
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center gap-2 transition-colors font-medium"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{isAr ? 'طباعة السند الرسمي 🖨️' : 'Print Agreement 🖨️'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onEditResidences(contract);
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors font-medium"
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>{isAr ? 'تعيين وربط السكنات 📍' : 'Edit Linked Camps 📍'}</span>
        </button>
      </div>

      {/* Management Group */}
      <div className="py-1">
        <button
          type="button"
          onClick={() => {
            onEdit(contract);
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors"
        >
          <Edit className="w-3.5 h-3.5 text-slate-500" />
          <span>{isAr ? 'تعديل بيانات العقد' : 'Edit Details'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onToggleSuspend(contract);
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors"
        >
          {contract.status === 'Suspended' ? (
            <>
              <PlayCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>{isAr ? 'تفعيل العقد' : 'Activate Contract'}</span>
            </>
          ) : (
            <>
              <PauseCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>{isAr ? 'إيقاف مؤقت' : 'Suspend Contract'}</span>
            </>
          )}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            onArchive(contract);
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 flex items-center gap-2 transition-colors font-medium"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{isAr ? 'أرشفة العقد' : 'Archive Contract'}</span>
        </button>
      </div>
    </div>
  );
}
