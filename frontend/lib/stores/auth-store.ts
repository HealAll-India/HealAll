"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { UserInfo } from "@/lib/types/api";

interface AuthState {
  accessToken: string | null;
  user: UserInfo | null;
  setSession: (accessToken: string, user: UserInfo) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setSession: (accessToken, user) => set({ accessToken, user }),
      clearSession: () => set({ accessToken: null, user: null })
    }),
    {
      name: "healall-auth",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
