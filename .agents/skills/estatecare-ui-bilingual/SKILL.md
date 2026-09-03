---
name: estatecare-ui-bilingual
description: >-
  UI/UX design, Next.js 16 App Router practices, and Arabic/English bilingual (RTL/LTR) standards for EstateCare. Use when creating or updating pages, components, dialogs, sidebars, navigation, or translation dictionaries.
---

# EstateCare UI & Bilingual Development Skill

This skill provides styling, layout, and multi-language standards for EstateCare's user interface.

## Key Files and Architecture
- `src/lib/dictionaries.ts`: Central bilingual dictionary containing Arabic (`ar`) and English (`en`) translations.
- `src/context/language-context.tsx`: Language provider exposing `{ language, setLanguage, t, dir }`.
- `src/components/ui/`: shadcn/ui components powered by Radix UI and Tailwind CSS.
- `src/components/sidebar.tsx`: Dynamic modular navigation supporting apps (Materials, Accommodation, Timesheet, Income & Expenses, Contracts).
- `src/components/header.tsx`: Global app bar with fast app switcher, theme picker, language toggle, and user profile.

---

## 1. Bilingual (Arabic / English) Standards

### A. Translation Hook Usage
```typescript
import { useLanguage } from '@/context/language-context';

export function MyComponent() {
  const { language, t } = useLanguage();
  const isAr = language === 'ar';

  return (
    <div>
      <h1>{t('mySection.title') || (isAr ? 'العنوان' : 'Title')}</h1>
    </div>
  );
}
```

### B. Updating Dictionaries (`src/lib/dictionaries.ts`)
Whenever new UI elements or pages are added:
1. Always add corresponding entries to **both** the Arabic and English dictionary sections.
2. Group keys logically by domain (`accommodation`, `timesheet`, `inventory`, `contracts`, `common`).

### C. RTL & LTR Logical Styling with Tailwind
- Prefer **Tailwind logical properties** over physical left/right:
  - Use `ms-4` (margin-inline-start) instead of `ml-4` or `mr-4`.
  - Use `me-4` (margin-inline-end) instead of `mr-4` or `ml-4`.
  - Use `ps-3` / `pe-3` for padding.
  - Use `text-start` / `text-end` instead of `text-left` / `text-right`.
- **Directional Icons**: When using arrows or chevrons (`ChevronRight`, `ChevronLeft`, `ArrowRight`):
  ```tsx
  {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
  ```

---

## 2. Next.js 16 & Turbopack Performance Best Practices

### A. Client Components
- Add `'use client';` at the top of any file that uses React hooks (`useState`, `useEffect`, `useMemo`), context hooks, or browser event listeners.

### B. Heavy Client-Only Libraries
- Libraries like `xlsx`, `jspdf`, and `html2canvas` should never run during SSR or prerendering:
  - If imported statically, ensure the component has `'use client';`.
  - For large pages, prefer dynamic imports:
    ```typescript
    const exportExcel = async () => {
      const XLSX = await import('xlsx');
      // perform export
    };
    ```

### C. ChunkLoadError Prevention
- Avoid deep circular imports between contexts.
- Keep context providers organized in `src/app/providers.tsx` or module-level layouts.
- When dev cache gets stale, run `Remove-Item -Recurse -Force .next` followed by `npm run dev`.

---

## 3. UI Aesthetics & Component Hierarchy
- Adhere to the established shadcn/ui design tokens (`bg-card`, `border-border`, `text-muted-foreground`).
- Maintain consistent table designs with sticky headers, pagination, search bars, and filter dropdowns.
- Provide clear loading skeletons (`<Skeleton />`) and empty state placeholders (`Card` with icon and descriptive message) for all data-driven tables.
