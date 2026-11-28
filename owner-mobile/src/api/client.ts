// ============================================================================
// StayNest PG Owner Mobile App API Client
// Connects to Live Render Backend
// ============================================================================

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || 'https://staynest-6ylx.onrender.com/api/v1';

let authToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

// Deduplicate concurrent GETs and cache identical GETs briefly (8s) to avoid redundant API storms across mounted tabs
const GET_CACHE_TTL_MS = 8000;
const inFlightGets = new Map<string, Promise<any>>();
const recentGetCache = new Map<string, { data: any; ts: number }>();

export const clearApiGetCache = () => {
  recentGetCache.clear();
};

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (!token) {
    recentGetCache.clear();
    inFlightGets.clear();
  }
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

  const isRealJwt = Boolean(
    authToken &&
      !authToken.startsWith('mock-jwt-token') &&
      !authToken.startsWith('live-session-token-')
  );

  if (isRealJwt && authToken) {
    defaultHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheKey = `${authToken || 'anon'}:${url}`;

  if (!isGet) {
    // Any mutation invalidates recent GET cache so next read is fresh from DB
    recentGetCache.clear();
  } else {
    const cached = recentGetCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < GET_CACHE_TTL_MS) {
      return cached.data as T;
    }
    const existing = inFlightGets.get(cacheKey);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  // 75-second timeout to accommodate Render free tier server cold starts
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 75000);

  console.log(`🌐 [Backend API Call] ${method} ${url}`);

  const requestPromise = (async (): Promise<T> => {
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
        if (
          response.status === 401 &&
          isRealJwt &&
          !endpoint.startsWith('/auth/') &&
          !endpoint.startsWith('/owner/subscription')
        ) {
          onUnauthorizedCallback?.();
        }
        const errorMsg = data?.message || data?.error || `HTTP error ${response.status}`;
        throw new Error(errorMsg);
      }

      if (isGet) {
        recentGetCache.set(cacheKey, { data, ts: Date.now() });
      }
      return data as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Server request timed out. Please try again.');
      }
      throw err;
    } finally {
      if (isGet) {
        inFlightGets.delete(cacheKey);
      }
    }
  })();

  if (isGet) {
    inFlightGets.set(cacheKey, requestPromise);
  }

  return requestPromise;
}
