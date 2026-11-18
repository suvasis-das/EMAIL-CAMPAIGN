'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Search,
  Upload,
} from 'lucide-react';
import { api, Lead, UploadLeadsResponse } from '@/lib/api';

const SAMPLE_CSV = `name,email,company
Aarav Mehta,aarav.mehta@northstarlabs.io,Northstar Labs
Priya Nair,priya@veridiancloud.dev,Veridian Cloud
Daniel Brooks,dbrooks@kestrelpay.com,Kestrel Pay
Sana Kapoor,sana.kapoor@harborline.co,Harborline
`;

export default function LeadsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadLeadsResponse | null>(
    null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function fetchLeads() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getLeads();
      setLeads(data.leads);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchLeads();
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setError('Select a .csv file before uploading.');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setUploadResult(null);

      const summary = await api.uploadLeadsCsv(selectedFile);
      setUploadResult(summary);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await fetchLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function downloadSampleCsv() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample-leads.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const filteredLeads = leads.filter((lead) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      lead.name.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      lead.company.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-white/[0.07]">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
            Audience Directory
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100 mt-1">
            Leads
          </h1>
        </div>
        <button
          type="button"
          onClick={downloadSampleCsv}
          className="btn-secondary h-8 px-3 rounded-md text-[12px] inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-zinc-400" />
          Download sample CSV
        </button>
      </div>

      {/* Asymmetric Upload + Schema Reference Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form
          onSubmit={handleUpload}
          className="lg:col-span-7 surface-panel rounded-lg p-5 space-y-4"
        >
          <div>
            <h2 className="text-[14px] font-medium text-zinc-100">
              Import CSV Contacts
            </h2>
            <p className="text-[12px] text-zinc-500 mt-0.5">
              Duplicate email addresses are automatically skipped via MySQL{' '}
              <code className="font-mono text-zinc-400">INSERT IGNORE</code>.
            </p>
          </div>

          <label className="surface-inset rounded-md p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-white/20 transition-colors">
            <Upload className="h-5 w-5 text-zinc-400 mb-2" strokeWidth={1.75} />
            <span className="text-[13px] font-medium text-zinc-200">
              {selectedFile ? selectedFile.name : 'Choose a CSV file to upload'}
            </span>
            <span className="text-[11px] font-mono text-zinc-500 mt-1">
              {selectedFile
                ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                : 'Max 5 MB · UTF-8 .csv'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </label>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="btn-primary h-9 px-4 rounded-md text-[13px] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploading ? 'Importing...' : 'Upload Leads'}
            </button>
          </div>
        </form>

        {/* Concrete CSV Spec Card */}
        <div className="lg:col-span-5 surface-panel rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-[14px] font-medium text-zinc-100">
              Expected CSV Columns
            </h2>
            <p className="text-[12px] text-zinc-500 mt-0.5">
              Headers are matched case-insensitively. <code className="font-mono text-zinc-400">company</code> is optional.
            </p>
            <pre className="surface-inset rounded-md p-3.5 mt-3 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
{`name,email,company
Aarav Mehta,aarav@northstar.io,Northstar Labs
Priya Nair,priya@veridian.dev,Veridian Cloud`}
            </pre>
          </div>
          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>Unique constraint: leads.email</span>
            <span>Endpoint: POST /leads/upload</span>
          </div>
        </div>
      </div>

      {/* Upload Result Banner */}
      {uploadResult && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-300 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{uploadResult.message}</span>
          </div>
          <div className="font-mono text-[12px] flex items-center gap-4">
            <span>Inserted: {uploadResult.inserted}</span>
            <span>Duplicates skipped: {uploadResult.skippedDuplicates}</span>
            <span>Invalid: {uploadResult.invalidRows}</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Leads Table */}
      <section className="surface-panel rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[13px] font-medium text-zinc-200">
              Stored Leads
            </h2>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/[0.05] text-zinc-400">
              {leads.length}
            </span>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter name, email, company..."
              className="h-8 pl-8 pr-3 rounded-md bg-[#0c0c0f] border border-white/[0.09] text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/25 w-full sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-2.5">
            {[1, 2, 3, 4].map((row) => (
              <div
                key={row}
                className="h-9 rounded bg-white/[0.03] animate-pulse"
              />
            ))}
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-zinc-500">
            {leads.length === 0
              ? 'No leads yet. Upload a CSV above to populate your audience.'
              : 'No leads match your search filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] font-mono uppercase tracking-wider text-zinc-500 bg-white/[0.015]">
                  <th className="py-2.5 px-5 font-medium">ID</th>
                  <th className="py-2.5 px-4 font-medium">Name</th>
                  <th className="py-2.5 px-4 font-medium">Email</th>
                  <th className="py-2.5 px-4 font-medium">Company</th>
                  <th className="py-2.5 px-5 font-medium">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-[13px]">
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-5 font-mono text-[12px] text-zinc-500 tabular-nums">
                      #{lead.id}
                    </td>
                    <td className="py-3 px-4 font-medium text-zinc-200">
                      {lead.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-[12px] text-zinc-300">
                      {lead.email}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">
                      {lead.company || '—'}
                    </td>
                    <td className="py-3 px-5 font-mono text-[12px] text-zinc-500 whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
