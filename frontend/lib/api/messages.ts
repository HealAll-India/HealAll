import { apiGet, apiPost } from "@/lib/api/client";
import type {
  ConsentRequestResponse,
  ConversationDetailResponse,
  ConversationResponse,
  MessageResponse,
  UUID
} from "@/lib/types/api";

export function requestConsent(token: string, toUserId: UUID, postId?: UUID) {
  return apiPost<ConsentRequestResponse>("/v1/messages/request-consent", {
    token,
    data: { to_user_id: toUserId, post_id: postId }
  });
}

export function acceptConsent(token: string, requestId: UUID) {
  return apiPost<ConversationResponse>(`/v1/messages/consent/${requestId}/accept`, { token });
}

export function declineConsent(token: string, requestId: UUID) {
  return apiPost<ConsentRequestResponse>(`/v1/messages/consent/${requestId}/decline`, { token });
}

export function listConversations(token: string) {
  return apiGet<ConversationResponse[]>("/v1/messages/conversations", { token });
}

export function getConversation(token: string, conversationId: UUID, page = 1, perPage = 50) {
  return apiGet<ConversationDetailResponse>(`/v1/messages/conversations/${conversationId}`, {
    token,
    query: { page, per_page: perPage }
  });
}

export function sendMessage(token: string, conversationId: UUID, body: string) {
  return apiPost<MessageResponse>(`/v1/messages/conversations/${conversationId}`, {
    token,
    data: { body }
  });
}
