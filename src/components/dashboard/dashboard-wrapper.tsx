'use client';

import { ReactNode } from 'react';
import { TimesheetProvider } from '@/context/timesheet-context';
import { ContractsProvider } from '@/context/contracts-context';
import { IncomeExpenseTransactionsProvider } from '@/context/income-expense-transactions-context';

export function DashboardWrapper({ children }: { children: ReactNode }) {
  return (
    <TimesheetProvider>
      <ContractsProvider>
        <IncomeExpenseTransactionsProvider>
          {children}
        </IncomeExpenseTransactionsProvider>
      </ContractsProvider>
    </TimesheetProvider>
  );
}
