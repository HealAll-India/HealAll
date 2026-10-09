import { describe, expect, it } from "vitest";

import { postCategories, postUrgencies } from "@/lib/constants";
import {
  CATEGORIES,
  caseStatusMeta,
  categoryMeta,
  humanize,
  postStatusMeta,
  urgencyMeta,
} from "@/lib/ui/post-meta";

describe("categoryMeta", () => {
  it("has metadata for every category the API accepts", () => {
    for (const value of postCategories) {
      const meta = categoryMeta(value);
      expect(meta.value).toBe(value);
      expect(meta.label).not.toBe("");
      expect(meta.hint).not.toBe("");
    }
    expect(CATEGORIES).toHaveLength(postCategories.length);
  });

  it("degrades unknown values to a humanised label instead of crashing", () => {
    expect(categoryMeta("food_bank").label).toBe("Food bank");
  });
});

describe("urgencyMeta", () => {
  it("covers every urgency the API accepts", () => {
    for (const value of postUrgencies) expect(urgencyMeta(value)?.value).toBe(value);
  });

  it("only badges high and critical (avoids alarm fatigue)", () => {
    const badged = postUrgencies.filter((u) => urgencyMeta(u)?.badge);
    expect(badged).toEqual(["high", "critical"]);
  });
});

describe("status metadata", () => {
  it("labels backend post statuses in plain language", () => {
    expect(postStatusMeta("submitted").label).toBe("Awaiting approval");
    expect(postStatusMeta("active").label).toBe("Live");
  });

  it("knows the backend case statuses (active / closure_requested / closed / reopened)", () => {
    expect(caseStatusMeta("active").label).toBe("Active");
    expect(caseStatusMeta("closure_requested").label).toBe("Closing");
    expect(caseStatusMeta("reopened").tone).toBe("info");
  });

  it("humanises unknown statuses, replacing every underscore", () => {
    expect(postStatusMeta("on_hold_by_mod").label).toBe("On hold by mod");
    expect(humanize("pending_closure_x")).toBe("Pending closure x");
  });
});
