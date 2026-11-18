'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { api, Template } from '@/lib/api';
import { renderTemplatePreview } from '@/lib/renderTemplate';

const DEFAULT_SUBJECT = 'Quick note for {{company}}';
const DEFAULT_BODY = `Hi {{name}},

I noticed what the team at {{company}} is building and wanted to share a quick idea.

Would you be open to a 10-minute chat this week?

Best,
Mailqueue Team`;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);

  // Sample lead values used strictly for the live preview pane
  const [previewName, setPreviewName] = useState('Priya Nair');
  const [previewCompany, setPreviewCompany] = useState('Veridian Cloud');
  const [previewEmail, setPreviewEmail] = useState('priya@veridiancloud.dev');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function fetchTemplates() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTemplates();
      setTemplates(data.templates);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load templates.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchTemplates();
  }, []);

  function startNewTemplate() {
    setEditingId(null);
    setName('');
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    setError(null);
    setStatusMessage(null);
  }

  function selectTemplate(template: Template) {
    setEditingId(template.id);
    setName(template.name);
    setSubject(template.subject);
    setBody(template.body);
    setError(null);
    setStatusMessage(null);
  }

  function insertPlaceholder(token: string) {
    setBody((prev) => `${prev}${prev.endsWith(' ') || prev === '' ? '' : ' '}${token}`);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setStatusMessage(null);

      if (editingId) {
        const { template } = await api.updateTemplate(editingId, {
          name,
          subject,
          body,
        });
        setStatusMessage(`Updated template "${template.name}".`);
      } else {
        const { template } = await api.createTemplate({ name, subject, body });
        setEditingId(template.id);
        setStatusMessage(`Created template "${template.name}".`);
      }

      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      setError(null);
      setStatusMessage(null);
      await api.deleteTemplate(id);
      if (editingId === id) {
        startNewTemplate();
      }
      setStatusMessage('Template deleted.');
      await fetchTemplates();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete template.'
      );
    }
  }

  const previewVariables = {
    name: previewName,
    company: previewCompany,
    email: previewEmail,
  };

  const renderedSubject = renderTemplatePreview(subject, previewVariables);
  const renderedBody = renderTemplatePreview(body, previewVariables);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-white/[0.07]">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
            Message Blueprints
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100 mt-1">
            Templates
          </h1>
        </div>
        <button
          type="button"
          onClick={startNewTemplate}
          className="btn-secondary h-8 px-3 rounded-md text-[12px] inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          New Template
        </button>
      </div>

      {/* Feedback banners */}
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {statusMessage && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-[13px] text-emerald-300">
          {statusMessage}
        </div>
      )}

      {/* Saved Templates Strip */}
      <section className="surface-panel rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-500">
            Saved Templates ({templates.length})
          </h2>
          {editingId && (
            <span className="text-[11px] font-mono text-zinc-400">
              Editing #{editingId}
            </span>
          )}
        </div>

        {loading ? (
          <div className="h-12 rounded bg-white/[0.03] animate-pulse" />
        ) : templates.length === 0 ? (
          <p className="text-[13px] text-zinc-500">
            No saved templates yet. Create your first one below.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => {
              const selected = editingId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  className={`inline-flex items-center rounded-md border text-[13px] transition-colors ${
                    selected
                      ? 'bg-[#18181b] border-white/25 text-zinc-100'
                      : 'bg-[#0c0c0f] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/15'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectTemplate(tpl)}
                    className="px-3 py-1.5 cursor-pointer text-left"
                  >
                    <span className="font-mono text-[11px] text-zinc-500 mr-1.5">
                      #{tpl.id}
                    </span>
                    {tpl.name}
                  </button>
                  <button
                    type="button"
                    title="Delete template"
                    onClick={() => void handleDelete(tpl.id)}
                    className="px-2 py-1.5 text-zinc-500 hover:text-rose-400 border-l border-white/[0.07] cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Split-Pane Editor + Live Email Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Template Editor */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-6 surface-panel rounded-lg p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-medium text-zinc-100">
              {editingId ? 'Edit Template' : 'Create Template'}
            </h2>
            <div className="flex items-center gap-1.5">
              {['{{name}}', '{{company}}', '{{email}}'].map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => insertPlaceholder(token)}
                  className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] font-mono text-[11px] text-zinc-300 cursor-pointer transition-colors"
                >
                  +{token}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] text-zinc-400">
              Template Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 Product Outreach"
              className="w-full h-9 px-3 rounded-md bg-[#0c0c0f] border border-white/[0.1] text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] text-zinc-400">
              Email Subject
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Quick note for {{company}}"
              className="w-full h-9 px-3 rounded-md bg-[#0c0c0f] border border-white/[0.1] text-[13px] font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] text-zinc-400">
              Email Body
            </label>
            <textarea
              required
              rows={9}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-3 rounded-md bg-[#0c0c0f] border border-white/[0.1] text-[13px] font-mono text-zinc-100 leading-relaxed focus:outline-none focus:border-white/30 resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {editingId && (
              <button
                type="button"
                onClick={startNewTemplate}
                className="btn-secondary h-9 px-3.5 rounded-md text-[13px] cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="btn-primary h-9 px-4 rounded-md text-[13px] font-medium cursor-pointer disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : editingId
                ? 'Save Changes'
                : 'Create Template'}
            </button>
          </div>
        </form>

        {/* Right: Realistic Live Email Client Preview */}
        <div className="lg:col-span-6 surface-panel rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.07] bg-white/[0.015] flex items-center justify-between">
            <span className="text-[12px] font-mono uppercase tracking-wider text-zinc-400">
              Live Rendered Preview
            </span>
            <span className="text-[11px] font-mono text-zinc-500">
              renderTemplate()
            </span>
          </div>

          {/* Sample data controls so user can test placeholders */}
          <div className="px-5 py-3 border-b border-white/[0.06] grid grid-cols-2 gap-2.5 bg-[#0c0c0f]">
            <div>
              <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1">
                Sample {'{{name}}'}
              </label>
              <input
                type="text"
                value={previewName}
                onChange={(e) => setPreviewName(e.target.value)}
                className="w-full h-7 px-2 rounded bg-[#121215] border border-white/[0.08] text-[12px] text-zinc-200 focus:outline-none focus:border-white/25"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1">
                Sample {'{{company}}'}
              </label>
              <input
                type="text"
                value={previewCompany}
                onChange={(e) => setPreviewCompany(e.target.value)}
                className="w-full h-7 px-2 rounded bg-[#121215] border border-white/[0.08] text-[12px] text-zinc-200 focus:outline-none focus:border-white/25"
              />
            </div>
          </div>

          {/* Email header metadata */}
          <div className="px-5 py-3.5 border-b border-white/[0.06] space-y-1.5 text-[12px]">
            <div className="flex gap-3">
              <span className="w-16 text-zinc-500 font-mono">From</span>
              <span className="text-zinc-300 font-mono">
                no-reply@campaigner.local
              </span>
            </div>
            <div className="flex gap-3">
              <span className="w-16 text-zinc-500 font-mono">To</span>
              <span className="text-zinc-300 font-mono">
                {previewName || 'Lead'} &lt;{previewEmail}&gt;
              </span>
            </div>
            <div className="flex gap-3 pt-1">
              <span className="w-16 text-zinc-500 font-mono">Subject</span>
              <span className="text-zinc-100 font-medium">
                {renderedSubject || '(empty subject)'}
              </span>
            </div>
          </div>

          {/* Rendered body */}
          <div className="p-5 min-h-[240px] text-[13px] text-zinc-200 whitespace-pre-wrap leading-relaxed">
            {renderedBody || (
              <span className="text-zinc-600">(empty body)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
