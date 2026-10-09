import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InlineActionForm } from "@/components/moderation/inline-action-form";
import type { ReportResponse } from "@/lib/types/api";

const REPORT: ReportResponse = {
  id: "report-1",
  reporter_id: "reporter-1",
  target_type: "post",
  target_id: "post-1",
  reason: "fraud",
  description: null,
  status: "pending",
  created_at: "2026-10-01T00:00:00Z",
};

describe("InlineActionForm", () => {
  it("never targets the reporter by default — the API resolves the reported member", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<InlineActionForm report={REPORT} onSubmit={onSubmit} acting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /take action/i }));
    expect((screen.getByLabelText(/different member id/i) as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onSubmit).toHaveBeenCalledWith("report-1", "", "warn", "Report reviewed: fraud", undefined);
    expect(onSubmit.mock.calls[0][1]).not.toBe("reporter-1");
  });

  it("passes an explicit override through, trimmed", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<InlineActionForm report={REPORT} onSubmit={onSubmit} acting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /take action/i }));
    fireEvent.change(screen.getByLabelText(/different member id/i), { target: { value: "  user-9 " } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onSubmit.mock.calls[0][1]).toBe("user-9");
  });

  it("submits an empty target for whitespace-only input", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<InlineActionForm report={REPORT} onSubmit={onSubmit} acting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /take action/i }));
    fireEvent.change(screen.getByLabelText(/different member id/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onSubmit.mock.calls[0][1]).toBe("");
  });
});
