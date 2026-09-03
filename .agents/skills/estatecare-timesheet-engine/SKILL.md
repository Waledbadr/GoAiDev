---
name: estatecare-timesheet-engine
description: >-
  Expertise in EstateCare's attendance, biometric punches, and monthly timesheet calculation rules. Use when creating, modifying, or debugging timesheet logic, punches, fiscal month cycles, Friday rest allowance, overtime, leave/exception processing, employee transfers, device-to-project mappings, or timesheet Excel exports.
---

# EstateCare Timesheet Engine Skill

This skill provides comprehensive instructions and business rules for the Timesheet and Attendance module in EstateCare.

## Key Files and Architecture
- `src/app/timesheet/history/page.tsx`: Monthly archive, grid view, calculations, and Excel export.
- `src/lib/fiscal-month-utils.ts`: Chain-link fiscal period calculations (`getFiscalMonthPeriod`, `getFiscalMonthForDate`).
- `src/context/timesheet-context.tsx`: Context provider for records, devices, events, and schedules.
- `src/constants/timesheet-devices.ts`: Biometric device serial numbers, project mappings, and residence links (`getProjectFromDevice`).
- `src/utils/timesheet-utils.ts`: Punch processing, pairing check-in/check-out, and daily status calculations.

---

## 1. Fiscal Month Period Rules (Chain-Link Sequence)
EstateCare does not strictly use calendar months (1st to 30th/31st) for payroll/timesheet calculation. Instead, it uses a **Fiscal Period** calibrated from a reference month:
- **Reference Month**: `2026-03`
- **Reference Start Date**: February 18, 2026 (or day 21 depending on configuration in `src/lib/fiscal-month-utils.ts`).
- **Chain-Link Logic**:
  - `numberOfDaysInTarget = days in target calendar month`
  - `endDate = startDate + numberOfDaysInTarget - 1`
  - Start date moves forward/backward by the exact number of days of the intervening months.
- **Rule**: Always use `getFiscalMonthPeriod(monthStr)` from `src/lib/fiscal-month-utils.ts` to get the list of days for any timesheet cycle. Never hardcode date ranges.

---

## 2. Attendance & Daily Status Processing
Each employee's day is evaluated into one of the following statuses:
- **`Present`**: Employee has valid biometric punches with working hours.
  - Standard shift regular hours: `8.0 hours`.
  - Overtime (OT): Hours worked beyond 8 hours on a regular day.
- **`Weekend` (Friday Rest Allowance)**:
  - Friday is the default weekly rest day.
  - **Eligibility**: An employee earns an **8.0-hour Friday Rest Allowance** if they worked on Thursday (or during the first week if Friday is day 1).
  - **Single Winner Attribution**: If an employee is associated with multiple projects or residences in that month, the Friday allowance is awarded **only to the primary/winner project** to prevent double-counting payroll hours.
  - If the employee physically worked on Friday, they get 8.0 hours allowance + overtime for actual hours worked.
- **`Leave`**: Approved leave recorded in the `leaves` collection.
- **`Exception`**: Approved exception/permission from the `exceptions` collection.
- **`Absent`**: Work day with no punches, leave, or exception.
- **`Transferred` ('T' Marker)**:
  - **Exit / Move-Out**: Days **on or after** the employee's transfer/exit date are marked with `'T'`.
  - **Join / Move-In**: Days **strictly before** the employee's start/move-in date are marked with `'T'` (unless valid punches exist).
  - Transferred days are excluded from absent day counts and payroll totals.

---

## 3. Device and Project Mapping
- Punches originate from biometric fingerprint/face devices identified by serial number (`device_sn` or `terminal_alias`).
- `getProjectFromDevice(sn)` maps each device to its respective project and residence.
- When an employee punches across devices in different projects, records are grouped per project, with Friday allowance assigned to the winner project based on accumulated Thursday activity.

---

## 4. Excel & Monthly Export Schema
When generating exports (e.g. via `xlsx`), the columns strictly follow the company ERP format:
1. `C_number`: Employee ID / Badge number.
2. `Name`: Full English/Arabic employee name.
3. `Department`: Profession or department (ordered via `PROFESSION_ORDER`).
4. `Project`: Assigned project or residence name.
5. `R_Hours`: Regular hours (RH).
6. `OT_Hours`: Overtime hours (OT).
7. `CostDscrp`: Cost description.
8. `Ppm_PrNam` / `Ppm_PrNo`: PPM project name and code.
9. `Task_Nam` / `Task_No`: Task name and code.
10. `Date`: ISO timestamp formatted string.
11. `Remarks`: Notes (Leave type, Transfer info, etc.).

---

## 5. Verification Checklist for Timesheet Edits
1. Run `npm run typecheck` (`tsc --noEmit`) to ensure TypeScript integrity.
2. Check that no Friday allowance is double-counted across projects for the same badge ID.
3. Ensure employee transfer dates properly trigger 'T' status without breaking daily RH/OT totals.
4. Verify that heavy libraries like `xlsx` do not trigger SSR hydration errors by keeping them within `'use client'` components or dynamic imports.
