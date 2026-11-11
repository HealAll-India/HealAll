import type { ApiErrorEnvelope, TokenResponse } from "@/lib/types/api";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

interface RequestOptions {
  token?: string;
  data?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** The claims of a JWT, read without verifying its signature; null if malformed. */
function jwtClaims(token: string): { exp?: unknown; sub?: unknown } | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    // base64url → base64
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(json) as { exp?: unknown; sub?: unknown };
  } catch {
    return null;
  }
}

/**
 * The `exp` claim in milliseconds. A cheap client-side gate so we don't fire
 * requests that the backend will reject with 401 anyway. Null means "no
 * expiry info", and the request is sent as is.
 */
function getJwtExpiryMs(token: string): number | null {
  const exp = jwtClaims(token)?.exp;
  return typeof exp === "number" ? exp * 1000 : null;
}

/** The member a token was issued to (its `sub` claim). */
function jwtSubject(token: string): string | null {
  const sub = jwtClaims(token)?.sub;
  return typeof sub === "string" ? sub : null;
}

/** Shown when no response arrives at all (offline, DNS, CORS, the API host is gone). */
export const UNREACHABLE_MESSAGE = "We can't reach HealAll right now. Check your connection and try again.";

/** Shown when something other than the API answers (a proxy or host error page). */
export const UNAVAILABLE_MESSAGE = "HealAll is temporarily unavailable. Please try again in a few minutes.";

/** Renew this long before the access token expires, so a slow request doesn't race it. */
const EXPIRY_SKEW_MS = 30_000;

/** Statuses with which the API refuses to renew: no cookie, an unknown, revoked or expired token, a closed account. */
const SESSION_ENDED_STATUSES = new Set([401, 410]);

/**
 * What the API said when asked to renew. `stored`: the new token went into the
 * auth store. `current`: no sign-in or sign-out happened while it ran, so the
 * refusal is about the session signed in now.
 */
type RefreshResult =
  | { session: TokenResponse; stored: boolean }
  | { ended: true; current: boolean }
  | { error: ApiError };

/** What a request should do about the session it was sent with. */
type Renewal =
  | { kind: "renewed"; token: string }
  | { kind: "ended" }
  | { kind: "unavailable"; error: ApiError }
  | { kind: "superseded" };

let refreshing: Promise<RefreshResult> | null = null;

/** Loaded lazily: server-rendered pages import this module too. */
async function authState() {
  const { useAuthStore } = await import("@/lib/stores/auth-store");
  return useAuthStore.getState();
}

async function runRefresh(): Promise<RefreshResult> {
  // The session this renewal is for. A sign-out, or a new sign-in, while it
  // runs makes its result belong to an earlier session.
  const { generation } = await authState();
  let response: Response;
  try {
    response = await fetch(buildUrl("/v1/auth/refresh"), {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
  } catch {
    return { error: new ApiError(UNREACHABLE_MESSAGE, 0, "NETWORK_ERROR") };
  }
  const payload: unknown = await response.json().catch(() => null);
  const unavailable = { error: new ApiError(UNAVAILABLE_MESSAGE, response.status, "SERVICE_UNAVAILABLE") };

  if (!response.ok) {
    // Only the API's own refusal ends the session. A rate limit, a server
    // error or a host error page says nothing about it, so the member stays
    // signed in and the next request tries again.
    const envelope = (payload as ApiErrorEnvelope | null)?.error;
    const refused = SESSION_ENDED_STATUSES.has(response.status) && typeof envelope === "object" && envelope !== null;
    return refused ? { ended: true, current: (await authState()).generation === generation } : unavailable;
  }
  const session = payload as TokenResponse | null;
  if (!session?.access_token || !session.user?.id) return unavailable;

  // Store it only into the session that asked: a renewal that finishes after
  // a sign-out, or after a new sign-in (by anyone, the same member included),
  // must not bring the old session back or replace the new one.
  const current = await authState();
  const stored =
    current.generation === generation && current.accessToken !== null && current.user?.id === session.user.id;
  if (stored) current.setSession(session.access_token, session.user);
  return { session, stored };
}

/**
 * Renew the session `token` belongs to with the httpOnly refresh cookie.
 * Requests that expire together share one refresh.
 */
async function renew(token: string): Promise<Renewal> {
  refreshing ??= runRefresh()
    // Only the store's lazy import can throw here, e.g. a chunk that failed to load.
    .catch((): RefreshResult => ({ error: new ApiError(UNREACHABLE_MESSAGE, 0, "NETWORK_ERROR") }))
    .finally(() => {
      refreshing = null;
    });
  const result = await refreshing;
  if ("error" in result) return { kind: "unavailable", error: result.error };
  if ("ended" in result) return result.current ? { kind: "ended" } : { kind: "superseded" };
  // Never resend one member's request with another member's token.
  if (!result.stored || result.session.user.id !== jwtSubject(token)) return { kind: "superseded" };
  return { kind: "renewed", token: result.session.access_token };
}

/** Ask the app shell to sign out. Only for a session the API has confirmed is over. */
function signalExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }
}

