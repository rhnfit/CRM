const AUTH_FLAG_KEY = 'rhn_auth';

export function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_FLAG_KEY) ?? '1';
}

export function setToken(token: string) {
  localStorage.setItem(AUTH_FLAG_KEY, token || '1');
}

export function clearToken() {
  localStorage.removeItem(AUTH_FLAG_KEY);
}

async function tryRefreshSession(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return false;
    setToken('1');
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const doRequest = () =>
    fetch(`${getApiBase()}/api${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });

  let res: Response;
  try {
    res = await doRequest();
  } catch (e) {
    const base = getApiBase();
    if (e instanceof TypeError && String(e.message).includes('fetch')) {
      throw new Error(
        `Cannot reach API at ${base}. Start the backend (npm run start:dev in /backend, port 4000) and keep this URL in .env.local as NEXT_PUBLIC_API_URL.`,
      );
    }
    throw e;
  }
  if (res.status === 401 && !path.startsWith('/auth/refresh') && !path.startsWith('/auth/login')) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      res = await doRequest();
    } else {
      clearToken();
    }
  }

  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      if (typeof j.message === 'string') message = j.message;
      if (Array.isArray(j.message)) message = j.message.join(', ');
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${getApiBase()}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    clearToken();
  }
}

export const ADMIN_ROLES = new Set(['DIRECTOR', 'MANAGER', 'SALES_HEAD', 'SUPPORT_HEAD']);

export type MeUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  teamId: string | null;
  managerId: string | null;
  isActive?: boolean;
};
