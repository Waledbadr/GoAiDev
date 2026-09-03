---
name: estatecare-design-system
description: >-
  Comprehensive design system, UI/UX aesthetics, and styling standards for EstateCare. Use whenever designing, restyling, or polishing user interfaces, dashboards, KPI cards, tables, charts (Recharts), micro-animations, glassmorphism, or modern dark/light mode themes.
---

# EstateCare Design System & UI/UX Skill

This skill guides the creation of visually stunning, modern, and premium interfaces across the EstateCare application.

## Core Design Philosophy: "Wow at First Glance"
1. **Never settle for basic or generic layouts**: Avoid standard flat HTML/unstyled boxes. Every page must look polished, cohesive, and state-of-the-art.
2. **Curated HSL Palette**: Never use raw primary colors (e.g. `bg-blue-500`, `text-red-500`). Use EstateCare's HSL semantic tokens (`bg-primary`, `text-primary-foreground`, `bg-muted`, `border-border`, etc.).
3. **Depth and Layering**: Use elevation, subtle borders (`border-border/60`), and soft shadows (`shadow-sm`, `hover:shadow-md`) to distinguish layers.

---

## 1. Color Palette & Theming (Light & Dark Mode)
Configured in `src/app/globals.css` and `tailwind.config.ts`:
- **Background**: `bg-background` (Pure dark `224 71% 4%` in dark mode, clean light `240 10% 99%` in light mode).
- **Surfaces / Cards**: `bg-card` with `text-card-foreground` and `border border-border/60`.
- **Primary / Accent**: Tailored blue/indigo (`hsl(217.2 91.2% 59.8%)`) for active buttons, tabs, and focus states.
- **Muted & Neutral**: `text-muted-foreground` for subheadings, helper text, and inactive metadata.
- **Status Colors (Semantic)**:
  - Success: `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20`
  - Warning / Pending: `bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20`
  - Destructive / Error: `bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20`
  - Info / Transfer: `bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20`

---

## 2. Dashboard KPI & Metric Cards
KPI cards must convey critical metrics with high visual impact:

```tsx
<Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/60 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30">
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="text-3xl font-bold tracking-tight text-foreground font-mono">
          {value}
        </p>
      </div>
      <div className="rounded-xl bg-primary/10 p-3 text-primary ring-1 ring-primary/20">
        <Icon className="h-6 w-6" />
      </div>
    </div>
    {trend && (
      <div className="mt-4 flex items-center gap-1.5 text-xs">
        <span className={trend.isPositive ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}>
          {trend.value}
        </span>
        <span className="text-muted-foreground">vs last month</span>
      </div>
    )}
  </CardContent>
</Card>
```

---

## 3. Data Tables & High-Density Views
EstateCare displays large datasets (punches, inventory balances, workers). Design tables for effortless readability:
1. **Header**: Sticky `bg-muted/50 backdrop-blur` with small uppercase tracking labels (`text-xs font-semibold uppercase text-muted-foreground`).
2. **Row Hover**: `hover:bg-muted/40 transition-colors cursor-pointer`.
3. **Numeric Columns**: Always align numeric data (`R_Hours`, `OT_Hours`, quantities, monetary values) to the end (`text-end font-mono tabular-nums`).
4. **Status Badges**: Use rounded pill badges (`rounded-full px-2.5 py-0.5 text-xs font-medium border`).
5. **Empty States**: Never show a blank table. Render an illustrated empty state card with an icon, descriptive heading, and primary CTA button.

---

## 4. Charts & Visualizations (Recharts)
When adding or styling charts:
- Always use CSS theme variables for colors (`hsl(var(--chart-1))` through `hsl(var(--chart-5))`).
- Set subtle grid strokes: `stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.4}`.
- Style tooltips to match shadcn cards:
  ```tsx
  <Tooltip
    contentStyle={{
      backgroundColor: 'hsl(var(--card))',
      borderColor: 'hsl(var(--border))',
      borderRadius: 'var(--radius)',
      color: 'hsl(var(--foreground))',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}
  />
  ```

---

## 5. Micro-Animations & Dynamic States
- **Hover Transitions**: `transition-all duration-200 ease-in-out`.
- **Button Clicks**: `active:scale-[0.98]` for tactile feedback.
- **Glassmorphism for Modals / Headers**: `backdrop-blur-md bg-background/80 border-b border-border/40`.
- **Skeleton Loaders**: Use pulsating placeholders (`animate-pulse rounded-md bg-muted`) instead of spinning loading text.
