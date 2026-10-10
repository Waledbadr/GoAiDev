'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[EstateCare Global Error]:', error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="max-w-md w-full bg-white border border-slate-200 shadow-xl rounded-2xl p-6 sm:p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 ring-8 ring-red-50">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              حدث خطأ في النظام
            </h2>
            <p className="text-sm font-medium text-slate-500">
              System Error
            </p>
            <p className="text-xs text-slate-500 pt-1 leading-relaxed">
              {error?.message || 'نعتذر عن حدوث هذا الخطأ غير المتوقع، اضغط على الزر أدناه لإعادة تحميل التطبيق.'}
            </p>
          </div>

          <button
            onClick={() => reset()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة تحميل التطبيق / Reload App
          </button>
        </div>
      </body>
    </html>
  );
}
