'use client';

import React from 'react';
import { TimesheetProvider } from '@/context/timesheet-context';
import { HousingEmployeesProvider } from '@/context/housing-employees-context';
import { TimesheetView } from '@/components/timesheet/timesheet-view';

export default function TimesheetDashboard() {
  return (
    <HousingEmployeesProvider>
      <TimesheetProvider>
        <div className="p-6">
          <TimesheetView />
        </div>
      </TimesheetProvider>
    </HousingEmployeesProvider>
  );
}
