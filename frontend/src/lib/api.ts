import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export const api = {
  async get(path: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async post(path: string, body?: unknown) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async upload(path: string, formData: FormData) {
    const headers = await getAuthHeaders();
    // Don't set Content-Type for multipart — browser sets it with boundary
    delete headers['Content-Type'];
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async adminLogin(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `HTTP ${res.status}`);
    }
    return res.json();
  },
};
