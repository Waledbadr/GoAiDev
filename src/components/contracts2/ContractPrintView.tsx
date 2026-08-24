'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Printer,
  Building2,
  FileText,
  User,
  X,
} from 'lucide-react';
import {
  type Contract,
  formatSAR,
  getContractTypeInfo,
  getBillingTypeLabel,
  getContractStatusLabel,
} from '@/types/contracts';
import { useLanguage } from '@/context/language-context';

interface ContractPrintViewProps {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContractPrintView({
  contract,
  open,
  onOpenChange,
}: ContractPrintViewProps) {
  const { locale } = useLanguage();
  const isAr = locale === 'ar';

  if (!contract) return null;

  const typeInfo = getContractTypeInfo(contract.contractType);
  const vatAmount = (contract.billingRate * (contract.vatPercentage ?? 15)) / 100;
  const totalWithVat = contract.billingRate + vatAmount;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white text-slate-900 border-none shadow-2xl rounded-2xl print:shadow-none print:m-0 print:p-0 print:max-w-full">
        {/* Top Floating Print Controls (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-sm">
              {isAr ? 'معاينة وطباعة ملخص العقد الرسمي' : 'Official Contract Agreement Slip Preview'}
            </span>
            <Badge variant="outline" className="text-amber-300 border-amber-400/40 text-xs">
              {contract.contractNumber || `CNT-${contract.id.slice(0, 6).toUpperCase()}`}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-2 text-xs"
            >
              <Printer className="w-4 h-4" />
              {isAr ? 'طباعة / تصدير PDF' : 'Print / Export PDF'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-white h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div
          id="printable-contract"
          className="p-8 sm:p-12 space-y-8 bg-white text-slate-900 print:p-6 print:text-black text-start"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {/* Header with Company Logo & Metadata */}
          <div className="border-b-2 border-slate-900 pb-6 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 bg-slate-900 text-amber-400 font-black rounded-lg flex items-center justify-center text-xl tracking-tighter">
                  CPC
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {isAr ? 'شركة سي بي سي القابضة' : 'CPC Holding Co.'}
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    {isAr ? 'إدارة المجمعات والتشغيل السكني' : 'Camp Operations & Facilities Management'}
                  </p>
                </div>
              </div>
            </div>

            <div className={`font-mono space-y-1 ${isAr ? 'text-left' : 'text-right'}`}>
              <div className="inline-block bg-slate-100 px-3 py-1 rounded-md border border-slate-300">
                <span className="text-xs text-slate-500 block">{isAr ? 'رقم العقد:' : 'Contract #:'}</span>
                <span className="text-sm font-bold text-slate-900">
                  {contract.contractNumber || `CNT-${contract.id.slice(0, 8).toUpperCase()}`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {isAr ? 'تاريخ الإصدار: ' : 'Issue Date: '}
                {contract.createdAt ? contract.createdAt.split('T')[0] : '---'}
              </p>
            </div>
          </div>

          {/* Title Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <h2 className="text-lg font-bold text-slate-900">
              {isAr ? `ملخص اتفاقية عقد: ${typeInfo.labelAr}` : `Contract Agreement Summary: ${typeInfo.labelEn}`}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {contract.title || `${typeInfo.labelEn} with ${contract.partyName}`}
            </p>
          </div>

          {/* Parties Grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* First Party (CPC) */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/50">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <Building2 className="w-4 h-4 text-slate-700" />
                <h3 className="font-bold text-xs text-slate-800">
                  {isAr ? 'الطرف الأول (المشغل / المالك):' : 'First Party (Operator / Owner):'}
                </h3>
              </div>
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-900">
                  {contract.firstPartyName || 'CPC Holding Co. (شركة سي بي سي القابضة)'}
                </p>
                <p className="text-slate-600">Kingdom of Saudi Arabia</p>
                <p className="text-slate-600">
                  {isAr ? 'الصفة: ' : 'Capacity: '}
                  {contract.contractCategory === 'revenue'
                    ? (isAr ? 'مؤجر / مقدم خدمة' : 'Landlord / Service Provider')
                    : (isAr ? 'مستأجر / مستفيد' : 'Tenant / Client')}
                </p>
                {contract.contractManager && (
                  <p className="text-slate-600">
                    {isAr ? 'مسؤول العقد: ' : 'Account Manager: '}
                    {contract.contractManager}
                  </p>
                )}
              </div>
            </div>

            {/* Second Party */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/50">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <User className="w-4 h-4 text-slate-700" />
                <h3 className="font-bold text-xs text-slate-800">
                  {isAr ? 'الطرف الثاني (العميل / المورد):' : 'Second Party (Client / Vendor):'}
                </h3>
              </div>
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-900">{contract.partyName}</p>
                <p className="text-slate-600">
                  {isAr ? 'النوع: ' : 'Entity Type: '}
                  {contract.partyType === 'company' ? 'Company' : contract.partyType === 'vendor' ? 'Vendor' : 'Individual'}
                </p>
                {contract.partyContact && (
                  <p className="text-slate-600">{isAr ? 'المسؤول: ' : 'Contact: '}{contract.partyContact}</p>
                )}
                {contract.partyPhone && (
                  <p className="text-slate-600 font-mono">{isAr ? 'الهاتف: ' : 'Phone: '}{contract.partyPhone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contract Duration & Properties */}
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-slate-200 rounded-xl p-3 bg-white">
              <span className="text-[11px] text-slate-500 block mb-1">{isAr ? 'تاريخ البدء' : 'Start Date'}</span>
              <span className="font-bold text-sm text-slate-900 font-mono">
                {contract.startDate || '---'}
              </span>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 bg-white">
              <span className="text-[11px] text-slate-500 block mb-1">{isAr ? 'تاريخ الانتهاء' : 'End Date'}</span>
              <span className="font-bold text-sm text-slate-900 font-mono">
                {contract.isOpenEnded ? (isAr ? 'عقد مفتوح' : 'Open Ended') : contract.endDate || '---'}
              </span>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 bg-white">
              <span className="text-[11px] text-slate-500 block mb-1">{isAr ? 'حالة العقد' : 'Status'}</span>
              <span className="font-bold text-sm text-slate-900">
                {getContractStatusLabel(contract.status, isAr)}
              </span>
            </div>
          </div>

          {/* Linked Residences / Assets */}
          {contract.linkedResidences && contract.linkedResidences.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/30">
              <h3 className="font-bold text-xs text-slate-800 mb-2">
                {isAr ? 'المواقع والسكنات المشمولة بالعقد:' : 'Covered Locations & Residences:'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {(contract.linkedResidenceNames || contract.linkedResidences).map((res, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-slate-300 text-slate-800"
                  >
                    📍 {res}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Financial Breakdown Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className={`w-full text-xs ${isAr ? 'text-right' : 'text-left'}`}>
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="p-3">{isAr ? 'البند المالي' : 'Financial Item'}</th>
                  <th className="p-3">{isAr ? 'طريقة واحتساب الفوترة' : 'Billing Method'}</th>
                  <th className="p-3">{isAr ? 'القيمة الأساسية (ر.س)' : 'Base Rate (SAR)'}</th>
                  <th className="p-3">{isAr ? 'ضريبة القيمة المضافة (15%)' : 'VAT (15%)'}</th>
                  <th className={`p-3 ${isAr ? 'text-left' : 'text-right'}`}>{isAr ? 'الإجمالي المستحق (ر.س)' : 'Total Due (SAR)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <tr>
                  <td className="p-3 font-semibold text-slate-900">
                    {isAr ? 'قيمة العقد / البدل التعاقدي' : 'Contract Value / Fee'}
                  </td>
                  <td className="p-3 text-slate-600">
                    {getBillingTypeLabel(contract.billingType, isAr)}
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-900">
                    {formatSAR(contract.billingRate)}
                  </td>
                  <td className="p-3 font-mono text-slate-600">
                    {formatSAR(vatAmount)}
                  </td>
                  <td className={`p-3 font-mono font-extrabold text-slate-900 text-sm ${isAr ? 'text-left' : 'text-right'}`}>
                    {formatSAR(totalWithVat)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Specific Accommodation Details */}
          {contract.accommodationDetails && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex justify-between">
              <span>
                <strong>{isAr ? 'العمالة المستهدفة: ' : 'Target Workers: '}</strong>
                {contract.accommodationDetails.targetWorkersCount || 'Actual'}
              </span>
              <span>
                <strong>{isAr ? 'سعر الفرد اليومي: ' : 'Daily Rate / Worker: '}</strong>
                {contract.accommodationDetails.dailyRatePerWorker || contract.billingRate} SAR
              </span>
              <span>
                <strong>{isAr ? 'الأسرة المحجوزة: ' : 'Reserved Beds: '}</strong>
                {contract.accommodationDetails.bedsCount || '---'}
              </span>
            </div>
          )}

          {/* Official Signatures Block */}
          <div className="grid grid-cols-2 gap-12 pt-8 border-t border-slate-300">
            <div className="text-center space-y-12">
              <div>
                <p className="font-bold text-xs text-slate-900">{isAr ? 'عن الطرف الأول:' : 'First Party:'}</p>
                <p className="text-[11px] text-slate-500">CPC Holding Co.</p>
              </div>
              <div className="border-b border-dashed border-slate-400 w-48 mx-auto"></div>
              <p className="text-[10px] text-slate-400">{isAr ? 'التوقيع والختم الرسمي' : 'Authorized Signature & Stamp'}</p>
            </div>

            <div className="text-center space-y-12">
              <div>
                <p className="font-bold text-xs text-slate-900">{isAr ? 'عن الطرف الثاني:' : 'Second Party:'}</p>
                <p className="text-[11px] text-slate-500">{contract.partyName}</p>
              </div>
              <div className="border-b border-dashed border-slate-400 w-48 mx-auto"></div>
              <p className="text-[10px] text-slate-400">{isAr ? 'التوقيع والختم الرسمي' : 'Authorized Signature & Stamp'}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
