'use client';

import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Building, Home, Wrench, Settings, Users, ClipboardList, Move, ListOrdered, ClipboardMinus, AreaChart, History, PackageCheck, TrendingUp, TrendingDown, AlertTriangle, FileCheck, GitBranch, LifeBuoy, Truck, FileText, Clock, Wallet, Calendar, Check, RefreshCw, UserCheck } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useLanguage } from '@/context/language-context';
import { useUsers } from '@/context/users-context';
import { useState, useEffect } from 'react';
import { useSidebar, SidebarTrigger } from '@/components/ui/sidebar';

/**
 * Sidebar brand plus the collapse control, shared by every section's header.
 *
 * Expanded, the two sit on one row with the toggle pushed to the trailing edge.
 * In rail view the label drops out and the pair stacks, so the rail reads as
 * logo-then-toggle rather than a clipped wordmark.
 */
function SidebarBrand({
  icon,
  label,
  className,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:p-1">
      {icon}
      <span className={`text-xl font-semibold truncate group-data-[collapsible=icon]:hidden ${className || ''}`}>
        {label}
      </span>
      <SidebarTrigger className="ms-auto h-8 w-8 shrink-0 group-data-[collapsible=icon]:ms-0" />
    </div>
  );
}

/**
 * Footer identity block, shared by every section's footer.
 *
 * The card it sits in is dropped in rail view: a bordered box with its own
 * padding around a 2rem avatar does not fit a 3.5rem rail, and the old markup
 * overflowed it horizontally — `justify-center` was set on an element that was
 * never `flex`, so it centred nothing.
 */
