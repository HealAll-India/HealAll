import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { apiGet, ApiError, UNAVAILABLE_MESSAGE, UNREACHABLE_MESSAGE } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { UserInfo } from "@/lib/types/api";

/** An unsigned JWT whose `exp` is `secondsFromNow` away; the client only reads `exp`. */
function jwt(secondsFromNow: number, id = "t"): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsFromNow, jti: id }));
  return `h.${payload.replace(/=+$/, "")}.s`;
}

const USER = { id: "u1", name: "Priya Sharma" } as UserInfo;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function route(handlers: Record<string, () => Response>) {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    expect(init?.credentials).toBe("include");
    const handler = handlers[path];
    if (!handler) throw new Error(`unexpected request to ${path}`);
    return handler();
  });
}

describe("API client session renewal", () => {
  let expired: Mock<(event: Event) => void>;

  beforeEach(() => {
    useAuthStore.getState().clearSession();
    expired = vi.fn<(event: Event) => void>();
    window.addEventListener("auth:expired", expired);
  });

  afterEach(() => {
    window.removeEventListener("auth:expired", expired);
    vi.unstubAllGlobals();
  });

  it("renews an access token that is about to expire before sending the request", async () => {
    const fresh = jwt(900, "fresh");
    const fetchMock = route({
      "/v1/auth/refresh": () => json(200, { access_token: fresh, token_type: "bearer", expires_in: 900, user: USER }),
      "/v1/feed": () => json(200, { items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiGet("/v1/feed", { token: jwt(10) })).resolves.toEqual({ items: [] });

    const feedCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/v1/feed"));
    expect((feedCall?.[1] as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${fresh}` });
    expect(useAuthStore.getState().accessToken).toBe(fresh);
    expect(expired).not.toHaveBeenCalled();
  });

  it("renews once and replays a request the API rejected with 401", async () => {
    let feedCalls = 0;
    const fetchMock = route({
      "/v1/auth/refresh": () => json(200, { access_token: jwt(900, "new"), token_type: "bearer", expires_in: 900, user: USER }),
      "/v1/feed": () => (++feedCalls === 1 ? json(401, { error: { code: "UNAUTHENTICATED", message: "Token revoked" } }) : json(200, { items: [1] })),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiGet("/v1/feed", { token: jwt(600) })).resolves.toEqual({ items: [1] });
    expect(feedCalls).toBe(2);
    expect(expired).not.toHaveBeenCalled();
  });

  it("signs the member out only when renewal fails", async () => {
    vi.stubGlobal(
      "fetch",
      route({ "/v1/auth/refresh": () => json(401, { error: { code: "UNAUTHENTICATED", message: "Session ended" } }) }),
    );

    await expect(apiGet("/v1/feed", { token: jwt(-60) })).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledOnce();
  });

  it("shares one renewal between requests that expire together", async () => {
    const fetchMock = route({
      "/v1/auth/refresh": () => json(200, { access_token: jwt(900, "shared"), token_type: "bearer", expires_in: 900, user: USER }),
      "/v1/feed": () => json(200, { items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const stale = jwt(5);
    await Promise.all([apiGet("/v1/feed", { token: stale }), apiGet("/v1/feed", { token: stale })]);
    const refreshes = fetchMock.mock.calls.filter(([url]) => String(url).includes("/v1/auth/refresh"));
    expect(refreshes).toHaveLength(1);
  });

  it("says the API is unreachable when no response arrives", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiGet("/v1/public/stats")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
      message: UNREACHABLE_MESSAGE,
    });
  });

  it("says the API is unavailable when a host error page answers instead of the API", async () => {
    // What the host returns while no backend is attached to the domain.
    vi.stubGlobal(
      "fetch",
      route({ "/v1/auth/resend-otp": () => json(404, { status: "error", code: 404, message: "Application not found" }) }),
    );
    await expect(apiGet("/v1/auth/resend-otp")).rejects.toMatchObject({
      status: 404,
      code: "SERVICE_UNAVAILABLE",
      message: UNAVAILABLE_MESSAGE,
    });
  });

  it("does not try to renew requests sent without a session", async () => {
    const fetchMock = route({
      "/v1/auth/token": () => json(401, { error: { code: "UNAUTHENTICATED", message: "Invalid code" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiGet("/v1/auth/token")).rejects.toMatchObject({ status: 401, message: "Invalid code" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
