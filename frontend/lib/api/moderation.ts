import { apiGet, apiPost } from "@/lib/api/client";
import type {
  ModerationActionListResponse,
  ModerationActionResponse,
  ModerationActionType,
  ReportListResponse,
  ReportReason,
  ReportResponse,
  ReportStatus,
  ReportTargetType,
  UUID
} from "@/lib/types/api";

export function createReport(
  token: string,
  payload: {
    target_type: ReportTargetType;
    target_id: UUID;
    reason: ReportReason;
    description?: string;
  }
) {
  return apiPost<ReportResponse>("/v1/reports", { token, data: payload });
}

export function listReports(token: string, status: ReportStatus = "pending", page = 1, perPage = 20) {
  return apiGet<ReportListResponse>("/v1/reports", {
    token,
    query: { status, page, per_page: perPage }
  });
}

export function createModerationAction(
  token: string,
  payload: {
    report_id?: UUID;
    target_user_id?: UUID;
    action: ModerationActionType;
    reason: string;
    duration_hours?: number;
  }
) {
  return apiPost<ModerationActionResponse>("/v1/moderation/actions", { token, data: payload });
}

export function listModerationActions(token: string, page = 1, perPage = 20) {
  return apiGet<ModerationActionListResponse>("/v1/moderation/actions", {
    token,
    query: { page, per_page: perPage }
  });
}
