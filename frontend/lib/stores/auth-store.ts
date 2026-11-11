"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { UserInfo } from "@/lib/types/api";

interface AuthState {
  accessToken: string | null;
  user: UserInfo | null;
  /**
   * Changes on every sign-in and sign-out, and nowhere else, so the API
   * client can tell a late renewal for an earlier session from one for this
   * session, even when the same member signed in again.
   */
  generation: number;
  /** Start a session: after a sign-in, signup or Google sign-in. */
  setSession: (accessToken: string, user: UserInfo) => void;
  /**
   * Update the session already here (a renewed token, an edited profile).
   * Ignored unless `user` is the member signed in, so a late result can't
   * bring back a session that ended. Keeps the token unless given one.
   */
  updateSession: (user: UserInfo, accessToken?: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      generation: 0,
      setSession: (accessToken, user) => set((s) => ({ accessToken, user, generation: s.generation + 1 })),
      updateSession: (user, accessToken) => {
        const current = get();
        if (current.accessToken === null || current.user?.id !== user.id) return;
        set({ user, accessToken: accessToken ?? current.accessToken });
      },
      clearSession: () => set((s) => ({ accessToken: null, user: null, generation: s.generation + 1 }))
    }),
    {
      name: "healall-auth",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
