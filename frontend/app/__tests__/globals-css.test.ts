/**
 * Tests for the new CSS class selectors added to frontend/app/globals.css
 *
 * This PR added the following class groups:
 *  - .hsec*          — Home info section layout / card system
 *  - .pdf-scroll*    — Horizontal scroll rail for PDF preview cards
 *  - .pdf-page*      — Individual preview card inside the scroll rail
 *  - .pdf-viewer*    — Embedded iframe PDF viewer
 *  - .contrib-col*   — Contribution section column
 *  - .stack-item*    — Tech-stack row item
 *  - .area-item*     — Contribution area item (with colour tone variants)
 *  - @media (max-width: 720px) overrides for responsive layout
 *
 * These tests validate that each declared selector is present in the
 * stylesheet source, acting as a contract that the class names used in
 * page.tsx have corresponding CSS definitions.
 */
import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect, beforeAll } from "vitest";

const CSS_PATH = path.resolve(
  __dirname,
  "../../app/globals.css"
);

let css: string;

beforeAll(() => {
  css = readFileSync(CSS_PATH, "utf-8");
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function hasSelector(selector: string): boolean {
  // Strip whitespace variations and check plain presence
  return css.includes(selector);
}

// ---------------------------------------------------------------------------
// hsec — section / card system
// ---------------------------------------------------------------------------

describe("globals.css — .hsec section classes", () => {
  it("defines .hsec base class", () => {
    expect(hasSelector(".hsec {")).toBe(true);
  });

  it("defines .hsec__card", () => {
    expect(hasSelector(".hsec__card {")).toBe(true);
  });

  it("defines .hsec__head", () => {
    expect(hasSelector(".hsec__head {")).toBe(true);
  });

  it("defines .hsec__head-left", () => {
    expect(hasSelector(".hsec__head-left {")).toBe(true);
  });

  it("defines .hsec__icon", () => {
    expect(hasSelector(".hsec__icon {")).toBe(true);
  });

  it("defines .hsec__icon--dark modifier", () => {
    expect(hasSelector(".hsec__icon--dark {")).toBe(true);
  });

  it("defines .hsec__pill", () => {
    expect(hasSelector(".hsec__pill {")).toBe(true);
  });

  it("defines .hsec__pill--dark modifier", () => {
    expect(hasSelector(".hsec__pill--dark {")).toBe(true);
  });

  it("defines .hsec__title", () => {
    expect(hasSelector(".hsec__title {")).toBe(true);
  });

  it("defines .hsec__sub", () => {
    expect(hasSelector(".hsec__sub {")).toBe(true);
  });

  it("defines .hsec__cta", () => {
    expect(hasSelector(".hsec__cta {")).toBe(true);
  });

  it("defines .hsec__cta hover state", () => {
    expect(hasSelector(".hsec__cta:hover {")).toBe(true);
  });

  it("defines .hsec__cta--dark modifier", () => {
    expect(hasSelector(".hsec__cta--dark {")).toBe(true);
  });

  it("defines .hsec__cta--dark hover state", () => {
    expect(hasSelector(".hsec__cta--dark:hover {")).toBe(true);
  });

  it("defines .hsec__body", () => {
    expect(hasSelector(".hsec__body {")).toBe(true);
  });

  it("defines .hsec__foot", () => {
    expect(hasSelector(".hsec__foot {")).toBe(true);
  });

  it("defines .hsec__note", () => {
    expect(hasSelector(".hsec__note {")).toBe(true);
  });

  it("defines .hsec__foot-link", () => {
    expect(hasSelector(".hsec__foot-link {")).toBe(true);
  });

  it("defines .hsec__foot-link hover state", () => {
    expect(hasSelector(".hsec__foot-link:hover {")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pdf-scroll — horizontal scroll rail
// ---------------------------------------------------------------------------

describe("globals.css — .pdf-scroll rail classes", () => {
  it("defines .pdf-scroll container", () => {
    expect(hasSelector(".pdf-scroll {")).toBe(true);
  });

  it("defines .pdf-scroll__rail", () => {
    expect(hasSelector(".pdf-scroll__rail {")).toBe(true);
  });

  it(".pdf-scroll__rail uses scroll-snap-type", () => {
    // Verify the horizontal scroll snap behaviour is declared
    expect(css).toMatch(/scroll-snap-type:\s*x mandatory/);
  });
});

// ---------------------------------------------------------------------------
// pdf-page — individual preview cards in the rail
// ---------------------------------------------------------------------------

describe("globals.css — .pdf-page card classes", () => {
  it("defines .pdf-page", () => {
    expect(hasSelector(".pdf-page {")).toBe(true);
  });

  it(".pdf-page uses scroll-snap-align: start", () => {
    expect(css).toMatch(/scroll-snap-align:\s*start/);
  });

  it("defines .pdf-page__bar (green gradient top stripe)", () => {
    expect(hasSelector(".pdf-page__bar {")).toBe(true);
  });

  it(".pdf-page__bar uses a green gradient", () => {
    // Should contain a gradient that includes the brand green (#10b981 or #059669)
    const barBlock = css.substring(
      css.indexOf(".pdf-page__bar {"),
      css.indexOf("}", css.indexOf(".pdf-page__bar {")) + 1
    );
    expect(barBlock).toMatch(/#10b981|#059669/);
  });

  it("defines .pdf-page__num", () => {
    expect(hasSelector(".pdf-page__num {")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pdf-viewer — embedded iframe viewer
// ---------------------------------------------------------------------------

describe("globals.css — .pdf-viewer iframe classes", () => {
  it("defines .pdf-viewer wrapper", () => {
    expect(hasSelector(".pdf-viewer {")).toBe(true);
  });

  it("defines .pdf-viewer__bar (toolbar strip)", () => {
    expect(hasSelector(".pdf-viewer__bar {")).toBe(true);
  });

  it("defines .pdf-viewer__title", () => {
    expect(hasSelector(".pdf-viewer__title {")).toBe(true);
  });

  it("defines .pdf-viewer__page-indicator", () => {
    expect(hasSelector(".pdf-viewer__page-indicator {")).toBe(true);
  });

  it("defines .pdf-viewer__controls", () => {
    expect(hasSelector(".pdf-viewer__controls {")).toBe(true);
  });

  it("defines .pdf-viewer__btn", () => {
    expect(hasSelector(".pdf-viewer__btn {")).toBe(true);
  });

  it("defines .pdf-viewer__btn hover state", () => {
    expect(hasSelector(".pdf-viewer__btn:hover {")).toBe(true);
  });

  it("defines .pdf-viewer__frame (the iframe element)", () => {
    expect(hasSelector(".pdf-viewer__frame {")).toBe(true);
  });

  it(".pdf-viewer__frame has height: 520px (desktop)", () => {
    const frameBlock = css.substring(
      css.indexOf(".pdf-viewer__frame {"),
      css.indexOf("}", css.indexOf(".pdf-viewer__frame {")) + 1
    );
    expect(frameBlock).toContain("520px");
  });
});

// ---------------------------------------------------------------------------
// contrib-col — contribution section columns
// ---------------------------------------------------------------------------

describe("globals.css — .contrib-col classes", () => {
  it("defines .contrib-col", () => {
    expect(hasSelector(".contrib-col {")).toBe(true);
  });

  it("defines .contrib-col__label", () => {
    expect(hasSelector(".contrib-col__label {")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// stack-item — tech stack rows
// ---------------------------------------------------------------------------

describe("globals.css — .stack-item classes", () => {
  it("defines .stack-item", () => {
    expect(hasSelector(".stack-item {")).toBe(true);
  });

  it("defines .stack-item__ico", () => {
    expect(hasSelector(".stack-item__ico {")).toBe(true);
  });

  it("defines .stack-item__name", () => {
    expect(hasSelector(".stack-item__name {")).toBe(true);
  });

  it("defines .stack-item__sub", () => {
    expect(hasSelector(".stack-item__sub {")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// area-item — contribution areas with tone variants
// ---------------------------------------------------------------------------

describe("globals.css — .area-item and tone-modifier classes", () => {
  it("defines .area-item base", () => {
    expect(hasSelector(".area-item {")).toBe(true);
  });

  it("defines .area-item--green tone modifier", () => {
    expect(hasSelector(".area-item--green")).toBe(true);
  });

  it("defines .area-item--blue tone modifier", () => {
    expect(hasSelector(".area-item--blue")).toBe(true);
  });

  it("defines .area-item--purple tone modifier", () => {
    expect(hasSelector(".area-item--purple")).toBe(true);
  });

  it("defines .area-item--orange tone modifier", () => {
    expect(hasSelector(".area-item--orange")).toBe(true);
  });

  it(".area-item--green uses a green background (#ecfdf5)", () => {
    const greenBlock = css.substring(
      css.indexOf(".area-item--green"),
      css.indexOf("}", css.indexOf(".area-item--green")) + 1
    );
    expect(greenBlock).toContain("#ecfdf5");
  });

  it(".area-item--blue uses a blue background (#eff6ff)", () => {
    const blueBlock = css.substring(
      css.indexOf(".area-item--blue"),
      css.indexOf("}", css.indexOf(".area-item--blue")) + 1
    );
    expect(blueBlock).toContain("#eff6ff");
  });

  it(".area-item--purple uses a purple background (#f5f3ff)", () => {
    const purpleBlock = css.substring(
      css.indexOf(".area-item--purple"),
      css.indexOf("}", css.indexOf(".area-item--purple")) + 1
    );
    expect(purpleBlock).toContain("#f5f3ff");
  });

  it(".area-item--orange uses an orange background (#fff7ed)", () => {
    const orangeBlock = css.substring(
      css.indexOf(".area-item--orange"),
      css.indexOf("}", css.indexOf(".area-item--orange")) + 1
    );
    expect(orangeBlock).toContain("#fff7ed");
  });
});

// ---------------------------------------------------------------------------
// Mobile responsive overrides (@media max-width: 720px)
// ---------------------------------------------------------------------------

describe("globals.css — mobile responsive overrides", () => {
  it("declares a @media (max-width: 720px) block", () => {
    expect(css).toMatch(/@media\s*\(\s*max-width:\s*720px\s*\)/);
  });

  it("reduces .hsec__card padding to 20px on mobile", () => {
    const mediaIdx = css.lastIndexOf("@media (max-width: 720px)");
    const mediaBlock = css.substring(mediaIdx);
    expect(mediaBlock).toContain(".hsec__card");
    expect(mediaBlock).toContain("20px");
  });

  it("reduces .pdf-viewer__frame height to 420px on mobile", () => {
    const mediaIdx = css.lastIndexOf("@media (max-width: 720px)");
    const mediaBlock = css.substring(mediaIdx);
    expect(mediaBlock).toContain(".pdf-viewer__frame");
    expect(mediaBlock).toContain("420px");
  });

  it("reduces .pdf-page width to 180px on mobile", () => {
    const mediaIdx = css.lastIndexOf("@media (max-width: 720px)");
    const mediaBlock = css.substring(mediaIdx);
    expect(mediaBlock).toContain(".pdf-page");
    expect(mediaBlock).toContain("180px");
  });
});

// ---------------------------------------------------------------------------
// Regression: new classes must appear AFTER the existing styles (line 1156+)
// ---------------------------------------------------------------------------

describe("globals.css — structural regression", () => {
  it("new hsec section appears after pre-existing .prof-hero rules", () => {
    const profHeroIdx = css.indexOf(".prof-hero {");
    const hsecIdx = css.indexOf(".hsec {");
    expect(profHeroIdx).toBeGreaterThan(-1);
    expect(hsecIdx).toBeGreaterThan(profHeroIdx);
  });

  it("section is introduced with the expected comment header", () => {
    expect(css).toContain("/* ===== Home info sections (hsec) ===== */");
  });
});