---
name: estatecare-troubleshooting-performance
description: >-
  System diagnostics, error troubleshooting, performance optimization, and stability engineering for EstateCare. Use when investigating runtime errors (ChunkLoadError, hydration errors, crash exits), debugging slow API routes or cold starts, optimizing bundle size, database indexing, caching strategies, or stabilizing the Next.js 16 environment.
---

# EstateCare Stability, Performance & Troubleshooting Skill

This skill provides procedures for diagnosing errors, optimizing speed and responsiveness, and ensuring rock-solid stability in EstateCare.

---

## 1. Common Runtime Errors & Rapid Solutions

### A. `Runtime ChunkLoadError`
- **Root Cause**: The client requests a JavaScript chunk hash that the Turbopack dev server no longer has in memory (typically caused by the dev server stopping, crashing, or restarting while browser tabs remain open).
- **Remediation**:
  1. Verify if `next dev` is running and listening on port 3000:
     ```powershell
     Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
     ```
  2. If port 3000 is occupied by an orphaned node process, kill it:
     ```powershell
     Stop-Process -Name node -Force
     ```
  3. Clear stale Turbopack dev cache:
     ```powershell
     Remove-Item -Recurse -Force .next
     npm run dev
     ```
  4. Perform a hard browser refresh: `Ctrl + Shift + R` or `Ctrl + F5`.

### B. React Hydration Mismatch Errors
- **Root Cause**: Server-rendered HTML differs from the initial client render (e.g., mismatched timestamps, `Date.now()`, `Math.random()`, or browser-only APIs like `localStorage` / `window` evaluated during SSR).
- **Remediation**:
  - Always guard client-only values behind an `isMounted` state:
    ```typescript
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null; // Or return a Skeleton placeholder
    ```
  - Mark client-interactive components explicitly with `'use client';` at line 1.

### C. Large Import / OOM Crashes
- Avoid loading massive utilities (`xlsx`, `jspdf`, `html2canvas`) in module headers of shared components.
- Always load heavy utilities on demand (dynamic `import()` inside the action handler).

---

## 2. API & Database Performance Optimization

### A. Eliminating 15s+ Cold Starts on Local D1 / SQLite
- **Cause**: Repeated full-table scans across collections (`maintenanceRequests`, `serviceOrders`, `inventory`, `contractsV2`) during app boot.
- **Optimization Strategy**:
  1. **In-Memory Cache Layer**: Cache frequently read, rarely changed collections (e.g. `residences`, `companies`, `timesheetSettings`) in memory with a short TTL (e.g. 60 seconds).
  2. **SQLite Indexes**: Ensure the SQLite / D1 tables have indexes on `id`, `collection`, `updatedAt`, and foreign key identifiers (`badgeId`, `residenceId`, `contractId`).
  3. **Parallel Fetching**: In React contexts, avoid waterfall `await` calls. Use `Promise.all`:
     ```typescript
     // Fast: parallel resolution
     const [residences, workers, contracts] = await Promise.all([
       d1Client.getDocs('residences'),
       d1Client.getDocs('workers'),
       d1Client.getDocs('contractsV2')
     ]);
     ```

### B. Client-Side SWR / Cache Layer
- Store fetched collections in React Context state so that navigating between pages does not re-fetch the entire database from scratch.
- In `timesheet/history`, use `localStorage` caching with cache versioning and monthly prefixes (`timesheet_history_data_${monthStr}`).

---

## 3. System Health & Stability Checklist

### A. Pre-Flight Verification Commands
Before concluding any major bugfix or refactoring, execute:
1. **Typecheck**:
   ```powershell
   npm run typecheck
   ```
   Must exit with code 0.
2. **Production Build Validation**:
   ```powershell
   npm run build
   ```
   Ensures all 127+ routes compile cleanly without SSR breaks or missing imports.

### B. Graceful API Error Responses
Ensure all routes in `/api/` wrap operations in `try / catch` blocks and return structured JSON:
```typescript
try {
  // Logic
  return NextResponse.json({ ok: true, data });
} catch (err: any) {
  console.error(`[API Error in ${route}]:`, err);
  return NextResponse.json(
    { ok: false, error: err.message || 'Internal server error' },
    { status: err.status || 500 }
  );
}
```

### C. Safe Memory Management in Dev
- Keep-alive pinger (`scripts/keep-alive.mjs`) must handle unhandled rejections cleanly so it doesn't crash concurrent dev processes.
- Do not attach unbounded event listeners to `window` or `document` inside components without returning cleanup functions in `useEffect`.
