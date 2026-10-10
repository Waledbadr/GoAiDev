'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[EstateCare Error Boundary]:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border/80 shadow-lg rounded-2xl p-6 sm:p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 ring-8 ring-red-50 dark:ring-red-900/20">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            حدث خطأ غير متوقع
          </h2>
          <p className="text-sm font-medium text-muted-foreground">
            An unexpected error occurred
          </p>
          <p className="text-xs text-muted-foreground/80 pt-1 leading-relaxed">
            {error?.message || 'نعتذر عن هذا الخطأ، يرجى إعادة المحاولة أو العودة للرئيسية.'}
          </p>
        </div>

        {error?.digest && (
          <p className="text-[11px] font-mono text-muted-foreground/60 bg-muted/50 py-1 px-2 rounded">
            Digest: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={() => reset()}
            className="flex-1 gap-2"
            variant="default"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة / Try Again
          </Button>

          <Button asChild variant="outline" className="flex-1 gap-2">
            <Link href="/">
              <Home className="w-4 h-4" />
              الرئيسية / Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
