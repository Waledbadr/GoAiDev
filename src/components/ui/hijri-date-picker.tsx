'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar, Repeat } from 'lucide-react';
import {
  getHijriFromGregorian,
  hijriToGregorianISO,
  HIJRI_MONTHS_AR,
} from '@/lib/hijri-date-utils';

interface UnifiedDatePickerProps {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (isoDate: string) => void;
  calendarSystem?: 'gregorian' | 'hijri';
  onCalendarSystemChange?: (sys: 'gregorian' | 'hijri') => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function UnifiedDatePicker({
  label,
  value,
  onChange,
  calendarSystem = 'gregorian',
  onCalendarSystemChange,
  disabled = false,
  required = false,
  className = '',
}: UnifiedDatePickerProps) {
  const [activeMode, setActiveMode] = useState<'gregorian' | 'hijri'>(calendarSystem);

  useEffect(() => {
    setActiveMode(calendarSystem);
  }, [calendarSystem]);

  // Derived Hijri values from current Gregorian ISO value
  const hijriInfo = getHijriFromGregorian(value);

  // Local Hijri state for manual editing in Hijri mode
  const [hDay, setHDay] = useState<number>(hijriInfo?.day || 1);
  const [hMonth, setHMonth] = useState<number>(hijriInfo?.month || 1);
  const [hYear, setHYear] = useState<number>(hijriInfo?.year || 1448);

  // Synchronize local Hijri state when value or activeMode changes
  useEffect(() => {
    if (hijriInfo) {
      setHDay(hijriInfo.day);
      setHMonth(hijriInfo.month);
      setHYear(hijriInfo.year);
    }
  }, [value]);

  const handleModeToggle = (newMode: 'gregorian' | 'hijri') => {
    setActiveMode(newMode);
    if (onCalendarSystemChange) {
      onCalendarSystemChange(newMode);
    }
  };

  // Handle Hijri inputs change
  const handleHijriChange = (day: number, month: number, year: number) => {
    setHDay(day);
    setHMonth(month);
    setHYear(year);
    const convertedGregorian = hijriToGregorianISO(year, month, day);
    onChange(convertedGregorian);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        {label && (
          <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-600" />
            {label}
            {required && <span className="text-red-500 mr-0.5">*</span>}
          </Label>
        )}

        {/* Toggle Mode Button */}
        <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => handleModeToggle('gregorian')}
            disabled={disabled}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              activeMode === 'gregorian'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ميلادي
          </button>
          <button
            type="button"
            onClick={() => handleModeToggle('hijri')}
            disabled={disabled}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              activeMode === 'hijri'
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            هجري
          </button>
        </div>
      </div>

      {activeMode === 'gregorian' ? (
        <div className="space-y-1.5">
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={required}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors shadow-sm disabled:bg-slate-50 disabled:opacity-60"
          />
          {hijriInfo && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50/70 border border-emerald-200/60 rounded-md px-2.5 py-1">
              <Repeat className="w-3.5 h-3.5 text-emerald-600" />
              <span>الموافق بالهجري:</span>
              <span className="font-bold">{hijriInfo.formattedAr}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            {/* Day */}
            <div>
              <span className="block text-[10px] text-slate-500 mb-0.5 font-medium">اليوم</span>
              <select
                value={hDay}
                onChange={(e) => handleHijriChange(Number(e.target.value), hMonth, hYear)}
                disabled={disabled}
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 transition-colors shadow-sm"
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Month */}
            <div>
              <span className="block text-[10px] text-slate-500 mb-0.5 font-medium">الشهر الهجري</span>
              <select
                value={hMonth}
                onChange={(e) => handleHijriChange(hDay, Number(e.target.value), hYear)}
                disabled={disabled}
                className="w-full px-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 transition-colors shadow-sm"
              >
                {HIJRI_MONTHS_AR.map((mName, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {mName} ({idx + 1})
                  </option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div>
              <span className="block text-[10px] text-slate-500 mb-0.5 font-medium">السنة الهجرية</span>
              <select
                value={hYear}
                onChange={(e) => handleHijriChange(hDay, hMonth, Number(e.target.value))}
                disabled={disabled}
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 transition-colors shadow-sm"
              >
                {Array.from({ length: 30 }, (_, i) => 1435 + i).map((y) => (
                  <option key={y} value={y}>
                    {y} هـ
                  </option>
                ))}
              </select>
            </div>
          </div>

          {value && (
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium bg-slate-100 border border-slate-200 rounded-md px-2.5 py-1">
              <Repeat className="w-3.5 h-3.5 text-slate-500" />
              <span>الموافق بالميلادي:</span>
              <span className="font-bold dir-ltr">{value}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
