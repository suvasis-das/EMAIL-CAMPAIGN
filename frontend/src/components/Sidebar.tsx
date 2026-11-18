'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ExternalLink,
  FileCode2,
  Send,
  Users,
} from 'lucide-react';
import { api, API_URL } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Activity },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/templates', label: 'Templates', icon: FileCode2 },
  { href: '/campaigns', label: 'Campaigns', icon: Send },
];

export function Sidebar() {
  const pathname = usePathname();
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>(
    'checking'
  );

  // Poll /health once on mount so the user immediately sees whether the API + DB are up
  useEffect(() => {
    let active = true;

    async function check() {
      try {
        await api.checkHealth();
        if (active) setApiStatus('online');
      } catch {
        if (active) setApiStatus('offline');
      }
    }

    check();
    const timer = setInterval(check, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <aside className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-white/[0.08] bg-[#0c0c0f] flex flex-col justify-between">
      <div>
        {/* Brand header */}
        <div className="px-4 py-4 border-b border-white/[0.06] flex items-center justify-between md:block">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="h-6 w-6 rounded-[5px] bg-[#fafafa] text-[#09090b] font-mono text-xs font-semibold flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              MQ
            </span>
            <div>
              <div className="text-sm font-medium tracking-tight text-zinc-100 leading-none">
                Mailqueue
              </div>
              <div className="text-[11px] font-mono text-zinc-500 mt-1 leading-none">
                SMTP · MySQL Worker
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation links */}
        <nav className="p-2 flex md:flex-col gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[#18181b] text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] border border-white/[0.08]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    isActive ? 'text-zinc-100' : 'text-zinc-500'
                  }`}
                  strokeWidth={1.75}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer: live backend health + Swagger link */}
      <div className="hidden md:block p-3 border-t border-white/[0.06] space-y-2.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1.5">
          <span className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                apiStatus === 'online'
                  ? 'bg-emerald-400'
                  : apiStatus === 'offline'
                  ? 'bg-rose-400'
                  : 'bg-amber-400'
              }`}
            />
            {apiStatus === 'online'
              ? 'API connected'
              : apiStatus === 'offline'
              ? 'API offline'
              : 'Checking API'}
          </span>
        </div>

        <a
          href={`${API_URL}/api-docs`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between px-2 py-1.5 rounded-md text-[12px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
        >
          <span>OpenAPI Docs</span>
          <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
        </a>
      </div>
    </aside>
  );
}
