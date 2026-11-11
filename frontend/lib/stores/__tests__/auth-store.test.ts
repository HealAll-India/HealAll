import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "@/lib/stores/auth-store";
import type { UserInfo } from "@/lib/types/api";

const PRIYA = { id: "u1", name: "Priya Sharma" } as UserInfo;
const ARJUN = { id: "u2", name: "Arjun Rao" } as UserInfo;

const state = () => useAuthStore.getState();

describe("auth store sessions", () => {
  beforeEach(() => state().clearSession());

  it("updates the session already here for a renewal or a profile edit", () => {
    state().setSession("t1", PRIYA);

    state().updateSession(PRIYA, "t2");
    expect(state()).toMatchObject({ accessToken: "t2", user: PRIYA });

    // A profile edit keeps the current token.
    state().updateSession({ ...PRIYA, name: "Priya S." });
    expect(state()).toMatchObject({ accessToken: "t2", user: { name: "Priya S." } });
  });

  it("ignores an update that lands after a sign-out or for another member", () => {
    state().updateSession(PRIYA, "late");
    expect(state()).toMatchObject({ accessToken: null, user: null });

    state().setSession("t1", ARJUN);
    state().updateSession(PRIYA, "late");
    expect(state()).toMatchObject({ accessToken: "t1", user: ARJUN });
  });
});
