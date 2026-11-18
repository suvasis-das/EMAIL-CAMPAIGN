'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Pause,
  Play,
  RefreshCw,
  Send,
} from 'lucide-react';
import { api, Campaign, CampaignStatsResponse } from '@/lib/api';

function formatTimestamp(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function StatusPill({ status }: { status: 'pending' | 'sent' | 'failed' }) {
  const styles = {
    sent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    pending: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    failed: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const dotStyles = {
    sent: 'bg-emerald-400',
    pending: 'bg-amber-400',
    failed: 'bg-rose-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border ${styles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[status]}`} />
      {status}
    </span>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const queryCampaignId = Number(searchParams.get('campaignId')) || null;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(queryCampaignId);
  const [detail, setDetail] = useState<CampaignStatsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadData = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const { campaigns: list } = await api.getCampaigns();
        setCampaigns(list);

        if (list.length === 0) {
          setSelectedId(null);
          setDetail(null);
          setLastUpdated(new Date().toLocaleTimeString());
          return;
        }

        // Keep currently selected campaign if still valid, else pick query param or newest
        const activeId =
          selectedId && list.some((c) => c.id === selectedId)
            ? selectedId
            : queryCampaignId && list.some((c) => c.id === queryCampaignId)
            ? queryCampaignId
            : list[0].id;

        if (activeId !== selectedId) {
          setSelectedId(activeId);
        }

        const statsResponse = await api.getCampaignStats(activeId);
        setDetail(statsResponse);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load campaign stats.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedId, queryCampaignId]
  );

  // Initial load + reload when user picks another campaign
  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  // Poll every 5 seconds while auto-refresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void loadData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const stats = detail?.stats ?? { total: 0, sent: 0, failed: 0, pending: 0 };
  const sentPct = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;
  const pendingPct =
    stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0;
  const failedPct =
    stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Page Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-white/[0.07]">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
            Delivery Monitor
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100 mt-1">
            Campaign Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {campaigns.length > 0 && (
            <select
              aria-label="Select campaign"
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="h-8 rounded-md bg-[#121215] border border-white/[0.1] px-2.5 text-[13px] text-zinc-200 focus:outline-none focus:border-white/30"
            >
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  #{campaign.id} · {campaign.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setAutoRefresh((prev) => !prev)}
            className="btn-secondary h-8 px-2.5 rounded-md text-[12px] font-mono inline-flex items-center gap-1.5 cursor-pointer"
          >
            {autoRefresh ? (
              <>
                <Pause className="h-3.5 w-3.5 text-emerald-400" />
                Live · 5s
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 text-zinc-400" />
                Paused
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="btn-secondary h-8 px-2.5 rounded-md text-[12px] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-4">
          <div className="surface-panel rounded-lg h-32 animate-pulse" />
          <div className="surface-panel rounded-lg h-64 animate-pulse" />
        </div>
      ) : !detail ? (
        /* Clean empty state */
        <div className="surface-panel rounded-lg p-10 text-center">
          <p className="text-sm font-medium text-zinc-200">
            No campaigns queued yet
          </p>
          <p className="text-[13px] text-zinc-500 mt-1 max-w-md mx-auto">
            Upload a CSV of leads, create a template with placeholders, and launch
            your first campaign to watch the background worker process the queue.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2.5">
            <Link
              href="/leads"
              className="btn-secondary px-3.5 py-2 rounded-md text-[13px] font-medium"
            >
              Upload Leads
            </Link>
            <Link
              href="/campaigns"
              className="btn-primary px-3.5 py-2 rounded-md text-[13px] font-medium inline-flex items-center gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              Start Campaign
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Campaign Metadata Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-zinc-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-zinc-200 font-medium">
                {detail.campaign.name}
              </span>
              <span className="text-zinc-600">·</span>
              <span>
                Template:{' '}
                <span className="text-zinc-300">
                  {detail.campaign.template_name}
                </span>
              </span>
              <span className="text-zinc-600">·</span>
              <span className="font-mono uppercase text-[11px] px-2 py-0.5 rounded bg-white/[0.05] text-zinc-300 border border-white/[0.08]">
                {detail.campaign.status}
              </span>
            </div>
            {lastUpdated && (
              <span className="font-mono text-[11px] text-zinc-500">
                Synced {lastUpdated}
              </span>
            )}
          </div>

          {/* Unified Telemetry Ledger (Asymmetric 4-cell strip + segmented bar) */}
          <section className="surface-panel rounded-lg overflow-hidden">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.07]">
              {/* Total */}
              <div className="p-5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                  Total Queued
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold tabular-nums text-zinc-100">
                  {stats.total}
                </div>
                <div className="mt-1 text-[12px] text-zinc-500">
                  10 emails / min batch
                </div>
              </div>

              {/* Sent */}
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                    Sent
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400">
                    {sentPct}%
                  </span>
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold tabular-nums text-emerald-400">
                  {stats.sent}
                </div>
                <div className="mt-1 text-[12px] text-zinc-500">
                  Delivered via SMTP
                </div>
              </div>

              {/* Pending */}
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                    Pending
                  </span>
                  <span className="text-[11px] font-mono text-amber-300">
                    {pendingPct}%
                  </span>
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold tabular-nums text-amber-300">
                  {stats.pending}
                </div>
                <div className="mt-1 text-[12px] text-zinc-500">
                  Waiting for cron tick
                </div>
              </div>

              {/* Failed */}
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                    Failed
                  </span>
                  <span className="text-[11px] font-mono text-rose-400">
                    {failedPct}%
                  </span>
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold tabular-nums text-rose-400">
                  {stats.failed}
                </div>
                <div className="mt-1 text-[12px] text-zinc-500">
                  Auto-retries up to 3x
                </div>
              </div>
            </div>

            {/* Segmented delivery progress bar */}
            <div className="h-1.5 w-full bg-white/[0.04] flex overflow-hidden">
              <div
                style={{ width: `${sentPct}%` }}
                className="bg-emerald-400 transition-all duration-300"
              />
              <div
                style={{ width: `${pendingPct}%` }}
                className="bg-amber-400/80 transition-all duration-300"
              />
              <div
                style={{ width: `${failedPct}%` }}
                className="bg-rose-400 transition-all duration-300"
              />
            </div>
          </section>

          {/* Delivery Logs Table */}
          <section className="surface-panel rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between">
              <h2 className="text-[13px] font-medium text-zinc-200">
                Delivery Queue Log
              </h2>
              <span className="text-[11px] font-mono text-zinc-500">
                Showing {detail.logs.length} recipient
                {detail.logs.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[11px] font-mono uppercase tracking-wider text-zinc-500 bg-white/[0.015]">
                    <th className="py-2.5 px-5 font-medium">Recipient</th>
                    <th className="py-2.5 px-4 font-medium">Company</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium">Retries</th>
                    <th className="py-2.5 px-4 font-medium">Sent At</th>
                    <th className="py-2.5 px-5 font-medium">Last Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] text-[13px]">
                  {detail.logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-5">
                        <div className="font-medium text-zinc-200">
                          {log.lead_name}
                        </div>
                        <div className="font-mono text-[12px] text-zinc-500">
                          {log.lead_email}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {log.lead_company || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusPill status={log.status} />
                      </td>
                      <td className="py-3 px-4 font-mono text-[12px] text-zinc-400 tabular-nums">
                        {log.retry_count}/3
                      </td>
                      <td className="py-3 px-4 font-mono text-[12px] text-zinc-400 whitespace-nowrap">
                        {formatTimestamp(log.sent_at)}
                      </td>
                      <td className="py-3 px-5 text-[12px] text-rose-300/90 max-w-xs truncate">
                        {log.error_message || (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="surface-panel rounded-lg h-48 animate-pulse" />
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
