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
import { Platform } from 'react-native';

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

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

/** Host serving the JS bundle — e.g. "192.168.1.107:8081" under `expo start`. */
function metroHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    null;
  return hostUri?.split('/')[0]?.split(':')[0] ?? null;
}

/**
 * Repair a base URL whose host cannot possibly be the backend.
 *
 * `http://localhost:4000` means "this machine". In a browser that is the dev
 * machine, so it works — but on a phone it is the phone and on the Android
 * emulator it is the emulator, and the app spends every request talking to
 * itself. It then reports "network unavailable", which reads exactly like a
 * backend that is down.
 *
 * The machine serving the JS bundle is the one running the API, so a loopback
 * host is swapped for Metro's host. Keying off Metro rather than a
 * simulator-vs-device check keeps this correct in every combination: when Metro
 * reports a LAN address, that address is reachable from the simulator and the
 * phone alike; when it reports loopback (web, or a tunnelled/adb-reversed
 * setup), loopback is genuinely right and nothing is touched. It also survives
 * the router handing out a new address, which a hardcoded IP does not. Any
 * non-loopback host — LAN, staging, production — is left alone.
 */
function repairUnreachableHost(url: string): string {
  const match = url.match(/^(https?:\/\/)([^/:]+)(:\d+)?$/);
  if (!match) return url;
  const [, scheme, host, port = ''] = match;
  if (!LOOPBACK.has(host.toLowerCase())) return url;
  if (Platform.OS === 'web') return url; // the browser IS on the dev machine

  const detected = metroHost();
  if (detected && !LOOPBACK.has(detected.toLowerCase())) return `${scheme}${detected}${port}`;
  // Android emulator reaches its host machine's loopback only through 10.0.2.2.
  if (Platform.OS === 'android') return `${scheme}10.0.2.2${port}`;
  return url;
}

/** Effective default backend URL: `extra.defaultApiBaseUrl`, host-repaired. */
export function getDefaultBaseUrl(): string {
  return repairUnreachableHost(
    normalizeBaseUrl(
      (Constants.expoConfig?.extra as { defaultApiBaseUrl?: string } | undefined)?.defaultApiBaseUrl ??
        'http://localhost:4000',
    ),
  );
}

// ---- runtime state (set by AuthProvider / Settings) -----------------------
let baseUrl = getDefaultBaseUrl();
let bearerToken: string | null = null;
let csrfToken: string | null = null;
/** Session JWT scraped from a login `Set-Cookie` (email/password path, where the
 *  token isn't in the response body). Consumed once by the AuthProvider. */
let capturedSessionToken: string | null = null;

export function getBaseUrl(): string {
  return baseUrl;
}

/**
 * The stored override wins over the default — but it is repaired the same way,
 * because it is the likelier place for an unreachable host to hide: SecureStore
 * survives reinstalls, so a `localhost` typed once on a simulator keeps the app
 * offline forever afterwards on real hardware, no matter what the code defaults
 * to. The raw value is left on disk; only what we dial is corrected.
 */
export async function loadBaseUrl(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(BASE_URL_KEY);
    if (stored) baseUrl = repairUnreachableHost(normalizeBaseUrl(stored));
  } catch {
    /* ignore */
  }
  return baseUrl;
}

export async function setBaseUrl(url: string): Promise<void> {
  const entered = normalizeBaseUrl(url);
  baseUrl = repairUnreachableHost(entered);
  try {
    await SecureStore.setItemAsync(BASE_URL_KEY, entered);
  } catch {
    /* ignore */
  }
}

/**
 * Drop the stored override and go back to the detected default. The override
 * lives in SecureStore, which survives a reinstall — so a URL saved on an old
 * network (or an old dev machine) keeps the app pointed at a dead host with no
 * way back except retyping it. This is that way back.
 */
export async function resetBaseUrl(): Promise<string> {
  try {
    await SecureStore.deleteItemAsync(BASE_URL_KEY);
  } catch {
    /* ignore */
  }
  baseUrl = getDefaultBaseUrl();
  return baseUrl;
}

/** Probe `/health` on a URL without touching the client's own state — used by
 *  Settings to tell "wrong URL" apart from "backend down" before saving. */
export async function pingBaseUrl(url: string, timeoutMs = 5_000): Promise<{ ok: boolean; status: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${normalizeBaseUrl(url)}/api/v1/health`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return { ok: false, status: 0, error: aborted ? 'TIMEOUT' : 'NETWORK' };
  } finally {
    clearTimeout(timer);
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
