import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar, initialsOf, toneOf } from "@/components/ui/avatar";
import { CategoryBadge, UrgencyBadge } from "@/components/ui/post-badges";
import { VerifiedBadge } from "@/components/ui/verified-badge";

describe("Avatar", () => {
  it("derives up to two initials", () => {
    expect(initialsOf("Aisha Khan")).toBe("AK");
    expect(initialsOf("  priya  ")).toBe("P");
    expect(initialsOf("Ravi Kumar Sharma")).toBe("RS");
    expect(initialsOf("")).toBe("?");
  });

  it("gives the same name the same tone", () => {
    expect(toneOf("Aisha Khan")).toBe(toneOf("Aisha Khan"));
    expect(toneOf("Aisha Khan")).toBeGreaterThanOrEqual(0);
    expect(toneOf("Aisha Khan")).toBeLessThan(6);
  });

  it("renders initials without an image and is hidden from assistive tech", () => {
    const { container } = render(<Avatar name="Aisha Khan" />);
    const el = container.querySelector(".avatar");
    expect(el?.textContent).toBe("AK");
    expect(el?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("post badges", () => {
  it("labels categories with words, not raw enum values", () => {
    render(<CategoryBadge category="skill_sharing" />);
    expect(screen.getByText("Skills")).toBeTruthy();
  });

  it("renders urgency badges only for high and critical", () => {
    const { container, rerender } = render(<UrgencyBadge urgency="normal" />);
    expect(container.textContent).toBe("");
    rerender(<UrgencyBadge urgency="critical" />);
    expect(screen.getByText("Critical")).toBeTruthy();
  });
});

describe("VerifiedBadge", () => {
  it("renders nothing for unverified members", () => {
    const { container } = render(<VerifiedBadge level={0} />);
    expect(container.textContent).toBe("");
  });

  it("explains what was checked when tapped, and closes on Escape", () => {
    render(<VerifiedBadge level={2} />);
    const btn = screen.getByRole("button", { name: /id verified/i });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("note").textContent).toMatch(/government ID/i);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("note")).toBeNull();
  });
});
