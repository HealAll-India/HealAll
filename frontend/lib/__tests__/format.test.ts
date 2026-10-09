import { describe, expect, it } from "vitest";

import { formatCount, plural, relativeTime } from "@/lib/format";

const NOW = new Date("2026-10-02T13:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("relativeTime", () => {
  it("buckets into compact relative labels", () => {
    expect(relativeTime(ago(20_000), NOW)).toBe("Just now");
    expect(relativeTime(ago(5 * 60_000), NOW)).toBe("5m ago");
    expect(relativeTime(ago(3 * 3_600_000), NOW)).toBe("3h ago");
    expect(relativeTime(ago(2 * 86_400_000), NOW)).toBe("2d ago");
  });

  it("falls back to a short date after a week", () => {
    expect(relativeTime("2026-09-12T10:00:00Z", NOW)).toMatch(/12 Sep/);
  });

  it("treats future timestamps (clock skew) as just now and bad input as empty", () => {
    expect(relativeTime(ago(-60_000), NOW)).toBe("Just now");
    expect(relativeTime("not-a-date", NOW)).toBe("");
  });
});

describe("formatCount / plural", () => {
  it("uses Indian compact notation", () => {
    expect(formatCount(950)).toBe("950");
    expect(formatCount(120_000)).toMatch(/1\.2\s?L/);
  });

  it("pluralises", () => {
    expect(plural(1, "helper")).toBe("1 helper");
    expect(plural(3, "helper")).toBe("3 helpers");
  });
});
