import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || "";

// ─── Shared safe-defaults normalizer ────────────────────────────────────────
// Guarantees every field is present no matter what the server returns.
// This is the single source of truth for the AnalysisResult shape.
function normalizeAnalysisResult(res: any): any {
  console.log('[apiService] normalizeAnalysisResult input:', res);

  if (!res || typeof res !== 'object') {
    console.warn('[apiService] normalizeAnalysisResult: received non-object, using full defaults.');
    res = {};
  }

  const VALID_VERDICTS = ['REAL', 'FAKE', 'MISLEADING', 'UNVERIFIED'];
  const verdict = VALID_VERDICTS.includes(res.verdict) ? res.verdict : 'UNVERIFIED';
  const confidence = typeof res.confidence === 'number' && isFinite(res.confidence)
    ? Math.max(0, Math.min(100, Math.round(res.confidence)))
    : 50;

  const normalized = {
    verdict,
    confidence,
    explanation: (typeof res.explanation === 'string' && res.explanation.trim())
      ? res.explanation.trim()
      : 'No explanation available.',
    explanation_te: (typeof res.explanation_te === 'string' && res.explanation_te.trim())
      ? res.explanation_te.trim()
      : undefined,
    keyPoints: Array.isArray(res.keyPoints)
      ? res.keyPoints.filter((p: any) => typeof p === 'string' && p.trim()).slice(0, 10)
      : [],
    keyPoints_te: Array.isArray(res.keyPoints_te)
      ? res.keyPoints_te.filter((p: any) => typeof p === 'string' && p.trim()).slice(0, 10)
      : undefined,
    sources: Array.isArray(res.sources)
      ? res.sources
          .filter((s: any) => s && typeof s === 'object')
          .map((s: any) => ({
            title: (typeof s.title === 'string' && s.title.trim()) ? s.title.trim() : 'Verification Node',
            uri: (typeof s.uri === 'string' && s.uri.trim() && s.uri !== '#') ? s.uri.trim() : '#',
            verified: typeof s.verified === 'boolean' ? s.verified : false,
          }))
      : [],
    categories: {
      bias: typeof res.categories?.bias === 'number' && isFinite(res.categories.bias)
        ? Math.max(0, Math.min(100, Math.round(res.categories.bias)))
        : 0,
      sensationalism: typeof res.categories?.sensationalism === 'number' && isFinite(res.categories.sensationalism)
        ? Math.max(0, Math.min(100, Math.round(res.categories.sensationalism)))
        : 0,
      logicalConsistency: typeof res.categories?.logicalConsistency === 'number' && isFinite(res.categories.logicalConsistency)
        ? Math.max(0, Math.min(100, Math.round(res.categories.logicalConsistency)))
        : 50,
    },
    cached: !!res.cached,
    search_count: typeof res.search_count === 'number' ? res.search_count : 0,
  };

  console.log('[apiService] normalizeAnalysisResult output:', normalized);
  return normalized;
}

class ApiService {
  private async getAuthHeader(): Promise<Record<string, string>> {
    // Local development bypass support
    if (localStorage.getItem('admin_bypass') === 'true') {
      return {
        'Authorization': 'Bearer mock-token'
      };
    }

    // Attempt to get our primary Custom JWT token first
    let token = localStorage.getItem('satyakavach_token');
    
    // Fallback to Supabase session (if it exists)
    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token || null;
    }
    
    if (!token) return {};

    return {
      'Authorization': `Bearer ${token}`
    };
  }

  async fetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const headers = await this.getAuthHeader();

    const response = await fetch(`${API_BASE}/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('satyakavach_token');
        window.location.href = '/login';
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API Error: ${response.status}`);
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  // --- Scans ---
  async analyzeText(text: string, forceAI: boolean = false): Promise<any> {
    console.log('[apiService] analyzeText called. Input length:', text?.length, 'forceAI:', forceAI);
    try {
      const rawRes = await this.fetch('/analyze', {
        method: 'POST',
        body: JSON.stringify({ text, forceAI }),
      });
      console.log('[apiService] analyzeText raw response:', rawRes);

      // If backend returned an error object, surface it clearly
      if (rawRes?.error && !rawRes?.verdict) {
        throw new Error(rawRes.error);
      }

      return normalizeAnalysisResult(rawRes);
    } catch (err: any) {
      console.error('[apiService] analyzeText ERROR:', err?.message || err);
      throw err;
    }
  }

  async getHistory() {
    return this.fetch('/history');
  }

  async getHistoryResult(id: string): Promise<any> {
    console.log('[apiService] getHistoryResult called. id:', id);
    try {
      const rawRes = await this.fetch(`/history?id=${id}`);
      console.log('[apiService] getHistoryResult raw response:', rawRes);
      return normalizeAnalysisResult(rawRes);
    } catch (err: any) {
      console.error('[apiService] getHistoryResult ERROR:', err?.message || err);
      throw err;
    }
  }

  async deleteHistory(id: string) {
    return this.fetch(`/history?id=${id}`, {
      method: 'DELETE',
    });
  }

  // --- Admin ---
  async getAdminStats() {
    return this.fetch('/admin/stats');
  }

  async getAllSubmissions(limit = 50) {
    return this.fetch(`/admin/submissions?limit=${limit}`);
  }

  async flagSubmission(id: string, flag: boolean) {
    return this.fetch(`/admin/submissions`, {
      method: 'PATCH',
      body: JSON.stringify({ action: flag ? 'flag' : 'unflag', id }),
    });
  }

  async deleteSubmission(id: string) {
    return this.fetch(`/admin/submissions?id=${id}`, {
      method: 'DELETE',
    });
  }

  // Admin - Users
  async getAdminUsers() {
    return this.fetch('/admin/users');
  }

  async updateUserRole(uid: string, role: string) {
    return this.fetch('/admin/users', {
      method: 'PATCH',
      body: JSON.stringify({ uid, role })
    });
  }

  async updateUserStatus(uid: string, status: string) {
    return this.fetch('/admin/users', {
      method: 'PATCH',
      body: JSON.stringify({ uid, status })
    });
  }

  async deleteUser(uid: string) {
    return this.fetch(`/admin/users?uid=${uid}`, {
      method: 'DELETE'
    });
  }

  // Admin - System
  async getSystemStatus() {
    return this.fetch('/admin/system');
  }
}

export const apiService = new ApiService();
