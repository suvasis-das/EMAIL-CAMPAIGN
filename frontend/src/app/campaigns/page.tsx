'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { api, Campaign, Template } from '@/lib/api';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [leadCount, setLeadCount] = useState<number>(0);

  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState<number | ''>('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);

      const [campaignsRes, templatesRes, leadsRes] = await Promise.all([
        api.getCampaigns(),
        api.getTemplates(),
        api.getLeads(),
      ]);

      setCampaigns(campaignsRes.campaigns);
      setTemplates(templatesRes.templates);
      setLeadCount(leadsRes.leads.length);

      if (templatesRes.templates.length > 0 && templateId === '') {
        setTemplateId(templatesRes.templates[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load campaign data.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStartCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!templateId) {
      setError('Please select a template.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const { campaign } = await api.createCampaign({
        name,
        template_id: Number(templateId),
      });

      setName('');
      setSuccess(
        `Campaign "${campaign.name}" created — ${campaign.queued_emails} emails queued for the worker.`
      );
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to start campaign.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedTemplate = templates.find((t) => t.id === Number(templateId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-white/[0.07]">
        <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
          Queue Orchestration
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100 mt-1">
          Campaigns
        </h1>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Start Campaign Form */}
        <form
          onSubmit={handleStartCampaign}
          className="lg:col-span-5 surface-panel rounded-lg p-5 space-y-4"
        >
          <div>
            <h2 className="text-[14px] font-medium text-zinc-100">
              Start a Campaign
            </h2>
            <p className="text-[12px] text-zinc-500 mt-0.5">
              Creates a campaign and queues one pending email per lead inside a
              MySQL transaction.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] text-zinc-400">
              Campaign Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. November Product Update"
              className="w-full h-9 px-3 rounded-md bg-[#0c0c0f] border border-white/[0.1] text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] text-zinc-400">Template</label>
            {templates.length === 0 && !loading ? (
              <div className="surface-inset rounded-md p-3 text-[12px] text-zinc-400">
                No templates found.{' '}
                <Link href="/templates" className="text-zinc-200 underline">
                  Create a template first
                </Link>
                .
              </div>
            ) : (
              <select
                value={templateId}
                onChange={(e) => setTemplateId(Number(e.target.value))}
                className="w-full h-9 px-3 rounded-md bg-[#0c0c0f] border border-white/[0.1] text-[13px] text-zinc-100 focus:outline-none focus:border-white/30"
              >
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    #{tpl.id} · {tpl.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Compact preview of the selected template */}
          {selectedTemplate && (
            <div className="surface-inset rounded-md p-3 space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Selected Subject
              </div>
              <div className="text-[12px] font-mono text-zinc-200 truncate">
                {selectedTemplate.subject}
              </div>
              <div className="text-[12px] text-zinc-500 line-clamp-2 pt-1">
                {selectedTemplate.body}
              </div>
            </div>
          )}

          {/* Audience preflight check */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[12px]">
            <span className="text-zinc-500">Recipients to queue</span>
            <span className="font-mono text-zinc-200 tabular-nums">
              {leadCount} lead{leadCount === 1 ? '' : 's'}
            </span>
          </div>

          <button
            type="submit"
            disabled={
              submitting || templates.length === 0 || leadCount === 0
            }
            className="btn-primary w-full h-9 rounded-md text-[13px] font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-3.5 w-3.5" />
            {submitting
              ? 'Queueing Emails...'
              : `Launch Campaign (${leadCount})`}
          </button>

          {!loading && leadCount === 0 && (
            <p className="text-[12px] text-amber-300/90">
              Upload at least one lead on the{' '}
              <Link href="/leads" className="underline">
                Leads
              </Link>{' '}
              page before launching.
            </p>
          )}
        </form>

        {/* Right: Campaign History Table */}
        <section className="lg:col-span-7 surface-panel rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-zinc-200">
              Campaign History
            </h2>
            <span className="font-mono text-[11px] text-zinc-500">
              {campaigns.length} total
            </span>
          </div>

          {loading ? (
            <div className="p-6 space-y-2.5">
              {[1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="h-12 rounded bg-white/[0.03] animate-pulse"
                />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-zinc-500">
              No campaigns launched yet.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {campaigns.map((campaign) => {
                const pct =
                  campaign.stats.total > 0
                    ? Math.round(
                        (campaign.stats.sent / campaign.stats.total) * 100
                      )
                    : 0;

                return (
                  <div
                    key={campaign.id}
                    className="p-4 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-zinc-500">
                          #{campaign.id}
                        </span>
                        <span className="text-[14px] font-medium text-zinc-100 truncate">
                          {campaign.name}
                        </span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-400 border border-white/[0.07]">
                          {campaign.status}
                        </span>
                      </div>
                      <div className="text-[12px] text-zinc-500 mt-1">
                        Template: {campaign.template_name} ·{' '}
                        <span className="font-mono">
                          {new Date(campaign.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right font-mono text-[11px] tabular-nums space-y-1">
                        <div>
                          <span className="text-emerald-400">
                            {campaign.stats.sent} sent
                          </span>{' '}
                          <span className="text-zinc-600">/</span>{' '}
                          <span className="text-amber-300">
                            {campaign.stats.pending} pend
                          </span>{' '}
                          <span className="text-zinc-600">/</span>{' '}
                          <span className="text-rose-400">
                            {campaign.stats.failed} fail
                          </span>
                        </div>
                        <div className="w-36 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-emerald-400"
                          />
                        </div>
                      </div>

                      <Link
                        href={`/?campaignId=${campaign.id}`}
                        className="btn-secondary h-8 px-2.5 rounded-md text-[12px] inline-flex items-center gap-1"
                      >
                        Stats
                        <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
