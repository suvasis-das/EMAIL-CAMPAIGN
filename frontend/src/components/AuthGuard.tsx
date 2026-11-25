'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from './Sidebar';
import { Loader2 } from 'lucide-react';

/**
 * AuthGuard enforces application-wide route protection.
 *
 * Rules:
 * 1. Unauthenticated users cannot view or interact with any dashboard features
 *    (Dashboard, Leads, Templates, Campaigns, or Sidebar). They are immediately
 *    routed to `/login`.
 * 2. On `/login` and `/signup`, the sidebar is hidden so the authentication portal
 *    is clean and distraction-free.
 * 3. Authenticated users attempting to visit `/login` or `/signup` are automatically
 *    routed back to the dashboard (`/`).
 * 4. While the session token is re-hydrating from storage, a minimal, dark-themed
 *    loader prevents layout shifts or flash of unauthenticated content.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute = pathname === '/login' || pathname === '/signup';

  useEffect(() => {
    if (isLoading) return;

    if (!user && !isAuthRoute) {
      router.replace('/login');
    } else if (user && isAuthRoute) {
      router.replace('/');
    }
  }, [user, isLoading, isAuthRoute, router]);

  // While checking stored session or re-authenticating
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="surface-card p-6 rounded-xl border border-white/[0.08] shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full">
          <div className="h-10 w-10 rounded-lg bg-[#fafafa] text-[#09090b] font-mono text-sm font-bold flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            MQ
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-zinc-200">
              Verifying Session
            </div>
            <div className="text-xs font-mono text-zinc-500">
              Loading operator credentials...
            </div>
          </div>
          <Loader2 className="h-4 w-4 text-zinc-400 animate-spin mt-1" />
        </div>
      </div>
    );
  }

  // Unauthenticated user trying to access protected routes (redirecting)
  if (!user && !isAuthRoute) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="surface-card p-6 rounded-xl border border-white/[0.08] shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full">
          <div className="h-10 w-10 rounded-lg bg-[#fafafa] text-[#09090b] font-mono text-sm font-bold flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            MQ
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-zinc-200">
              Sign In Required
            </div>
            <div className="text-xs font-mono text-zinc-500">
              Redirecting to authentication portal...
            </div>
          </div>
          <Loader2 className="h-4 w-4 text-zinc-400 animate-spin mt-1" />
        </div>
      </div>
    );
  }

  // Unauthenticated user on login or signup: render full-page auth layout (no sidebar)
  if (!user && isAuthRoute) {
    return (
      <div className="min-h-screen bg-[#09090b]">
        {children}
      </div>
    );
  }

  // Authenticated user trying to access /login or /signup (redirecting to dashboard)
  if (user && isAuthRoute) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="surface-card p-6 rounded-xl border border-white/[0.08] shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full">
          <div className="h-10 w-10 rounded-lg bg-[#fafafa] text-[#09090b] font-mono text-sm font-bold flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            MQ
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-zinc-200">
              Already Signed In
            </div>
            <div className="text-xs font-mono text-zinc-500">
              Redirecting to campaign console...
            </div>
          </div>
          <Loader2 className="h-4 w-4 text-zinc-400 animate-spin mt-1" />
        </div>
      </div>
    );
  }

  // Authenticated user on protected routes: render standard app layout with Sidebar
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
