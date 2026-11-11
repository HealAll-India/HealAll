import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { apiGet, UNAVAILABLE_MESSAGE, UNREACHABLE_MESSAGE } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { UserInfo } from "@/lib/types/api";

const USER = { id: "u1", name: "Priya Sharma" } as UserInfo;
const OTHER = { id: "u2", name: "Arjun Rao" } as UserInfo;

/**
 * An unsigned JWT for `user` in sign-in session `sid`, whose `exp` is
 * `secondsFromNow` away; the client only reads `exp`, `sub` and `sid`.
 * `sid: null` is a token from before the API named sessions.
 */
function jwt(secondsFromNow: number, id = "t", user: UserInfo = USER, sid: string | null = "s1"): string {
  const claims = { sub: user.id, exp: Math.floor(Date.now() / 1000) + secondsFromNow, jti: id, ...(sid ? { sid } : {}) };
  return `h.${btoa(JSON.stringify(claims)).replace(/=+$/, "")}.s`;
}

/** Sign `user` in with `token`, as the login page does, and return the token. */
function signIn(token: string, user: UserInfo = USER): string {
  useAuthStore.getState().setSession(token, user);
  return token;
}

function issued(token: string, user: UserInfo = USER) {
  return json(200, { access_token: token, token_type: "bearer", expires_in: 900, user });
}

