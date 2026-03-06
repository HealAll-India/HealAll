import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type {
  CaseClosureResponse,
  CaseHelperResponse,
  CaseListResponse,
  CaseNoteResponse,
  CaseResponse,
  UUID
} from "@/lib/types/api";

export function listCases(token: string, page = 1, perPage = 20) {
  return apiGet<CaseListResponse>("/v1/cases", {
    token,
    query: { page, per_page: perPage }
  });
}

export function getCase(token: string, caseId: UUID) {
  return apiGet<CaseResponse>(`/v1/cases/${caseId}`, { token });
}

export function updateCaseOwner(token: string, caseId: UUID, ownerId: UUID | null) {
  return apiPatch<CaseResponse>(`/v1/cases/${caseId}`, {
    token,
    data: { owner_id: ownerId }
  });
}

export function offerHelp(token: string, caseId: UUID) {
  return apiPost<CaseHelperResponse>(`/v1/cases/${caseId}/helpers`, { token });
}

export function withdrawHelp(token: string, caseId: UUID, userId: UUID) {
  return apiDelete<CaseHelperResponse>(`/v1/cases/${caseId}/helpers/${userId}`, { token });
}

export function listCaseNotes(token: string, caseId: UUID) {
  return apiGet<CaseNoteResponse[]>(`/v1/cases/${caseId}/notes`, { token });
}

export function addCaseNote(
  token: string,
  caseId: UUID,
  payload: {
    body: string;
    support_type?: string;
    hours_contributed?: number;
    attachment_s3_key?: string;
  }
) {
  return apiPost<CaseNoteResponse>(`/v1/cases/${caseId}/notes`, { token, data: payload });
}

export function closeCase(
  token: string,
  caseId: UUID,
  payload: {
    closure_remarks: string;
    resolution_type: "resolved" | "stale" | "invalid" | "withdrawn";
    impact_story?: string;
    impact_consent: boolean;
  }
) {
  return apiPost<CaseClosureResponse>(`/v1/cases/${caseId}/close`, { token, data: payload });
}

export function reopenCase(token: string, caseId: UUID) {
  return apiPost<CaseResponse>(`/v1/cases/${caseId}/reopen`, { token });
}
