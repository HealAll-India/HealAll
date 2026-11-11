"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { UserInfo } from "@/lib/types/api";

interface AuthState {
  accessToken: string | null;
  user: UserInfo | null;
  /**
   * Changes whenever a session begins or ends. A renewed token or an edited
   * profile for the member already signed in keeps it, so the API client can
   * tell a late renewal for an earlier session from one for this session.
   */
  generation: number;
  setSession: (accessToken: string, user: UserInfo) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      generation: 0,
      setSession: (accessToken, user) =>
        set((s) => ({
          accessToken,
          user,
          generation: s.accessToken !== null && s.user?.id === user.id ? s.generation : s.generation + 1,
        })),
      clearSession: () => set((s) => ({ accessToken: null, user: null, generation: s.generation + 1 }))
    }),
    {
      name: "healall-auth",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
