---
name: estatecare-accommodation-billing
description: >-
  Domain knowledge, validation rules, and invoicing logic for EstateCare Accommodation & Housing management. Use when modifying room allocations, worker assignments, housing capacities, single-nationality room rules, worker transfers, or contract billing and monthly invoice calculations (Contracts V2).
---

# EstateCare Accommodation & Billing Skill

This skill provides procedures and business rules for the Accommodation Management module in EstateCare.

## Key Files and Architecture
- `src/app/accommodation/`: App router pages for overview, workers, assign, contracts, invoices, and reports.
- `src/context/accommodation-context.tsx`: Primary accommodation state (workers, companies, contracts, invoices, occupants).
- `src/context/housing-employees-context.tsx`: Worker profiles and housing allocation state.
- `src/context/residences-context.tsx`: Residence physical structure (complexes, buildings, floors, rooms, facilities).
- `scripts/migrate-contracts-to-v2.mts`: Contracts V2 schema migration rules.

---

## 1. Room Capacity Validation Rules
Every room assignment must strictly adhere to the role-based minimum area rules:
```typescript
const SPACE_PER_PERSON: Record<string, number> = {
  worker: 4,      // 4 m² per worker
  supervisor: 8,  // 8 m² per supervisor
  engineer: 16,   // 16 m² per engineer
};

function calculateMaxCapacity(roomAreaSqm: number, role: string = 'worker'): number {
  const spaceNeeded = SPACE_PER_PERSON[role.toLowerCase()] || 4;
  return Math.floor(roomAreaSqm / spaceNeeded);
}
```
- **Overcrowding Warning**: Any room reaching `occupants.length >= maxCapacity` cannot accept additional workers.
- **Reporting**: Rooms with >90% occupancy are highlighted with warnings in `/accommodation/overview` and reports.

---

## 2. Nationality Compliance Rule
- **Rule**: A room can only house workers of the **same nationality**.
- **Enforcement**:
  1. When assigning a worker to a room with existing occupants, verify:
     ```typescript
     const existingNationality = occupants[0]?.nationality;
     if (existingNationality && existingNationality !== newWorker.nationality) {
       throw new Error('Mixing nationalities in the same room is prohibited');
     }
     ```
  2. Flag any legacy or accidental violations in `/accommodation/reports/nationality-distribution`.

---

## 3. Worker Transfer Lifecycle
1. **Creation**: A transfer request is submitted (`fromResidence` -> `toResidence`, with `workerId` and `date`).
2. **Status Flow**: `Pending` -> `Approved` or `Rejected`.
3. **Execution**: Upon approval:
   - Worker is unassigned from the old room/residence.
   - Allocated to the new residence/room (subject to capacity & nationality checks).
   - Transfer record logged in `ac_transfers` / `transfers` collection with audit timestamp.
   - Timesheet engine automatically reflects transfer marker `'T'` on or after this date.

---

## 4. Contract Billing & Invoicing Engine
- Contracts define terms between companies and residences:
  - `ratePerPerson`: Monthly rate per worker.
  - `startDate` and `endDate`.
- **Monthly Invoice Calculation**:
  $$\text{Invoice Amount} = \frac{\text{Active Workers Count} \times \text{Rate Per Person} \times \text{Days in Fiscal Period}}{30}$$
- **Duplicate Prevention**: Only one invoice can be generated per contract per fiscal month.
- **Invoice Status Lifecycle**: `Draft` -> `Pending` -> `Paid` | `Overdue` | `Cancelled`.

---

## 5. Referential Integrity Constraints
- **Companies**: Cannot delete a company that has active or linked contracts.
- **Contracts**: Cannot delete a contract that has associated generated invoices.
- **Invoices**: Paid invoices cannot be deleted or mutated without administrative reversal.

---

## 6. Verification Checklist
1. When modifying room assignment UI, always validate both `spaceSqm` capacity and `nationality`.
2. When adjusting contract billing, ensure fiscal month period matches `getFiscalMonthPeriod()` boundaries.
3. Test dual-language display (`nameAr` and `nameEn`) for companies and residences.
