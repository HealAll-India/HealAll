"use client";

import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";

/**
 * Drop into any server-rendered page (e.g. home) to redirect
 * authenticated users to /feed without making the whole page a client component.
 */
export function AuthRedirect() {
  useAuthRedirect();
  return null;
}
