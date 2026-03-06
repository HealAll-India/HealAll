import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type {
  CreatePostPayload,
  FeedResponse,
  PostResponse,
  UpdatePostPayload,
  UUID
} from "@/lib/types/api";

export function createPost(token: string, payload: CreatePostPayload) {
  return apiPost<PostResponse>("/v1/posts", { token, data: payload });
}

export function getPost(token: string, postId: UUID) {
  return apiGet<PostResponse>(`/v1/posts/${postId}`, { token });
}

export function updatePost(token: string, postId: UUID, payload: UpdatePostPayload) {
  return apiPatch<PostResponse>(`/v1/posts/${postId}`, { token, data: payload });
}

export function deletePost(token: string, postId: UUID) {
  return apiDelete<void>(`/v1/posts/${postId}`, { token });
}

export function submitPost(token: string, postId: UUID) {
  return apiPost<PostResponse>(`/v1/posts/${postId}/submit`, { token });
}

export function getMyPosts(token: string, page = 1, perPage = 20) {
  return apiGet<FeedResponse>("/v1/posts", {
    token,
    query: { page, per_page: perPage }
  });
}

export function getFeed(
  token: string,
  query: {
    page?: number;
    per_page?: number;
    city?: string;
    category?: string;
    urgency?: string;
    search?: string;
  }
) {
  return apiGet<FeedResponse>("/v1/feed", { token, query });
}
