import { apiGet } from "@/lib/api/client";
import type { AdminStatsResponse } from "@/lib/types/api";

export function getAdminStats(token: string) {
  return apiGet<AdminStatsResponse>("/v1/admin/stats", { token });
}
