import { apiDelete, apiGet, apiPost } from "@/lib/api/client";

export interface PushPublicKeyResponse {
  /** False until the API has a VAPID key pair: then nothing can be sent. */
  enabled: boolean;
  public_key: string | null;
}

/** What the API stores for one device: the endpoint and the keys that encrypt payloads for it. */
export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function getPushPublicKey() {
  return apiGet<PushPublicKeyResponse>("/v1/push/public-key");
}

export function savePushSubscription(token: string, subscription: PushSubscriptionPayload) {
  return apiPost<void>("/v1/push/subscriptions", { token, data: subscription });
}

/** The endpoint goes in the body, not the URL, so it stays out of access logs. */
export function deletePushSubscription(token: string, endpoint: string) {
  return apiDelete<void>("/v1/push/subscriptions", { token, data: { endpoint } });
}
