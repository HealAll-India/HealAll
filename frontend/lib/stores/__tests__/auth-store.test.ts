import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "@/lib/stores/auth-store";
import type { UserInfo } from "@/lib/types/api";

const PRIYA = { id: "u1", name: "Priya Sharma" } as UserInfo;
const ARJUN = { id: "u2", name: "Arjun Rao" } as UserInfo;

const state = () => useAuthStore.getState();

describe("auth store sessions", () => {
  beforeEach(() => state().clearSession());

  it("starts a new session on every sign-in, even for the member already signed in", () => {
    state().setSession("t1", PRIYA);
    const first = state().generation;
    state().setSession("t2", PRIYA);
    expect(state().generation).toBe(first + 1);
  });

  it("ends the session on sign-out", () => {
    state().setSession("t1", PRIYA);
    const signedIn = state().generation;
    state().clearSession();
    expect(state()).toMatchObject({ accessToken: null, user: null, generation: signedIn + 1 });
  });

  it("updates the same session for a renewal or a profile edit", () => {
    state().setSession("t1", PRIYA);
    const generation = state().generation;

    state().updateSession(PRIYA, "t2");
    expect(state()).toMatchObject({ accessToken: "t2", generation });

    // A profile edit keeps the current token.
    state().updateSession({ ...PRIYA, name: "Priya S." });
    expect(state()).toMatchObject({ accessToken: "t2", user: { name: "Priya S." }, generation });
  });

  it("ignores an update that lands after a sign-out or for another member", () => {
    state().updateSession(PRIYA, "late");
    expect(state()).toMatchObject({ accessToken: null, user: null });

    state().setSession("t1", ARJUN);
    state().updateSession(PRIYA, "late");
    expect(state()).toMatchObject({ accessToken: "t1", user: ARJUN });
  });
});
