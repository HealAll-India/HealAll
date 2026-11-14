import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

/** Shown in place of a staff page to members whose roles don't open it. */
export function StaffOnly({ who }: { who: string }) {
  return (
    <EmptyState
      Icon={ShieldAlert}
      title={`For ${who} only`}
      action={
        <Link href="/feed" className="btn-secondary">
          Back to the feed
        </Link>
      }
    >
      Your account doesn&apos;t have access to this page. If you think it should, ask a HealAll admin.
    </EmptyState>
  );
}
