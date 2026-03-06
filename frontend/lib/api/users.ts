import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type {
  BlockedUserResponse,
  MyUserProfile,
  PrivacySettings,
  PublicUserProfile,
  UpdateProfilePayload,
  UUID
} from "@/lib/types/api";

export function getMyProfile(token: string) {
  return apiGet<MyUserProfile>("/v1/users/me", { token });
}

export function updateMyProfile(token: string, payload: UpdateProfilePayload) {
  return apiPatch<MyUserProfile>("/v1/users/me", { token, data: payload });
}

export function getPublicProfile(token: string, userId: UUID) {
  return apiGet<PublicUserProfile>(`/v1/users/${userId}`, { token });
}

export function addSkill(token: string, skill: string) {
  return apiPost<{ id: UUID; skill: string }>("/v1/users/me/skills", {
    token,
    data: { skill }
  });
}

export function removeSkill(token: string, skillId: UUID) {
  return apiDelete<void>(`/v1/users/me/skills/${skillId}`, { token });
}

export function updatePrivacy(token: string, payload: Partial<PrivacySettings>) {
  return apiPatch<PrivacySettings>("/v1/users/me/privacy", { token, data: payload });
}

export function blockUser(token: string, userId: UUID) {
  return apiPost<{ message: string }>(`/v1/users/${userId}/block`, { token });
}

export function unblockUser(token: string, userId: UUID) {
  return apiDelete<void>(`/v1/users/${userId}/block`, { token });
}

export function listBlockedUsers(token: string) {
  return apiGet<BlockedUserResponse[]>("/v1/users/me/blocked", { token });
}
