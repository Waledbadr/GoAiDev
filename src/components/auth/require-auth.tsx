"use client";

import { ReactNode, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(() => auth?.currentUser || null);

  useEffect(() => {
    const _auth = auth;
    if (!_auth) {
      // If auth isn't configured, let the app load (local mode)
      setReady(true);
      return;
    }

    let isMounted = true;

    // Ensure initial auth persistence is fully loaded before taking action
    _auth.authStateReady().then(() => {
      if (!isMounted) return;
      const currentUser = _auth.currentUser;
      setUser(currentUser);
      setReady(true);
      if (!currentUser && pathname !== "/login") {
        const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
        router.replace(`/login${nextParam}`);
      }
    });

    const unsub = onAuthStateChanged(_auth, async (u) => {
      if (!isMounted) return;
      if (u) {
        setUser(u);
        setReady(true);
        if (pathname === "/login") {
          router.replace("/");
        }
      } else {
        // Wait for authStateReady to confirm this is not a transient state
        await _auth.authStateReady();
        if (!isMounted) return;
        if (!_auth.currentUser) {
          setUser(null);
          setReady(true);
          if (pathname !== "/login") {
            const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
            router.replace(`/login${nextParam}`);
          }
        }
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [router, pathname]);

  // While determining auth state, render nothing to avoid layout shift
  if (!ready && !user) return null;

  // If auth is ready but no user, don't render protected UI
  if (!user) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-muted-foreground text-sm">
        Redirecting to login…
      </div>
    );
  }

  return <>{children}</>;
}
