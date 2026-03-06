import { apiDelete, apiGet, apiPost } from "@/lib/api/client";
import type { InviteCodeResponse, UUID } from "@/lib/types/api";

export function createInvite(token: string, maxUses: number, expiresInDays: number) {
  return apiPost<InviteCodeResponse>("/v1/invites", {
    token,
    data: { max_uses: maxUses, expires_in_days: expiresInDays }
  });
}

export function listInvites(token: string, limit = 50, offset = 0) {
  return apiGet<InviteCodeResponse[]>("/v1/invites", {
    token,
    query: { limit, offset }
  });
}

export function revokeInvite(token: string, inviteId: UUID) {
  return apiDelete<{ message: string }>(`/v1/invites/${inviteId}`, { token });
}
