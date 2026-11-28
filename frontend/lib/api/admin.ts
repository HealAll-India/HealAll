import { apiGet, apiPost } from "@/lib/api/client";
import type {
  AdminStatsResponse,
  Under18CloseResponse,
  Under18SummaryResponse,
  Under18WarnResponse,
} from "@/lib/types/api";

export function getAdminStats(token: string) {
  return apiGet<AdminStatsResponse>("/v1/admin/stats", { token });
}

export function getUnder18Summary(token: string) {
  return apiGet<Under18SummaryResponse>("/v1/admin/under-18", { token });
}

export function warnUnder18(token: string) {
  return apiPost<Under18WarnResponse>("/v1/admin/under-18/warn", { token });
}

export function closeUnder18(token: string) {
  return apiPost<Under18CloseResponse>("/v1/admin/under-18/close", { token });
}
