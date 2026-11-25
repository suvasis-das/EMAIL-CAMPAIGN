/**
 * Typed API client for communicating with the Express backend.
 * Keeping every fetch call here keeps page components clean and easy to read.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface User {
  id: number;
  name: string;
  email: string;
  created_at?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export const TOKEN_STORAGE_KEY = 'mailqueue_auth_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function removeStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export interface Lead {
  id: number;
  name: string;
  email: string;
  company: string;
  created_at: string;
}

export interface UploadLeadsResponse {
  message: string;
  totalRows: number;
  inserted: number;
  skippedDuplicates: number;
  invalidRows: number;
}

export interface Template {
  id: number;
  name: string;
  subject: string;
  body: string;
  created_at: string;
}

export interface CampaignStatsSummary {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

export interface Campaign {
  id: number;
  name: string;
  template_id: number;
  template_name: string;
  status: 'pending' | 'running' | 'completed';
  created_at: string;
  stats: CampaignStatsSummary;
}

export interface EmailLogItem {
  id: number;
  lead_id: number;
  lead_name: string;
  lead_email: string;
  lead_company: string;
  status: 'pending' | 'sent' | 'failed';
  retry_count: number;
  error_message: string | null;
  sent_at: string | null;
}

export interface CampaignStatsResponse {
  campaign: {
    id: number;
    name: string;
    template_id: number;
    template_name: string;
    status: 'pending' | 'running' | 'completed';
    created_at: string;
  };
  stats: CampaignStatsSummary;
  logs: EmailLogItem[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options?.headers);

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export const api = {
  checkHealth: () =>
    request<{ status: string; database: string }>('/health'),

  // Auth
  register: (payload: { name: string; email: string; password: string }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getMe: () => request<{ user: User }>('/auth/me'),

  // Leads
  getLeads: () => request<{ leads: Lead[] }>('/leads'),
  uploadLeadsCsv: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<UploadLeadsResponse>('/leads/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // Templates
  getTemplates: () => request<{ templates: Template[] }>('/templates'),
  createTemplate: (payload: { name: string; subject: string; body: string }) =>
    request<{ template: Template }>('/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateTemplate: (
    id: number,
    payload: { name: string; subject: string; body: string }
  ) =>
    request<{ template: Template }>(`/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteTemplate: (id: number) =>
    request<{ message: string }>(`/templates/${id}`, {
      method: 'DELETE',
    }),

  // Campaigns
  getCampaigns: () => request<{ campaigns: Campaign[] }>('/campaigns'),
  createCampaign: (payload: { name: string; template_id: number }) =>
    request<{
      campaign: {
        id: number;
        name: string;
        template_id: number;
        template_name: string;
        status: string;
        queued_emails: number;
      };
    }>('/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  getCampaignStats: (id: number) =>
    request<CampaignStatsResponse>(`/campaigns/${id}/stats`),
};
