---
name: estatecare-d1-data-layer
description: >-
  Architecture, querying, and migration guidelines for Cloudflare D1 (SQLite) and Firestore in EstateCare. Use when adding or modifying database schemas, API routes (/api/d1/[collection]), client queries (d1Client), batch operations, or synchronizing data between SQLite and Firestore.
---

# EstateCare D1 Data Layer Skill

This skill guides development on EstateCare's database architecture: Cloudflare D1 (SQLite) with Firestore fallback.

## Key Files and Architecture
- `src/lib/d1-client.ts`: Client-side adapter providing Firestore-like methods (`getDocs`, `getDoc`, `setDoc`, `setDocsBatch`, `updateDoc`, `deleteDoc`).
- `src/lib/d1-database.ts`: Server-side SQLite / D1 database driver interface (`better-sqlite3` in Node/dev, D1 binding in Cloudflare Workers).
- `src/app/api/d1/[collection]/route.ts`: Central dynamic REST API endpoint powering collection CRUD.
- `src/lib/firebase.ts`: Firebase client & Firestore configuration for legacy fallback.
- `scripts/export-firestore-to-d1.mjs`: Utility script for migrating collections from Firestore to D1 SQLite.

---

## 1. Client-Side Querying (`d1Client`)
Always use `d1Client` for collection queries in React components and contexts:

```typescript
import { d1Client } from '@/lib/d1-client';

// 1. Fetch all documents in a collection
const workers = await d1Client.getDocs<HousingEmployee>('workers');

// 2. Fetch a single document by ID
const residence = await d1Client.getDoc<Residence>('residences', residenceId);

// 3. Save or overwrite a document
await d1Client.setDoc('residences', 'timesheetSettings', { deviceToProjectMap: newMap });

// 4. Batch save (High performance for imports/sync)
await d1Client.setDocsBatch('workers', workerList);

// 5. Partial update
await d1Client.updateDoc('orders', orderId, { status: 'Approved' });

// 6. Delete document
await d1Client.deleteDoc('workers', workerId);
```

---

## 2. API Route Patterns (`/api/d1/[collection]`)
The dynamic route handles the following conventions:
- **`GET /api/d1/[collection]`**: Returns `{ ok: true, docs: [...], count: N }`.
- **`GET /api/d1/[collection]?id={id}`**: Returns `{ ok: true, doc: {...} }` or `404` if not found.
- **`POST /api/d1/[collection]`**:
  - Accepts single object: `{ id: "...", ...data }`.
  - Accepts batch array or `{ docs: [...] }` for high-throughput batch insertion.
- **`PATCH /api/d1/[collection]?id={id}`**: Accepts partial JSON update payload.
- **`DELETE /api/d1/[collection]?id={id}`**: Deletes the specified document.

---

## 3. Migration & Fallback Patterns
During the migration phase from Firestore to Cloudflare D1:
1. **Read-through Fallback**: If `d1Client.getDoc` returns `null` or 404, fall back to Firestore `getDoc(doc(db, collection, id))` if available:
   ```typescript
   let data = await d1Client.getDoc(col, id);
   if (!data) {
     const snap = await getDoc(doc(db, col, id));
     if (snap.exists()) {
       data = snap.data();
       // Optionally backfill to D1
       await d1Client.setDoc(col, id, data);
     }
   }
   ```
2. **Batch Limits**: SQLite parameterized query limit is 999 parameters. When writing batch scripts, chunk data into batches of 50-100 records.
3. **Data Loss Prevention**: Never run `DROP TABLE` or destructive scripts against production D1 without taking an export backup first (`npm run export:d1`).
