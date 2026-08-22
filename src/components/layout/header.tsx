'use client';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Bell, Sun, Moon, Check, Monitor, Palette, LogOut, Package, CheckCircle2, ArrowLeftRight, Languages, MessageSquare, Info, PackageCheck, BellRing, PlusCircle, Download, Truck, ClipboardList, Wrench, Boxes, Home, Clock, Wallet, FileText, UserPlus, Building2, Receipt, BarChart3, CalendarOff, Users, History, TrendingUp, PieChart } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';
import { useUsers } from '@/context/users-context';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useNotifications } from '@/context/notifications-context';
import { useTheme } from '@/components/theme-provider';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import dynamic from 'next/dynamic';

const FeedbackWidget = dynamic(() => import('@/components/feedback/feedback-widget'), { ssr: false });

export function AppHeader({ className, ...props }: HTMLAttributes<HTMLElement>) {
  const { currentUser } = useUsers();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const { mode, setMode, resolvedMode } = useTheme();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const atAccommodation = pathname?.startsWith('/accommodation');
  const { isMobile, setOpenMobile } = useSidebar();

  const toggleApp = () => {
    if (atAccommodation) router.push('/');
    else router.push('/accommodation');
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-close the mobile sidebar whenever the route changes
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  const handleThemeSettingsClick = () => {
    router.push('/setup#themes');
  };

  const handleProfileClick = () => {
  router.push('/profile');
  };

  const handleNotificationClick = (notificationId: string, href: string) => {
    markAsRead(notificationId);
    router.push(href);
  };

  const handleLogout = async () => {
    if (!auth) { router.push('/login'); return; }
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (e) {
      console.error(e);
    }
  };

  const { locale, toggleLanguage } = useLanguage();
  const { dict } = useLanguage();
  const isAr = locale === 'ar';

  // Dynamic context-aware quick actions for each application
  const getAppQuickActions = () => {
    if (pathname?.startsWith('/accommodation')) {
      return [
        {
          href: '/accommodation/quick-add-workers',
          title: isAr ? 'إضافة عمال' : 'Add Workers',
          Icon: UserPlus,
          colorClass: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50',
        },
        {
          href: '/accommodation/transfers',
          title: isAr ? 'نقل العمال' : 'Worker Transfers',
          Icon: ArrowLeftRight,
          colorClass: 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/50',
        },
        {
          href: '/accommodation/residences',
          title: isAr ? 'المساكن والمجمعات' : 'Residences',
          Icon: Building2,
          colorClass: 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/50',
        },
        {
          href: '/accommodation/invoices',
          title: isAr ? 'فواتير الإسكان' : 'Accommodation Invoices',
          Icon: Receipt,
          colorClass: 'text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/50',
        },
        {
          href: '/accommodation/reports',
          title: isAr ? 'تقارير الإسكان' : 'Accommodation Reports',
          Icon: BarChart3,
          colorClass: 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50',
        },
      ];
    }

    if (pathname?.startsWith('/timesheet')) {
      return [
        {
          href: '/timesheet/events',
          title: isAr ? 'سجل الحركات والحضور' : 'Attendance & Events',
          Icon: Clock,
          colorClass: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50',
        },
        {
          href: '/timesheet/requests',
          title: isAr ? 'طلبات الإجازات' : 'Leave Requests',
          Icon: CalendarOff,
          colorClass: 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/50',
        },
        {
          href: '/timesheet/employees',
          title: isAr ? 'إدارة الموظفين' : 'Employees',
          Icon: Users,
          colorClass: 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/50',
        },
        {
          href: '/timesheet/history',
          title: isAr ? 'أرشيف الدوام الشهري' : 'Monthly Timesheet Archive',
          Icon: History,
          colorClass: 'text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/50',
        },
      ];
    }

    if (pathname?.startsWith('/income-expenses')) {
      return [
        {
          href: '/income-expenses/transactions',
          title: isAr ? 'إضافة معاملة مالية' : 'New Transaction',
          Icon: PlusCircle,
          colorClass: 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50',
        },
        {
          href: '/income-expenses/report',
          title: isAr ? 'التقارير المالية' : 'Financial Reports',
          Icon: TrendingUp,
          colorClass: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50',
        },
      ];
    }

    if (pathname?.startsWith('/contracts')) {
      return [
        {
          href: '/contracts',
          title: isAr ? 'إدارة العقود' : 'Contracts Management',
          Icon: FileText,
          colorClass: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50',
        },
        {
          href: '/contracts',
          title: isAr ? 'فواتير العقود' : 'Contract Invoices',
          Icon: Receipt,
          colorClass: 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50',
        },
        {
          href: '/contracts',
          title: isAr ? 'تقارير العقود' : 'Contract Reports',
          Icon: PieChart,
          colorClass: 'text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/50',
        },
      ];
    }

    // Default Materials / Inventory App
    return [
      {
        href: '/inventory/new-order',
        title: dict.quickActions?.addNewOrder || (isAr ? 'إضافة طلب جديد' : 'Add New Order'),
        Icon: PlusCircle,
        colorClass: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50',
      },
      {
        href: '/inventory/receive/new-approval',
        title: dict.quickActions?.addMaterialReceipt || (isAr ? 'إضافة استلام مواد' : 'Add Material Receipt'),
        Icon: Download,
        colorClass: 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/50',
      },
      {
        href: '/inventory/issue',
        title: dict.quickActions?.issueMaterials || (isAr ? 'صرف المواد' : 'Issue Materials'),
        Icon: Truck,
        colorClass: 'text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/50',
      },
      {
        href: '/inventory/service-orders/new',
        title: dict.quickActions?.serviceOrder || (isAr ? 'طلب خدمة' : 'Service Order'),
        Icon: ClipboardList,
        colorClass: 'text-fuchsia-600 hover:text-fuchsia-700 hover:bg-fuchsia-50 dark:text-fuchsia-400 dark:hover:bg-fuchsia-950/50',
      },
      {
        href: '/maintenance/new',
        title: dict.quickActions?.maintenanceRequest || (isAr ? 'طلب صيانة' : 'Maintenance Request'),
        Icon: Wrench,
        colorClass: 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50',
      },
    ];
  };

  const appQuickActions = getAppQuickActions();

  // Visual mapping for notification types
  const getNotificationMeta = (type: string) => {
    switch (type) {
      case 'new_order':
        return { Icon: Package, color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950/60', ring: 'ring-blue-200 dark:ring-blue-900/50' };
      case 'order_approved':
        return { Icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/60', ring: 'ring-emerald-200 dark:ring-emerald-900/50' };
      case 'transfer_request':
        return { Icon: ArrowLeftRight, color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/60', ring: 'ring-amber-200 dark:ring-amber-900/50' };
      case 'feedback_update':
        return { Icon: MessageSquare, color: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-950/60', ring: 'ring-purple-200 dark:ring-purple-900/50' };
      case 'mrv_request':
        return { Icon: PackageCheck, color: 'text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-950/60', ring: 'ring-cyan-200 dark:ring-cyan-900/50' };
      case 'generic':
      default:
        return { Icon: BellRing, color: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800/70', ring: 'ring-slate-200 dark:ring-slate-800' };
    }
  };

  const headerClass = cn(
    // Glassmorphism header
    'sticky top-0 z-30 flex h-16 items-center gap-2 sm:gap-4 border-b px-2 sm:px-6 w-full min-w-0 max-w-full overflow-hidden',
    'bg-white/60 dark:bg-white/10 backdrop-blur-xl border-white/30 dark:border-white/10',
    className,
  );

  return (
    <header className={headerClass} {...props}>
      {/* Desktop keeps its toggle inside the sidebar header, next to the
          brand. Here it would be a second control for the same thing, so it
          only survives on mobile — where the sidebar is an off-canvas sheet
          and its own toggle is unreachable while closed. */}
      <SidebarTrigger className="h-10 w-10 shrink-0 md:hidden" />
      <div className="ms-1 sm:ms-3 flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar shrink min-w-0 max-w-[140px] xs:max-w-[200px] sm:max-w-none">
        <TooltipProvider>
          {/* Materials App */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/Materials"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium hover:bg-muted transition-colors shrink-0",
                  pathname?.startsWith('/Materials') &&
                  "bg-muted text-primary"
                )}
                title={dict.ui.materialsApp || 'Materials'}
              >
                <Boxes className="h-4.5 w-4.5" />
                <span className="sr-only">{dict.ui.materialsApp || 'Materials'}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>{dict.ui.materialsApp || 'Materials'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Accommodation App */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/accommodation"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium hover:bg-muted transition-colors shrink-0",
                  pathname?.startsWith('/accommodation') && "bg-muted text-primary"
                )}
                title={dict.ui.accommodationApp || 'Accommodation'}
              >
                <Home className="h-4.5 w-4.5" />
                <span className="sr-only">{dict.ui.accommodationApp || 'Accommodation'}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>{dict.ui.accommodationApp || 'Accommodation'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Timesheet App */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/timesheet"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium hover:bg-muted transition-colors shrink-0",
                  pathname?.startsWith('/timesheet') && "bg-muted text-primary"
                )}
                title="Timesheet"
              >
                <Clock className="h-4.5 w-4.5" />
                <span className="sr-only">Timesheet</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>Timesheet</p>
            </TooltipContent>
          </Tooltip>

          {/* Income & Expenses App */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/income-expenses"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium hover:bg-muted transition-colors shrink-0",
                  pathname?.startsWith('/income-expenses') && "bg-muted text-primary"
                )}
                title="Income & Expenses"
              >
                <Wallet className="h-4.5 w-4.5" />
                <span className="sr-only">Income & Expenses</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>Income & Expenses</p>
            </TooltipContent>
          </Tooltip>

          {/* Contracts App */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/contracts"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium hover:bg-muted transition-colors shrink-0",
                  pathname?.startsWith('/contracts') && "bg-muted text-primary"
                )}
                title="Contracts"
              >
                <FileText className="h-4.5 w-4.5" />
                <span className="sr-only">Contracts</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>Contracts</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex-1" />

      {/* Quick Actions */}
      <div className="hidden sm:flex items-center gap-1 rtl:ml-2 ltr:mr-2">
        <TooltipProvider>
          {appQuickActions.map((action, idx) => {
            const ActionIcon = action.Icon;
            return (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" asChild className={cn("h-9 w-9", action.colorClass)}>
                    <Link href={action.href}>
                      <ActionIcon className="h-5 w-5" />
                      <span className="sr-only">{action.title}</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{action.title}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
        <div className="h-6 w-px bg-border mx-1" />
      </div>

  {/* Feedback trigger in header */}
  <FeedbackWidget />

      {/* Theme direct toggle button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')}
            >
              {resolvedMode === 'light' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span className="sr-only">{dict.ui.theme}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{resolvedMode === 'dark' ? (dict.ui.light || 'Light') : (dict.ui.dark || 'Dark')}</p>
          </TooltipContent>
        </Tooltip>

        {/* Language direct toggle button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full relative"
              onClick={toggleLanguage}
            >
              <Languages className="h-5 w-5" />
              <span className="absolute -bottom-0.5 -right-0.5 text-[9px] font-extrabold uppercase leading-none bg-primary/10 text-primary px-1 py-0.5 rounded border border-primary/20">
                {locale === 'ar' ? 'EN' : 'ع'}
              </span>
              <span className="sr-only">Change language</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{locale === 'ar' ? 'English' : 'العربية'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
           <Button variant="ghost" size="icon" className="rounded-full relative">
                <Bell className="h-5 w-5" />
                {isMounted && unreadCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center rounded-full p-0">{unreadCount}</Badge>
                )}
                <span className="sr-only">Notifications</span>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-96 max-w-sm">
            <DropdownMenuLabel className="flex justify-between items-center">
                <span className="font-semibold">{dict.notifications}</span>
                {isMounted && unreadCount > 0 && <Button variant="link" size="sm" className="h-auto p-0" onClick={markAllAsRead}>{dict.viewAll}</Button>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isMounted && notifications.length > 0 ? notifications.slice(0, 8).map(notification => {
                const meta = getNotificationMeta(notification.type);
                const { Icon } = meta;
                return (
                  <DropdownMenuItem
                    key={notification.id}
                    onSelect={() => handleNotificationClick(notification.id, notification.href)}
                    className={cn(
                      'flex items-start gap-3 whitespace-normal py-3',
                      'focus:bg-accent/60',
                      !notification.isRead ? 'bg-accent/40' : ''
                    )}
                  >
                    <div className={cn('mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full ring-1', meta.color, meta.ring)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-snug truncate">{notification.title}</p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                    </div>
                    {!notification.isRead && <span className="ml-1 mt-1 inline-block h-2 w-2 rounded-full bg-primary" aria-hidden />}
                  </DropdownMenuItem>
                );
            }) : (
              <DropdownMenuItem disabled>
                <p className="p-2 text-sm text-muted-foreground text-center w-full">{dict.notifications}</p>
              </DropdownMenuItem>
            )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              {isMounted && currentUser ? (
                <>
                  <AvatarImage src={`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='20'%3EIMG%3C/text%3E%3C/svg%3E`} alt={currentUser.name} data-ai-hint="profile picture" />
                  <AvatarFallback>{currentUser.name?.charAt(0) || 'U'}</AvatarFallback>
                </>
              ) : (
                 <AvatarFallback /> 
              )}
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuLabel>{isMounted && currentUser ? currentUser.name : dict.myAccount}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleProfileClick}>{dict.profile}</DropdownMenuItem>
            <DropdownMenuItem>{dict.settings}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> {dict.logout}
            </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
