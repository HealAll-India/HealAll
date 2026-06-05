import type { ApiErrorEnvelope } from "@/lib/types/api";

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

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: HeadersInit = {
    Accept: "application/json"
  };

  if (options.data !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.token) {
    // Short-circuit obviously-expired tokens client-side so the user doesn't
    // see a wave of 401s in devtools (and we don't burn a request) when the
    // 15-minute access token has aged out. dispatch `auth:expired` so the
    // app-shell listener can clear the session and bounce to /login.
    const expiryMs = getJwtExpiryMs(options.token);
    if (expiryMs !== null && expiryMs <= Date.now()) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:expired"));
      }
      throw new ApiError("Session expired", 401, "token_expired");
    }
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    credentials: "include",
    body: options.data !== undefined ? JSON.stringify(options.data) : undefined
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }

    if (typeof payload === "object" && payload !== null) {
      const typed = payload as ApiErrorEnvelope;
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

    throw new ApiError(String(payload), response.status);
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
