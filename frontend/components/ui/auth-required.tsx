import Link from "next/link";
import { Lock } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

export function AuthRequired() {
  return (
    <div className="auth-required">
      <EmptyState
        Icon={Lock}
        title="Sign in to continue"
        action={
          <>
            <Link href="/login" className="btn-primary">Sign in</Link>
            <Link href="/signup" className="btn-ghost">I have an invite</Link>
          </>
        }
      >
        HealAll is invite-only. Sign in to see requests from verified members and offer help.
      </EmptyState>
    </div>
  );
}
