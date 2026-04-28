"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useHydrated } from "@/lib/hooks/use-hydrated";

/**
 * Redirect authenticated users to /feed.
 * Call in signup, login, and landing pages so logged-in users
 * are never stuck on auth pages.
 */
export function useAuthRedirect() {
  const router    = useRouter();
  const hydrated  = useHydrated();
  const accessToken = useAuthStore(s => s.accessToken);

  useEffect(() => {
    if (hydrated && accessToken) {
      router.replace("/feed");
    }
  }, [hydrated, accessToken, router]);
}
