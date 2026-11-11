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

/**
 * Decode the `exp` claim from a JWT without verifying its signature.
 * Used as a cheap client-side gate so we don't fire requests that the
 * backend will reject with 401 anyway.
 *
 * Returns null when the token is missing, malformed, or has no `exp`.
 * The caller treats null as "no expiry info" and lets the request fly.
 */
function getJwtExpiryMs(token: string | undefined): number | null {
  if (!token) return null;
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
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number") return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/** Shown when no response arrives at all (offline, DNS, CORS, the API host is gone). */
export const UNREACHABLE_MESSAGE = "We can't reach HealAll right now. Check your connection and try again.";

/** Shown when something other than the API answers (a proxy or host error page). */
export const UNAVAILABLE_MESSAGE = "HealAll is temporarily unavailable. Please try again in a few minutes.";

/** Renew this long before the access token expires, so a slow request doesn't race it. */
const EXPIRY_SKEW_MS = 30_000;

let refreshing: Promise<string | null> | null = null;

/**
 * Swap the httpOnly refresh cookie for a new access token and store it.
 * Requests that expire together share one refresh. Resolves to null when
 * the session can't be renewed (signed out elsewhere, cookie expired,
 * account closed).
 */
export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const response = await fetch(buildUrl("/v1/auth/refresh"), {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (!response.ok) return null;
      const session = (await response.json()) as TokenResponse;
      // Loaded lazily: server-rendered pages import this module too.
      const { useAuthStore } = await import("@/lib/stores/auth-store");
      useAuthStore.getState().setSession(session.access_token, session.user);
      return session.access_token;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function signalExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }
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
    // instead of sending a request the API will reject. Only when renewal
    // fails does the app-shell listener (`auth:expired`) sign the member out.
    const expiryMs = getJwtExpiryMs(token);
    if (expiryMs !== null && expiryMs - EXPIRY_SKEW_MS <= Date.now()) {
      const renewed = await refreshAccessToken();
      if (!renewed) {
        signalExpired();
        throw new ApiError("Session expired", 401, "token_expired");
      }
      token = renewed;
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
    if (response.status === 401 && token && !replayed) {
      // Rejected before it ran, so it's safe to send again with a new token.
      const renewed = await refreshAccessToken();
      if (renewed) return request<T>(method, path, { ...options, token: renewed }, true);
    }
    if (response.status === 401) {
      signalExpired();
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
