import { apiGet, apiPost } from "@/lib/api/client";
import type { AuthorInfo, UUID } from "@/lib/types/api";

export type VoteDecision = "approve" | "reject" | "needs_info";

export interface CommunityVoteSummary {
  approve: number;
  reject: number;
  needs_info: number;
  threshold: number;
}

export interface CommunityVoteItem {
  post_id: UUID;
  title: string;
  description: string;
  category: string;
  urgency: string;
  city: string;
  address?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  author: AuthorInfo;
  submitted_at: string;
  votes: CommunityVoteSummary;
}

export interface CommunityQueueResponse {
  items: CommunityVoteItem[];
  page: number;
  per_page: number;
  total: number;
  has_next: boolean;
  threshold: number;
}

export interface CommunityVoteResult {
  post_id: UUID;
  decision: VoteDecision;
  new_status: string;
  votes: CommunityVoteSummary;
  promoted_to_active: boolean;
}

export function getCommunityQueue(token: string, page = 1, perPage = 20) {
  return apiGet<CommunityQueueResponse>("/v1/community-verification/queue", {
    token,
    query: { page, per_page: perPage },
  });
}

export function castCommunityVote(
  token: string,
  postId: UUID,
  decision: VoteDecision,
  reason?: string,
) {
  return apiPost<CommunityVoteResult>(`/v1/community-verification/${postId}/vote`, {
    token,
    data: { decision, reason: reason ?? null },
  });
}
