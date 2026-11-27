// ============================================================================
// StayNest PG Owner Mobile App API Client
// Connects to Live Render Backend
// ============================================================================

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || 'https://staynest-6ylx.onrender.com/api/v1';

let authToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

export const setOnUnauthorizedHandler = (cb: (() => void) | null) => {
  onUnauthorizedCallback = cb;
};

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken && !authToken.startsWith('mock-jwt-token')) {
    defaultHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  // 75-second timeout to accommodate Render free tier server cold starts
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 75000);

  const method = options.method || 'GET';
  console.log(`🌐 [Backend API Call] ${method} ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);
    console.log(`✅ [Backend API Response ${response.status}] ${method} ${endpoint}`);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        onUnauthorizedCallback?.();
      }
      const errorMsg = data?.message || data?.error || `HTTP error ${response.status}`;
      throw new Error(errorMsg);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Server request timed out. Please try again.');
    }
    throw err;
  }
}