function SidebarUser({
  currentUser,
  loading,
  withImage = false,
}: {
  currentUser: { name?: string; role?: string } | null | undefined;
  loading: boolean;
  withImage?: boolean;
}) {
  return (
    <div className="p-2 group-data-[collapsible=icon]:p-1">
      <div className="flex w-full items-center gap-2 rounded-md border p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:p-0">
        <Avatar className="size-8 shrink-0">
          {currentUser ? (
            <>
              {withImage && (
                <AvatarImage
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='20'%3EIMG%3C/text%3E%3C/svg%3E"
                  alt={currentUser.name}
                  data-ai-hint="profile picture"
                />
              )}
              <AvatarFallback>{currentUser.name?.charAt(0) || 'U'}</AvatarFallback>
            </>
          ) : (
            <AvatarFallback />
          )}
        </Avatar>
        <div className="min-w-0 text-start group-data-[collapsible=icon]:hidden">
          <p className="truncate font-semibold text-sm">{loading ? 'Loading...' : currentUser?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{loading ? '' : currentUser?.role}</p>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { currentUser, loading } = useUsers();
  const { dict, locale } = useLanguage();
  const [isMounted, setIsMounted] = useState(false);
  // const [gitInfo, setGitInfo] = useState<ReturnType<typeof getFormattedGitInfo> | null>(null);
  const { isMobile, setOpenMobile } = useSidebar();

  useEffect(() => {
    setIsMounted(true);
  // setGitInfo(getFormattedGitInfo());
  }, []);

  // Close the mobile sidebar immediately after a navigation item is clicked
  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  // Prevent hydration mismatches by rendering only after mount
  if (!isMounted) {
    return null;
  }

  // When inside the accommodation app, render accommodation sidebar
  const isAccommodation = pathname?.startsWith('/accommodation');
  const isTimesheet = pathname?.startsWith('/timesheet');
  const isIncomeExpenses = pathname?.startsWith('/income-expenses');
  const isTimesheetDailyExport = pathname?.startsWith('/timesheet/export');

  if (isTimesheet) {
    return (
      <>
        <SidebarHeader>
          <SidebarBrand
            icon={<Clock className="h-8 w-8 shrink-0 text-blue-600" />}
            label={'Timesheet'}
            className="text-blue-600"
          />
          <div className="px-2 pb-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <SidebarMenuButton asChild tooltip={'العودة للرئيسية'} className="bg-muted/50 border border-border mt-2 w-full justify-start">
              <Link href="/" onClick={handleNavigate}>
                <Home className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden text-sm ml-2 mr-2">
                  {'العودة للرئيسية'}
                </span>
              </Link>
            </SidebarMenuButton>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <div>
              <div className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:h-px group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-sidebar-border group-data-[collapsible=icon]:text-transparent">
                {dict.sidebar?.main || 'Main'}
              </div>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/timesheet'} tooltip="Dashboard">
                  <Link href="/timesheet" onClick={handleNavigate}>
                    <ClipboardList />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {'Records'}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <div className="h-2"></div>
            </div>
            {/* Timesheet Management */}
            <div>
              <div className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:h-px group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-sidebar-border group-data-[collapsible=icon]:text-transparent">
                {'Management'}
              </div>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/timesheet/employees'} tooltip="Employees">
                  <Link href="/timesheet/employees" onClick={handleNavigate}>
                    <Users />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {'Employees'}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/timesheet/employee-report'} tooltip="Employee Report">
                  <Link href="/timesheet/employee-report" onClick={handleNavigate}>
                    <UserCheck />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {'Employee Profile & Log'}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/timesheet/history'} tooltip="Monthly Archive">
                  <Link href="/timesheet/history" onClick={handleNavigate}>
                    <History />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {'Monthly Archive'}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isTimesheetDailyExport} tooltip="Daily Excel Export">
                  <Link href="/timesheet/export" onClick={handleNavigate}>
                    <FileText />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {'Daily Excel Export'}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/timesheet/requests'} tooltip="Requests">
                  <Link href="/timesheet/requests" onClick={handleNavigate}>
                    <ClipboardList />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {'Requests'}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/timesheet/settings'} tooltip="Settings">
                  <Link href="/timesheet/settings" onClick={handleNavigate}>
                    <Settings />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {'Settings'}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <div className="h-2"></div>
            </div>

            {/* Timesheet Events & Exceptions */}
            <div>
              <div className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:h-px group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-sidebar-border group-data-[collapsible=icon]:text-transparent">
                {'Leaves Management'}
              </div>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/timesheet/leaves'} tooltip="Leaves Management">
                  <Link href="/timesheet/leaves" onClick={handleNavigate}>
                    <Calendar />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {'Leaves Management'}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/timesheet/events'} tooltip="Leaves & Events">
                  <Link href="/timesheet/events" onClick={handleNavigate}>
                    <AlertTriangle />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {'Exceptions (Events)'}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <div className="h-2"></div>
            </div>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarUser currentUser={currentUser} loading={loading} />
        </SidebarFooter>
      </>
    );
  }

  if (isIncomeExpenses) {
    return (
      <>
        <SidebarHeader>
          <SidebarBrand
            icon={<Wallet className="h-8 w-8 shrink-0 text-green-600" />}
            label={'الدخل والمصروفات'}
            className="text-green-600"
          />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <div>
              <div className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:h-px group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-sidebar-border group-data-[collapsible=icon]:text-transparent">
                Main
              </div>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/income-expenses'} tooltip="Dashboard">
                  <Link href="/income-expenses" onClick={handleNavigate}>
                    <Home />
                    <span className="group-data-[collapsible=icon]:hidden">Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/income-expenses/transactions'}
                  tooltip={isIncomeExpenses ? 'Transactions' : 'Transactions'}
                >
                  <Link href="/income-expenses/transactions" onClick={handleNavigate}>
                    <ListOrdered />
                    <span className="group-data-[collapsible=icon]:hidden">{'الحركات'}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/income-expenses/report'}
                  tooltip={isIncomeExpenses ? 'Report' : 'Report'}
                >
                  <Link href="/income-expenses/report" onClick={handleNavigate}>
                    <AreaChart />
                    <span className="group-data-[collapsible=icon]:hidden">{'التقرير'}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </div>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarUser currentUser={currentUser} loading={loading} />
        </SidebarFooter>
      </>
    );
  }


  if (isAccommodation) {
    return (
      <>
        <SidebarHeader>
          <SidebarBrand
            icon={<Building className="h-8 w-8 shrink-0 text-amber-600" />}
            label="Accommodation"
            className="text-amber-600"
          />
          <div className="px-2 pb-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <SidebarMenuButton asChild tooltip={true ? 'العودة للرئيسية' : 'Back to Main'} className="bg-muted/50 border border-border mt-2 w-full justify-start">
              <Link href="/" onClick={handleNavigate}>
                <Home className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden text-sm ml-2 mr-2">
                  {true ? 'العودة للرئيسية' : 'Back to Main'}
                </span>
              </Link>
            </SidebarMenuButton>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {/* Main Section */}
            <div>
              <div className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:h-px group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-sidebar-border group-data-[collapsible=icon]:text-transparent">
                Main
              </div>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/accommodation/overview'} tooltip="Overview">
                  <Link href="/accommodation/overview" onClick={handleNavigate}>
                    <Home />
                    <span className="group-data-[collapsible=icon]:hidden">Overview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <div className="h-2"></div>
            </div>

            {/* Management Section */}
            <div>
              <div className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:h-px group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-sidebar-border group-data-[collapsible=icon]:text-transparent">
                Management
              </div>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/accommodation/residences'} tooltip="Residences">
                  <Link href="/accommodation/residences" onClick={handleNavigate}>
                    <Building />
                    <span className="group-data-[collapsible=icon]:hidden">Residences</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/accommodation/workers'} tooltip="Workers">
                  <Link href="/accommodation/workers" onClick={handleNavigate}>
                    <Users />
                    <span className="group-data-[collapsible=icon]:hidden">Workers</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/accommodation/assign'} tooltip="Assign Workers">
                  <Link href="/accommodation/assign" onClick={handleNavigate}>
                    <Move />
                    <span className="group-data-[collapsible=icon]:hidden">Assign Workers</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/accommodation/transfers'} tooltip="Transfers">
                  <Link href="/accommodation/transfers" onClick={handleNavigate}>
                    <GitBranch />
                    <span className="group-data-[collapsible=icon]:hidden">Transfers</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/accommodation/pending-transfers'} tooltip="Pending Transfers">
                  <Link href="/accommodation/pending-transfers" onClick={handleNavigate}>
                    <Truck />
                    <span className="group-data-[collapsible=icon]:hidden">Pending Transfers</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <div className="h-2"></div>
            </div>

            {/* Contracts & Billing Section */}
            <div>
              <div className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:h-px group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-sidebar-border group-data-[collapsible=icon]:text-transparent">
                Contracts & Billing
              </div>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/accommodation/companies'} tooltip="Companies">
                  <Link href="/accommodation/companies" onClick={handleNavigate}>
                    <Building />
                    <span className="group-data-[collapsible=icon]:hidden">Companies</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/accommodation/contracts'} tooltip="Contracts">
                  <Link href="/accommodation/contracts" onClick={handleNavigate}>
                    <FileCheck />
                    <span className="group-data-[collapsible=icon]:hidden">Contracts</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/accommodation/invoices'} tooltip="Invoices">
                  <Link href="/accommodation/invoices" onClick={handleNavigate}>
                    <ClipboardList />
                    <span className="group-data-[collapsible=icon]:hidden">Invoices</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <div className="h-2"></div>
            </div>

            {/* Reports Section */}
            <div>
              <div className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:h-px group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-sidebar-border group-data-[collapsible=icon]:text-transparent">
                Reports
              </div>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/accommodation/reports'} tooltip="Reports">
                  <Link href="/accommodation/reports" onClick={handleNavigate}>
                    <AreaChart />
                    <span className="group-data-[collapsible=icon]:hidden">Reports</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/accommodation/analytics'} tooltip={dict.accommodationAnalytics || 'Accommodation Analytics'}>
                  <Link href="/accommodation/analytics" onClick={handleNavigate}>
                    <TrendingUp />
                    <span className="group-data-[collapsible=icon]:hidden">{dict.accommodationAnalytics || 'Accommodation Analytics'}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/accommodation/worker-certificate'} tooltip="Worker Certificate">
                  <Link href="/accommodation/worker-certificate" onClick={handleNavigate}>
                    <FileText />
                    <span className="group-data-[collapsible=icon]:hidden">Worker Certificate</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </div>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarUser currentUser={currentUser} loading={loading} withImage />
        </SidebarFooter>
      </>
    );
  }

  // Define menu item types
  interface MenuItem {
    href: string;
    label: string;
    icon: any;
    exact?: boolean;
    abbreviation?: string;
  external?: boolean;
  }

  interface MenuSection {
    title: string;
    items: MenuItem[];
    subItems?: MenuItem[];
  }

  // Menu structure with groupings

  const menuStructure: MenuSection[] = [
    // Main Section
    {
      title: dict.sidebar?.main || 'Main',
      items: [
        { href: '/', label: dict.sidebar?.dashboard || 'Dashboard', icon: Home },
  // Moved Service Orders directly under Dashboard
  { href: '/inventory/service-orders', label: 'Service Orders', icon: GitBranch },
  // Single Maintenance entry (always internal)
  { href: '/maintenance', label: dict.sidebar?.maintenance || 'Maintenance', icon: Wrench },
      ]
    },
    // Stock Management Section
    {
      title: dict.sidebar?.stockManagement || 'Stock Management',
      items: [
        { href: '/inventory', label: dict.sidebar?.inventory || 'Inventory', icon: ClipboardList, exact: true },
        { href: '/inventory/inventory-audit', label: dict.sidebar?.stockReconciliation || 'Stock Reconciliation', icon: FileCheck },
        { href: '/inventory/depreciation', label: dict.sidebar?.depreciation || 'Depreciation', icon: AlertTriangle },
  { href: '/inventory/transfer', label: dict.sidebar?.stockTransfer || 'Stock Transfer', icon: Move },
      ]
    },
    // Material Movement Section
    {
      title: dict.sidebar?.materialMovement || 'Material Movement',
      items: [
        { href: '/inventory/orders', label: dict.sidebar?.materialRequests || 'Material Requests', abbreviation: ' (MR)', icon: ListOrdered },
        { href: '/inventory/receive', label: dict.sidebar?.receiveMaterials || 'Receive Materials', abbreviation: ' (MRV)', icon: PackageCheck },
        { href: '/inventory/issue', label: dict.sidebar?.issueMaterials || 'Issue Materials', abbreviation: ' (MIV)', icon: ClipboardMinus, exact: true },
  { href: '/inventory/request-issue', label: 'Request + Issue (Beta)', icon: PackageCheck },
      ]
    },
    // Reports Section
    {
      title: dict.sidebar?.reports || 'Reports',
      items: [
        { href: '/reports', label: dict.sidebar?.reports || 'Reports', icon: AreaChart },
        { href: '/inventory/orders/analytics', label: dict.ordersAnalytics || 'Material Requests Analytics', icon: TrendingUp },
      ],
      subItems: [
        { href: '/inventory/reports/stock-movement', label: dict.sidebar?.stockMovementReport || 'Stock Movement Report', icon: TrendingUp },
        { href: '/inventory/reports/lifespan', label: dict.sidebar?.lifespanReport || 'Lifespan Report', icon: History },
        { href: '/inventory/reports/reconciliations', label: dict.sidebar?.reconciliations || 'Reconciliations', icon: FileCheck },
      ]
    },
    // Other Apps / Modules Section
    {
      title: 'Apps & Modules',
      items: [
        { href: '/accommodation', label: 'Accommodation', icon: Building },
        { href: '/contracts', label: 'Contracts (العقود)', icon: FileText },
        { href: '/timesheet', label: 'Timesheet (سجل الدوام)', icon: Clock },
        { href: '/income-expenses/transactions', label: 'Income & Expenses', icon: Wallet },
      ]
    },
    // Settings Section
    {
      title: dict.sidebar?.settings || 'Settings',
      items: [
  { href: '/residences', label: dict.sidebar?.residences || 'Residences', icon: Building },
        ...(currentUser?.role === 'Admin' ? [
          { href: '/users', label: dict.sidebar?.users || 'Users', icon: Users },
          { href: '/setup', label: dict.sidebar?.setup || 'Setup', icon: Settings },
        ] : [] as any),
      ] as any
    },
    // Feedback Section
    {
      title: dict.feedback || 'Feedback',
      items: [
        { href: '/feedback', label: dict.myFeedback || 'My Feedback', icon: LifeBuoy },
        ...(currentUser?.role === 'Admin' ? [
          { href: '/admin/feedback', label: dict.feedbackBoard || 'Feedback Board', icon: ClipboardList },
          { href: '/admin/feedback/stats', label: dict.feedbackAnalytics || 'Feedback Analytics', icon: AreaChart },
        ] : [] as any),
      ] as any,
    },
  ];

  return (
    <>
      <SidebarHeader>
        <SidebarBrand
          icon={<Building className="h-8 w-8 shrink-0 text-primary" />}
          label="EstateCare"
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuStructure.map((section, sectionIndex) => (
            <div key={`section-${sectionIndex}`}>
              {/* Section Title */}
              <div className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:h-px group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-sidebar-border group-data-[collapsible=icon]:text-transparent">
                {section.title}
              </div>
              
              {/* Section Items */}
              {section.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.exact ? pathname === item.href : pathname.startsWith(item.href) && (item.href !== '/' || pathname === '/')}
                    tooltip={item.label}
                  >
                    {item.external ? (
                      <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={handleNavigate}>
                        <item.icon />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}{item.abbreviation || ''}</span>
                      </a>
                    ) : (
                      <Link href={item.href} onClick={handleNavigate}>
                        <item.icon />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}{item.abbreviation || ''}</span>
                      </Link>
                    )}
                  </SidebarMenuButton>
                  
                  {/* Sub-items for Reports section */}
                  {item.href === '/reports' && section.subItems && (
                    <SidebarMenuSub>
                      {section.subItems.map(subItem => (
                        <SidebarMenuSubItem key={subItem.href}>
                          <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
                            <Link href={subItem.href} onClick={handleNavigate}>
                              <subItem.icon />
                              <span className="group-data-[collapsible=icon]:hidden">{subItem.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              ))}
              
              {/* Add spacing between sections */}
              {sectionIndex < menuStructure.length - 1 && (
                <div className="h-2"></div>
              )}
            </div>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarUser currentUser={currentUser} loading={loading} withImage />
      </SidebarFooter>
    </>
  );
}
