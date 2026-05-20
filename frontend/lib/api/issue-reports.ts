import { apiPost } from "./client";

export interface IssueReportPayload {
  description: string;
  contact_email?: string;
  page_url?: string;
  website?: string;
}

export interface IssueReportResponse {
  ok: boolean;
  partial: boolean;
  issue_url: string | null;
}

export function submitIssueReport(payload: IssueReportPayload) {
  return apiPost<IssueReportResponse>("/v1/issue-reports", { data: payload });
}
