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
      const message = typed.error?.message ?? `HTTP ${response.status}`;
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
