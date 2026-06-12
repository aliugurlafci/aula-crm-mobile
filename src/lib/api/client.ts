/**
 * Mobile API client — the React-Native counterpart of the web Frontend's
 * `lib/api-client.ts`. Differences for mobile:
 *   - base URL is configurable at runtime (dev server / LAN IP / prod), persisted
 *     in SecureStore so a device can reach the backend.
 *   - authenticates with `Authorization: Bearer <jwt>` (the backend checks the
 *     bearer header first; see Backend/src/lib/security/auth-config.ts).
 *   - CSRF: the backend only enforces the double-submit token when a cookie is
 *     present. React Native's native cookie jar resends `aula_csrf`, so we capture
 *     its value from the login `Set-Cookie` header (RN exposes set-cookie, unlike
 *     browsers) and echo it as `x-csrf-token` on mutations.
 *
 * Errors are thrown as {@link ApiRequestError} carrying the backend's structured
 * `{ code, message, details }` envelope.
 */
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

export interface FieldDetail {
  field?: string;
  message: string;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details: FieldDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  /** True for transport failures (offline / unreachable host) — safe to retry. */
  get isNetwork(): boolean {
    return this.status === 0 || this.code === 'NETWORK';
  }

  /** True when the server rejected the request itself (do not blindly retry). */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details) if (d.field) out[d.field] = d.message;
    return out;
  }
}

const BASE_URL_KEY = 'aula.api.baseUrl';
const DEFAULT_BASE_URL =
  (Constants.expoConfig?.extra as { defaultApiBaseUrl?: string } | undefined)?.defaultApiBaseUrl ??
  'http://localhost:4000';

// ---- runtime state (set by AuthProvider / Settings) -----------------------
let baseUrl = DEFAULT_BASE_URL;
let bearerToken: string | null = null;
let csrfToken: string | null = null;
/** Session JWT scraped from a login `Set-Cookie` (email/password path, where the
 *  token isn't in the response body). Consumed once by the AuthProvider. */
let capturedSessionToken: string | null = null;

export function getBaseUrl(): string {
  return baseUrl;
}

export async function loadBaseUrl(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(BASE_URL_KEY);
    if (stored) baseUrl = stored;
  } catch {
    /* ignore */
  }
  return baseUrl;
}

export async function setBaseUrl(url: string): Promise<void> {
  baseUrl = normalizeBaseUrl(url);
  try {
    await SecureStore.setItemAsync(BASE_URL_KEY, baseUrl);
  } catch {
    /* ignore */
  }
}

export function setAuthToken(token: string | null): void {
  bearerToken = token;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Extract `aula_csrf` (+ the `aula_session` JWT, if present) from a Set-Cookie
 *  header. RN — unlike browsers — exposes set-cookie to JS, which lets the
 *  email/password login recover its bearer token from the session cookie. */
export function captureCookiesFromSetCookie(setCookie: string | null): void {
  if (!setCookie) return;
  const csrf = setCookie.match(/aula_csrf=([^;,\s]+)/);
  if (csrf) csrfToken = decodeURIComponent(csrf[1]);
  const session = setCookie.match(/aula_session=([^;,\s]+)/);
  if (session && session[1]) capturedSessionToken = decodeURIComponent(session[1]);
}

/** Consume the session token scraped from the last login response (or null). */
export function takeCapturedSessionToken(): string | null {
  const t = capturedSessionToken;
  capturedSessionToken = null;
  return t;
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Aborts after this many ms (default 20s; sales mutations override shorter). */
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Perform an authenticated API call against `${baseUrl}/api/v1${path}`.
 * Returns the parsed JSON body, or throws {@link ApiRequestError}.
 */
export async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...opts.headers,
  };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (bearerToken) headers['authorization'] = `Bearer ${bearerToken}`;
  const mutating = method !== 'GET';
  if (mutating && csrfToken) headers['x-csrf-token'] = csrfToken;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', () => controller.abort());
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new ApiRequestError(
      aborted ? 'TIMEOUT' : 'NETWORK',
      0,
      aborted ? 'Request timed out' : 'Network unavailable',
    );
  }
  clearTimeout(timeout);

  // Capture the CSRF (+ session) cookies the server may set on any response.
  captureCookiesFromSetCookie(res.headers.get('set-cookie'));

  const text = await res.text().catch(() => '');
  let json: unknown = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = {};
    }
  }

  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string; details?: FieldDetail[] } }).error;
    throw new ApiRequestError(
      err?.code ?? 'ERROR',
      res.status,
      err?.message ?? `Request failed (${res.status})`,
      err?.details ?? [],
    );
  }
  return json as T;
}