/** A response the test releases when it chooses. */
function held() {
  let release!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { response, release };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function route(handlers: Record<string, () => Response | Promise<Response>>) {
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
      "/v1/auth/refresh": () => issued(fresh),
      "/v1/feed": () => json(200, { items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiGet("/v1/feed", { token: signIn(jwt(10)) })).resolves.toEqual({ items: [] });

    const feedCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/v1/feed"));
    expect((feedCall?.[1] as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${fresh}` });
    expect(useAuthStore.getState().accessToken).toBe(fresh);
    expect(expired).not.toHaveBeenCalled();
  });

  it("renews once and replays a request the API rejected with 401", async () => {
    let feedCalls = 0;
    const fetchMock = route({
      "/v1/auth/refresh": () => issued(jwt(900, "new")),
      "/v1/feed": () => (++feedCalls === 1 ? json(401, { error: { code: "UNAUTHENTICATED", message: "Token revoked" } }) : json(200, { items: [1] })),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiGet("/v1/feed", { token: signIn(jwt(600)) })).resolves.toEqual({ items: [1] });
    expect(feedCalls).toBe(2);
    expect(expired).not.toHaveBeenCalled();
  });

  it.each([
    [401, "UNAUTHENTICATED", "Session ended"],
    [410, "EXPIRED", "Refresh token has expired"],
  ])("signs the member out when the API refuses renewal with %i", async (status, code, message) => {
    vi.stubGlobal("fetch", route({ "/v1/auth/refresh": () => json(status, { error: { code, message } }) }));

    await expect(apiGet("/v1/feed", { token: signIn(jwt(-60)) })).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
  });

  it.each([
    ["a server error", () => json(500, { error: { code: "INTERNAL_ERROR", message: "boom" } }), "SERVICE_UNAVAILABLE"],
    ["a rate limit", () => json(429, { error: { code: "RATE_LIMITED", message: "Slow down" } }), "SERVICE_UNAVAILABLE"],
    ["a host error page", () => json(404, { status: "error", code: 404, message: "Application not found" }), "SERVICE_UNAVAILABLE"],
    [
      "no response",
      () => {
        throw new TypeError("Failed to fetch");
      },
      "NETWORK_ERROR",
    ],
  ])("keeps the member signed in when renewal meets %s", async (_, refresh, code) => {
    vi.stubGlobal("fetch", route({ "/v1/auth/refresh": refresh }));
    const stale = signIn(jwt(-60));

    await expect(apiGet("/v1/feed", { token: stale })).rejects.toMatchObject({ code });
    expect(expired).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBe(stale);
  });

  it("reports an outage, not a sign-out, when a 401 can't be renewed", async () => {
    vi.stubGlobal(
      "fetch",
      route({
        "/v1/auth/refresh": () => json(503, { error: { code: "UNAVAILABLE", message: "Down" } }),
        "/v1/feed": () => json(401, { error: { code: "UNAUTHENTICATED", message: "Token revoked" } }),
      }),
    );

    await expect(apiGet("/v1/feed", { token: signIn(jwt(600)) })).rejects.toMatchObject({ message: UNAVAILABLE_MESSAGE });
    expect(expired).not.toHaveBeenCalled();
  });

  it("sends the old token while it is still valid if renewal is unavailable", async () => {
    const fetchMock = route({
      "/v1/auth/refresh": () => json(502, { error: { code: "BAD_GATEWAY", message: "Bad gateway" } }),
      "/v1/feed": () => json(200, { items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const nearlyExpired = signIn(jwt(10));

    await expect(apiGet("/v1/feed", { token: nearlyExpired })).resolves.toEqual({ items: [] });
    const feedCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/v1/feed"));
    expect((feedCall?.[1] as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${nearlyExpired}` });
  });

  it("drops a renewal that finishes after the member signed out", async () => {
    const refresh = held();
    const fetchMock = route({ "/v1/auth/refresh": () => refresh.response, "/v1/feed": () => json(200, { items: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const pending = apiGet("/v1/feed", { token: signIn(jwt(-60)) });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    useAuthStore.getState().clearSession();
    refresh.release(issued(jwt(900, "late")));

    await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(expired).not.toHaveBeenCalled();
  });

  it("keeps another member's session when an earlier renewal finishes late", async () => {
    const refresh = held();
    const fetchMock = route({ "/v1/auth/refresh": () => refresh.response, "/v1/feed": () => json(200, { items: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const pending = apiGet("/v1/feed", { token: signIn(jwt(-60)) });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const theirs = signIn(jwt(900, "theirs", OTHER, "s9"), OTHER);
    refresh.release(issued(jwt(900, "late")));

    await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(useAuthStore.getState()).toMatchObject({ accessToken: theirs, user: OTHER });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("doesn't resend a member's request with the next member's token", async () => {
    // The cookie changed hands before the renewal went out, so it renews the new member.
    const refresh = held();
    const fetchMock = route({ "/v1/auth/refresh": () => refresh.response, "/v1/feed": () => json(200, { items: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const pending = apiGet("/v1/feed", { token: signIn(jwt(-60)) });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    signIn(jwt(900, "theirs", OTHER, "s9"), OTHER);
    const renewedTheirs = jwt(900, "renewed", OTHER, "s9");
    refresh.release(issued(renewedTheirs, OTHER));

    await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    // The renewal was for their session, so it is theirs to keep.
    expect(useAuthStore.getState().accessToken).toBe(renewedTheirs);
    expect(fetchMock).toHaveBeenCalledOnce();
  });



  it.each([
    ["after signing out and back in", true],
    ["after signing in again without signing out", false],
  ])("drops a renewal that finishes after the same member starts a new session (%s)", async (_, signOut) => {
    const refresh = held();
    const fetchMock = route({ "/v1/auth/refresh": () => refresh.response, "/v1/feed": () => json(200, { items: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const pending = apiGet("/v1/feed", { token: signIn(jwt(-60)) });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    if (signOut) useAuthStore.getState().clearSession();
    const again = signIn(jwt(900, "again", USER, "s2"));
    refresh.release(issued(jwt(900, "late")));

    await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(useAuthStore.getState().accessToken).toBe(again);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ["after signing out and back in", true],
    ["after signing in again without signing out", false],
  ])("doesn't sign out the same member's new session when the old renewal is refused late (%s)", async (_, signOut) => {
    const refresh = held();
    const fetchMock = route({ "/v1/auth/refresh": () => refresh.response });
    vi.stubGlobal("fetch", fetchMock);

    const pending = apiGet("/v1/feed", { token: signIn(jwt(-60)) });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    if (signOut) useAuthStore.getState().clearSession();
    const again = signIn(jwt(900, "again", USER, "s2"));
    refresh.release(json(401, { error: { code: "UNAUTHENTICATED", message: "Token revoked" } }));

    await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(expired).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBe(again);
  });

  it("doesn't renew a request from an old session into a newer sign-in", async () => {
    // The same member signed in again before an old screen sent its request.
    const old = jwt(-60, "old");
    const fetchMock = route({
      "/v1/auth/refresh": () => issued(jwt(900, "renewed", USER, "s2")),
      "/v1/feed": () => json(200, { items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    signIn(jwt(5, "again", USER, "s2"));

    await expect(apiGet("/v1/feed", { token: old })).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/v1/feed"))).toBe(false);
    expect(expired).not.toHaveBeenCalled();
  });

  it("doesn't replay a delayed 401 from the previous session under the new one", async () => {
    const feed = held();
    const fetchMock = route({
      "/v1/feed": () => feed.response,
      "/v1/auth/refresh": () => issued(jwt(900, "renewed", USER, "s2")),
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = apiGet("/v1/feed", { token: signIn(jwt(600)) });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    useAuthStore.getState().clearSession();
    signIn(jwt(900, "again", USER, "s2"));
    feed.release(json(401, { error: { code: "UNAUTHENTICATED", message: "Token expired" } }));

    await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/v1/feed"))).toHaveLength(1);
    expect(expired).not.toHaveBeenCalled();
  });

  it("renews a session whose token predates session ids", async () => {
    const fresh = jwt(900, "fresh");
    vi.stubGlobal(
      "fetch",
      route({ "/v1/auth/refresh": () => issued(fresh), "/v1/feed": () => json(200, { items: [] }) }),
    );

    await expect(apiGet("/v1/feed", { token: signIn(jwt(-60, "legacy", USER, null)) })).resolves.toEqual({ items: [] });
    expect(useAuthStore.getState().accessToken).toBe(fresh);
  });

  it("keeps a renewal when the member only edits their profile meanwhile", async () => {
    const refresh = held();
    const fetchMock = route({ "/v1/auth/refresh": () => refresh.response, "/v1/feed": () => json(200, { items: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const stale = signIn(jwt(-60));

    const pending = apiGet("/v1/feed", { token: stale });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // What the profile page does after a save.
    useAuthStore.getState().updateSession({ ...USER, name: "Priya S." });
    const fresh = jwt(900, "fresh");
    refresh.release(issued(fresh));

    await expect(pending).resolves.toEqual({ items: [] });
    expect(useAuthStore.getState().accessToken).toBe(fresh);
  });

  it("doesn't sign out the next member when an earlier session's renewal is refused", async () => {
    const refresh = held();
    const fetchMock = route({ "/v1/auth/refresh": () => refresh.response });
    vi.stubGlobal("fetch", fetchMock);

    const pending = apiGet("/v1/feed", { token: signIn(jwt(-60)) });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    signIn(jwt(900, "theirs", OTHER, "s9"), OTHER);
    refresh.release(json(401, { error: { code: "UNAUTHENTICATED", message: "Token revoked" } }));

    await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(expired).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(OTHER);
  });

  it("shares one renewal between requests that expire together", async () => {
    const fetchMock = route({
      "/v1/auth/refresh": () => issued(jwt(900, "shared")),
      "/v1/feed": () => json(200, { items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const stale = signIn(jwt(5));
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
