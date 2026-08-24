'use client';

import React from 'react';
import { ContractsProvider } from '@/context/contracts-context';
import { AccommodationProvider } from '@/context/accommodation-context';

export default function Contracts2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccommodationProvider>
      <ContractsProvider>
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
          {children}
        </div>
      </ContractsProvider>
    </AccommodationProvider>
  );
}
