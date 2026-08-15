'use client';

import type { PropsWithChildren } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './sidebar';
import { AppHeader } from './header';
import RequireAuth from '@/components/auth/require-auth';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useUsers } from '@/context/users-context';
import { enablePushIfGranted } from '@/lib/messaging';
import { LanguageProvider, useLanguage } from '@/context/language-context';

const FeedbackWidget = dynamic(() => import('@/components/feedback/feedback-widget'), { ssr: false });

function AppLayoutInner({ children }: PropsWithChildren) {
  const { currentUser } = useUsers();
  const { locale } = useLanguage();

  useEffect(() => {
    enablePushIfGranted(currentUser?.id);
  }, [currentUser?.id]);
  const pathname = usePathname();

  // Render bare page for login route (no sidebar/header/guard)
  if (pathname === '/login') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        {children}
      </main>
    );
  }

  return (
    <RequireAuth>
      <SidebarProvider defaultOpen className="print:block print:h-auto print:min-h-0">
        <Sidebar side={locale === 'ar' ? 'right' : 'left'} className="no-print">
          <AppSidebar />
        </Sidebar>
        <SidebarInset className="flex flex-col min-w-0 w-full print:block print:h-auto print:min-h-0">
          <AppHeader className="no-print" />
          <main className="flex-1 overflow-y-auto print:overflow-visible overflow-x-hidden print:overflow-x-visible p-3 sm:p-4 lg:p-6 print:p-0 bg-background min-w-0 w-full print:block print:h-auto print:min-h-0">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RequireAuth>
  );
}

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <LanguageProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </LanguageProvider>
  );
}
