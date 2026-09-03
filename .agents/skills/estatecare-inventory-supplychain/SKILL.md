---
name: estatecare-inventory-supplychain
description: >-
  Workflows, schemas, and integrity constraints for EstateCare Inventory and Materials operations. Use when modifying Material Requests (MR), Receiving Vouchers (MRV), Issuing Vouchers (MIV), stock transfers, inventory audits, stock reconciliation, or residence stock balances.
---

# EstateCare Inventory & Supply Chain Skill

This skill guides the implementation, extension, and maintenance of the Materials & Inventory modules in EstateCare.

## Key Files and Architecture
- `src/context/inventory-context.tsx`: Core inventory catalog, items, categories, units, and residence balances.
- `src/context/orders-context.tsx`: Material Requests (MR) and procurement workflow state.
- `src/app/inventory/orders/`: Material Requests (MR) list, creation, approval workflow, and consolidated reports.
- `src/app/inventory/receive/`: Material Receiving Vouchers (MRV) and supplier delivery verification.
- `src/app/inventory/issue/`: Material Issuing Vouchers (MIV) for maintenance jobs and site consumption.
- `src/app/inventory/transfer/`: Stock transfer between residences/warehouses.
- `src/app/inventory/inventory-audit/`: Stocktaking, physical count reconciliation, and discrepancy audits.

---

## 1. Document Lifecycle & Types

### A. Material Request (MR)
- **Path**: `/inventory/orders`
- **Lifecycle**: `Draft` -> `Submitted` -> `Under Review` -> `Approved` / `Rejected` -> `Partially Fulfilled` -> `Fulfilled`.
- **Validation**: Requires item catalog ID, requested quantity, target residence, requester user ID, and justification.

### B. Material Receiving Voucher (MRV)
- **Path**: `/inventory/receive`
- **Purpose**: Acknowledges delivery of goods into a residence warehouse.
- **Stock Impact**: **Increases** the stock quantity for the specified residence and item:
  ```typescript
  residenceStock[itemId].quantity += receivedQuantity;
  ```
- **Attachments**: Supports delivery note / invoice photos uploaded via `/api/uploads/mrv` or `/api/uploads/mrv-invoice`.

### C. Material Issuing Voucher (MIV)
- **Path**: `/inventory/issue`
- **Purpose**: Issues items from warehouse to a maintenance request, technician, or project.
- **Stock Impact**: **Decreases** the stock quantity for the specified residence and item:
  ```typescript
  if (currentQuantity < issuedQuantity) {
    throw new Error('Insufficient stock balance for issue');
  }
  residenceStock[itemId].quantity -= issuedQuantity;
  ```
- **Rule**: Negative stock balances are strictly prohibited. Always validate availability before issuing.

### D. Stock Transfer
- **Path**: `/inventory/transfer`
- **Flow**: Source Residence (`quantity -= transferQty`) -> Target Residence (`quantity += transferQty`).
- **Statuses**: `Pending` -> `In Transit` -> `Received` / `Completed`.

---

## 2. Inventory Audit & Reconciliation
- **Path**: `/inventory/inventory-audit`
- **Procedure**:
  1. Freeze or snapshot the expected system balance at audit start.
  2. Physical count is entered per item by the audit officer.
  3. Discrepancy is calculated:
     $$\text{Variance} = \text{Physical Count} - \text{System Balance}$$
  4. System highlights positive variance (surplus) and negative variance (deficit).
  5. Audit review & reconciliation require explicit approval before applying stock adjustments.

---

## 3. Critical Guidelines & Data Integrity
1. **Never mutate balances directly in UI**: Always dispatch mutations through `inventory-context.tsx` or transactional API routes (`/api/inventory/*`).
2. **Track History**: Every balance change must log an item movement transaction with timestamp, user ID, document reference (MR/MRV/MIV/Transfer), and quantity delta.
3. **Multi-Unit Precision**: Preserve packaging units (e.g. Box vs Piece) and standard unit conversions.
