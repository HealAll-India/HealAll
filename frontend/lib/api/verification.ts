import { apiGet, apiPost } from "@/lib/api/client";
import type { UUID, VerificationActionResponse, VerificationQueueResponse } from "@/lib/types/api";

export function getVerificationQueue(token: string, page = 1, perPage = 20) {
  return apiGet<VerificationQueueResponse>("/v1/verification/queue", {
    token,
    query: { page, per_page: perPage }
  });
}

export function verifyPost(token: string, postId: UUID, remarks: string) {
  return apiPost<VerificationActionResponse>(`/v1/verification/${postId}/verify`, {
    token,
    data: { remarks }
  });
}

export function requestInfo(token: string, postId: UUID, remarks: string) {
  return apiPost<VerificationActionResponse>(`/v1/verification/${postId}/request-info`, {
    token,
    data: { remarks }
  });
}

export function rejectPost(token: string, postId: UUID, remarks: string) {
  return apiPost<VerificationActionResponse>(`/v1/verification/${postId}/reject`, {
    token,
    data: { remarks }
  });
}
