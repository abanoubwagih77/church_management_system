import { handleLocalApiFallback, loadLocalDb } from './localFallback.js';

const TOKEN_KEY = 'church_admin_token';
const CHURCH_ID_KEY = 'active_church_id';
const CHURCH_DATA_KEY = 'active_church_data';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CHURCH_ID_KEY);
  localStorage.removeItem(CHURCH_DATA_KEY);
}

export function getActiveChurchId(): string | null {
  return localStorage.getItem(CHURCH_ID_KEY);
}

export function setActiveChurchId(id: string | null): void {
  if (id) {
    localStorage.setItem(CHURCH_ID_KEY, id);
  } else {
    localStorage.removeItem(CHURCH_ID_KEY);
  }
}

export function getCachedChurchData<T = any>(): T | null {
  try {
    const raw = localStorage.getItem(CHURCH_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedChurchData(church: any | null): void {
  try {
    if (church) {
      localStorage.setItem(CHURCH_DATA_KEY, JSON.stringify(church));
      if (church.id) {
        localStorage.setItem(CHURCH_ID_KEY, church.id);
      }
    } else {
      localStorage.removeItem(CHURCH_DATA_KEY);
      localStorage.removeItem(CHURCH_ID_KEY);
    }
  } catch {
    // ignore
  }
}

// Storage cache cleanup helper for legacy cross-church cache
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    // Clear old monolithic single-church cache keys that caused cross-church data resurrection
    localStorage.removeItem('st_george_local_church_db_v1');
    localStorage.removeItem('st_george_local_church_db_v2');
  }
} catch {
  // ignore
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const activeChurchId = getActiveChurchId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (activeChurchId) {
    headers['x-church-id'] = activeChurchId;
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    // If server responds with 405/502/504 or HTML 404 (e.g. static hosting where backend is missing)
    const isHtml = response.headers.get('content-type')?.includes('text/html');
    if ((response.status === 404 && isHtml) || response.status === 405 || response.status === 502 || response.status === 504) {
      return (await handleLocalApiFallback(endpoint, options)) as T;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // If unauthorized or specific database crash error on static/lambda host
      if (response.status === 500 && (data.error?.includes('database') || !data.error)) {
        return (await handleLocalApiFallback(endpoint, options)) as T;
      }
      const errorMessage = data.error || `HTTP Error ${response.status}: ${response.statusText}`;
      const apiErr: any = new Error(errorMessage);
      apiErr.isApiError = true;
      throw apiErr;
    }

    return data as T;
  } catch (err: any) {
    if (err && err.isApiError) {
      throw err;
    }
    // If network error (e.g. offline or failed to fetch on static host)
    console.warn(`Network or API exception on ${endpoint}. Using local fallback:`, err.message);
    return (await handleLocalApiFallback(endpoint, options)) as T;
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