/** Whether `token` is still the session's token here, i.e. nothing replaced it since. */
async function isCurrentToken(token: string): Promise<boolean> {
  return (await authState().catch(() => null))?.accessToken === token;
}

function sessionChanged() {
  return new ApiError("Your sign-in changed while this was loading. Please try again.", 401, "SESSION_CHANGED");
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (!query) {
    return url.toString();
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
  replayed = false,
): Promise<T> {
  const headers: HeadersInit = {
    Accept: "application/json"
  };

  if (options.data !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let token = options.token;
  if (token) {
    // The access token lasts 15 minutes: renew it just before it runs out
    // instead of sending a request the API will reject. Only when the API
    // confirms the session is over does the app-shell listener
    // (`auth:expired`) sign the member out.
    const expiryMs = getJwtExpiryMs(token);
    if (expiryMs !== null && expiryMs - EXPIRY_SKEW_MS <= Date.now()) {
      const renewal = await renew(token);
      if (renewal.kind === "renewed") {
        token = renewal.token;
      } else if (renewal.kind === "unavailable") {
        // The session may well be fine: use the old token while it lasts.
        if (expiryMs <= Date.now()) throw renewal.error;
      } else if (renewal.kind === "superseded") {
        throw sessionChanged();
      } else {
        signalExpired();
        throw new ApiError("Session expired", 401, "token_expired");
      }
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: "include",
      body: options.data !== undefined ? JSON.stringify(options.data) : undefined
    });
  } catch {
    throw new ApiError(UNREACHABLE_MESSAGE, 0, "NETWORK_ERROR");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (response.status === 401 && token) {
      if (!replayed) {
        // Rejected before it ran, so it's safe to send again with a new token.
        const renewal = await renew(token);
        if (renewal.kind === "renewed") return request<T>(method, path, { ...options, token: renewal.token }, true);
        if (renewal.kind === "unavailable") throw renewal.error;
        if (renewal.kind === "superseded") throw sessionChanged();
        signalExpired();
      } else if (await isCurrentToken(token)) {
        // The token the renewal just issued was refused too. A late refusal,
        // after a sign-out or another renewal, says nothing about the session now.
        signalExpired();
      }
    }

    const typed = payload as ApiErrorEnvelope | null;
    if (typeof typed?.error === "object" && typed.error !== null) {
      let message = typed.error?.message ?? `HTTP ${response.status}`;
      // Pydantic 422 returns `code: "VALIDATION_ERROR"` plus a `details`
      // array of `{ field, message }`. The top-level message is the
      // generic "Request validation failed" — useless to the user.
      // Prefer the first detail so the toast actually names the broken
      // field (e.g. "phone: String should match pattern …").
      if (typed.error?.code === "VALIDATION_ERROR" && Array.isArray(typed.error.details)) {
        const first = typed.error.details[0] as { field?: string; message?: string } | undefined;
        if (first?.message) {
          message = first.field ? `${first.field}: ${first.message}` : first.message;
        }
      }
      throw new ApiError(message, response.status, typed.error?.code, typed.error?.details);
    }

    // Not the API's error envelope: a proxy or host answered instead
    // (e.g. a 502 page, or the host's "Application not found").
    throw new ApiError(UNAVAILABLE_MESSAGE, response.status, "SERVICE_UNAVAILABLE");
  }

  return payload as T;
}

export function apiGet<T>(path: string, options: Omit<RequestOptions, "data"> = {}) {
  return request<T>("GET", path, options);
}

export function apiPost<T>(path: string, options: RequestOptions = {}) {
  return request<T>("POST", path, options);
}

export function apiPatch<T>(path: string, options: RequestOptions = {}) {
  return request<T>("PATCH", path, options);
}

export function apiDelete<T>(path: string, options: Omit<RequestOptions, "data"> = {}) {
  return request<T>("DELETE", path, options);
}
