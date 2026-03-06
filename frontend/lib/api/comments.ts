import { apiDelete, apiGet, apiPost } from "@/lib/api/client";
import type { CommentResponse, UUID } from "@/lib/types/api";

export function listComments(token: string, postId: UUID) {
  return apiGet<CommentResponse[]>(`/v1/posts/${postId}/comments`, { token });
}

export function createComment(token: string, postId: UUID, body: string) {
  return apiPost<CommentResponse>(`/v1/posts/${postId}/comments`, {
    token,
    data: { body }
  });
}

export function deleteComment(token: string, commentId: UUID) {
  return apiDelete<void>(`/v1/comments/${commentId}`, { token });
}
