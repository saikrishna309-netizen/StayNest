// ============================================================================
// StayNest HTTP API Client with JWT Interceptors
// ============================================================================

export const API_BASE = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && (window.location.origin.includes(':8080') || window.location.origin.includes(':3000') || window.location.origin.includes(':5173'))
    ? '/api/v1'
    : 'https://staynest-6ylx.onrender.com/api/v1');

if (typeof window !== 'undefined' && !import.meta.env.VITE_API_URL && window.location.hostname.includes('vercel.app')) {
  console.warn('[StayNest] VITE_API_URL is missing in Vercel! Please set VITE_API_URL in Vercel Settings -> Environment Variables to your Render backend URL (e.g. https://staynest-backend.onrender.com/api/v1).');
}

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, any>;
}

export async function apiClient<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { params, headers, ...customConfig } = options;

  let url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const query = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    if (query) url += `${url.includes('?') ? '&' : '?'}${query}`;
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('staynest_token') : null;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...customConfig,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  };

  const response = await fetch(url, config);

  if (response.status === 401) {
    // Unauthorized: token might be expired
    if (typeof window !== 'undefined') {
      localStorage.removeItem('staynest_token');
      localStorage.removeItem('staynest_user');
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `HTTP error ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

