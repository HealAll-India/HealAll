/**
 * Tests for frontend/app/page.tsx
 *
 * This PR replaced CSS-module-based Guidelines + Contribute sections
 * with global `.hsec` classes and restructured the Community Guidelines
 * section to include a 4-card PDF scroll rail + embedded PDF viewer.
 * The Developer Contribution section gained dark `.hsec` variant classes.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import HomePage from "../page";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/link so it just renders an <a> in jsdom
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock AuthRedirect (client component that uses hooks/router)
vi.mock("@/components/auth/auth-redirect", () => ({
  AuthRedirect: () => null,
}));

// The landing page mounts async server components (they `await` a fetch to
// /v1/public/*) plus a client FAB. React Testing Library can't render async
// server components synchronously, so stub them — this suite covers the
// static landing markup (guidelines, contribute), not the live data widgets.
vi.mock("@/components/landing/live-stats", () => ({ LiveStats: () => null }));
vi.mock("@/components/landing/live-feed-preview", () => ({ LiveFeedPreview: () => null }));
vi.mock("@/components/landing/live-impact-strip", () => ({
  LiveFeedHeadCount: () => null,
  LiveImpactStrip: () => null,
}));
vi.mock("@/components/seo/json-ld", () => ({ JsonLd: () => null }));
vi.mock("@/components/feedback/report-issue-fab", () => ({ ReportIssueFab: () => null }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<HomePage />);
}

// ---------------------------------------------------------------------------
// Community Guidelines section
// ---------------------------------------------------------------------------

describe("Community Guidelines section", () => {
  beforeEach(() => renderPage());

  it("renders the section with id='community-guidelines'", () => {
    const section = document.getElementById("community-guidelines");
    expect(section).not.toBeNull();
  });

  it("applies the global 'hsec' class to the section (not a CSS-module class)", () => {
    const section = document.getElementById("community-guidelines");
    expect(section).toHaveClass("hsec");
  });

  it("wraps content in a card with class 'hsec__card'", () => {
    const section = document.getElementById("community-guidelines")!;
    const card = section.querySelector(".hsec__card");
    expect(card).not.toBeNull();
  });

  it("renders the 'Community Guidelines' heading", () => {
    expect(
      screen.getByRole("heading", { name: /Community Guidelines/i })
    ).toBeInTheDocument();
  });

  it("renders the 'Read before joining' pill badge", () => {
    expect(screen.getByText(/Read before joining/i)).toBeInTheDocument();
  });

  it("renders the subtitle text about four principles", () => {
    expect(
      screen.getByText(/Four principles up top/i)
    ).toBeInTheDocument();
  });

  it("renders the 'Open PDF' CTA link with correct href and rel attributes", () => {
    const pdfLinks = screen.getAllByRole("link", { name: /Open PDF/i });
    expect(pdfLinks.length).toBeGreaterThanOrEqual(1);
    const openPdfLink = pdfLinks[0];
    expect(openPdfLink).toHaveAttribute("href", "/community-guidelines.pdf");
    expect(openPdfLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(openPdfLink).toHaveAttribute("target", "_blank");
  });

  it("applies 'hsec__cta' class to the Open PDF CTA link", () => {
    const openPdfLink = screen.getAllByRole("link", { name: /Open PDF/i })[0];
    expect(openPdfLink).toHaveClass("hsec__cta");
  });

  it("renders the footer note mentioning guidelines apply to all members", () => {
    expect(
      screen.getByText(/These guidelines apply to all members/i)
    ).toBeInTheDocument();
  });

  it("footer note includes 'HealAll v1.0'", () => {
    expect(
      screen.getByText(/HealAll v1\.0/i)
    ).toBeInTheDocument();
  });

  it("renders the 'Download ↓' footer link with correct href", () => {
    // Use exact text to distinguish from the pdf-viewer "Download PDF" control
    const downloadLink = screen.getByRole("link", { name: "Download ↓" });
    expect(downloadLink).toHaveAttribute("href", "/community-guidelines.pdf");
    // Self-hosted same-origin PDF uses the download attribute (no target/rel).
    expect(downloadLink).toHaveAttribute("download", "HealAll-Community-Guidelines.pdf");
  });

  it("applies 'hsec__foot-link' class to the Download footer link", () => {
    const downloadLink = screen.getByRole("link", { name: "Download ↓" });
    expect(downloadLink).toHaveClass("hsec__foot-link");
  });
});

// ---------------------------------------------------------------------------
// Community Guidelines — PDF scroll rail (4 guideline cards)
// ---------------------------------------------------------------------------

describe("Community Guidelines — PDF scroll rail", () => {
  beforeEach(() => renderPage());

  it("renders the 'pdf-scroll__rail' container", () => {
    const rail = document.querySelector(".pdf-scroll__rail");
    expect(rail).not.toBeNull();
  });

  it("renders exactly four pdf-page cards", () => {
    const cards = document.querySelectorAll(".pdf-page");
    expect(cards).toHaveLength(4);
  });

  it("renders card '01 · Identity' with correct heading and intro", () => {
    expect(screen.getByText("01 · Identity")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Be a verified neighbour/i })
    ).toBeInTheDocument();
    // The intro text unique to this card (differs from the "how it works" section)
    expect(
      screen.getByText(/Show your real name, your real city\./i)
    ).toBeInTheDocument();
  });

  it("renders card '02 · Honesty' with correct heading and intro", () => {
    expect(screen.getByText("02 · Honesty")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Help honestly/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Offering help is a commitment/i)
    ).toBeInTheDocument();
  });

  it("renders card '03 · Safety' with correct heading and intro", () => {
    expect(screen.getByText("03 · Safety")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Money & meetings/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/HealAll never asks for payment on your behalf/i)
    ).toBeInTheDocument();
  });

  it("renders card '04 · Conduct' with correct heading and intro", () => {
    expect(screen.getByText("04 · Conduct")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Keep it human/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We're a neighbourhood, not a startup/i)
    ).toBeInTheDocument();
  });

  it("renders bullet points for each card (Identity card)", () => {
    expect(
      screen.getByText(/One account per person — no anonymous handles/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verified members get the ✓ pill/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Vouch responsibly — your name backs theirs/i)
    ).toBeInTheDocument();
  });

  it("renders bullet points for the Honesty card", () => {
    expect(
      screen.getByText(/Reply to DMs within 24 hours/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No money requests until trust is built/i)
    ).toBeInTheDocument();
  });

  it("renders bullet points for the Safety card", () => {
    expect(
      screen.getByText(/Meet first responders in public/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Keep receipts and screenshots/i)
    ).toBeInTheDocument();
  });

  it("renders bullet points for the Conduct card", () => {
    expect(
      screen.getByText(/No solicitation, no proselytising/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Disagree without being a jerk/i)
    ).toBeInTheDocument();
  });

  it("each pdf-page has a pdf-page__bar and pdf-page__num child", () => {
    const cards = document.querySelectorAll(".pdf-page");
    cards.forEach((card) => {
      expect(card.querySelector(".pdf-page__bar")).not.toBeNull();
      expect(card.querySelector(".pdf-page__num")).not.toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Community Guidelines — PDF viewer (iframe embed)
// ---------------------------------------------------------------------------

describe("Community Guidelines — embedded PDF viewer", () => {
  beforeEach(() => renderPage());

  it("renders a pdf-viewer container", () => {
    const viewer = document.querySelector(".pdf-viewer");
    expect(viewer).not.toBeNull();
  });

  it("renders the pdf-viewer bar with title 'HealAll · Community Guidelines v1.0'", () => {
    expect(
      screen.getByText(/HealAll · Community Guidelines v1\.0/i)
    ).toBeInTheDocument();
  });

  it("renders the page indicator 'Embedded PDF · scroll to read'", () => {
    expect(
      screen.getByText(/Embedded PDF · scroll to read/i)
    ).toBeInTheDocument();
  });

  it("renders the iframe with the self-hosted PDF src", () => {
    const iframe = document.querySelector("iframe.pdf-viewer__frame");
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute("src", "/community-guidelines.pdf");
  });

  it("renders the mobile tap-to-open PDF card (shown via CSS below 768px)", () => {
    const mobileCard = document.querySelector("a.pdf-viewer__mobile");
    expect(mobileCard).not.toBeNull();
    expect(mobileCard).toHaveAttribute("href", "/community-guidelines.pdf");
    expect(mobileCard).toHaveAttribute("target", "_blank");
    expect(mobileCard).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("iframe has loading='lazy' attribute for performance", () => {
    const iframe = document.querySelector("iframe.pdf-viewer__frame");
    expect(iframe).toHaveAttribute("loading", "lazy");
  });

  it("iframe has a descriptive title for accessibility", () => {
    const iframe = document.querySelector("iframe.pdf-viewer__frame");
    expect(iframe).toHaveAttribute("title", "HealAll Community Guidelines");
  });

  it("iframe does NOT have an 'allow' attribute (removed in this PR)", () => {
    const iframe = document.querySelector("iframe.pdf-viewer__frame");
    expect(iframe).not.toHaveAttribute("allow");
  });

  it("renders the 'Open in new tab' control link with aria-label", () => {
    const openTabBtn = screen.getByRole("link", { name: /Open in new tab/i });
    expect(openTabBtn).toBeInTheDocument();
    expect(openTabBtn).toHaveAttribute("href", "/community-guidelines.pdf");
  });

  it("renders the 'Download PDF' control link with aria-label", () => {
    const downloadBtn = screen.getByRole("link", { name: /Download PDF/i });
    expect(downloadBtn).toBeInTheDocument();
  });

  it("control links have noopener noreferrer rel for security", () => {
    const openTabBtn = screen.getByRole("link", { name: /Open in new tab/i });
    expect(openTabBtn).toHaveAttribute("rel", "noopener noreferrer");
  });
});

// ---------------------------------------------------------------------------
// Developer Contribution section
// ---------------------------------------------------------------------------

describe("Developer Contribution section", () => {
  beforeEach(() => renderPage());

  it("renders the 'Contribute as a Developer' heading", () => {
    expect(
      screen.getByRole("heading", { name: /Contribute as a Developer/i })
    ).toBeInTheDocument();
  });

  it("applies the global 'hsec' class (not CSS-module class)", () => {
    const headings = screen.getAllByRole("heading");
    const contributeHeading = headings.find((h) =>
      /Contribute as a Developer/i.test(h.textContent || "")
    );
    // Walk up to find the section
    let node: HTMLElement | null = contributeHeading?.parentElement || null;
    while (node && node.tagName !== "SECTION") {
      node = node.parentElement;
    }
    expect(node).toHaveClass("hsec");
  });

  it("renders the dark variant pill badge 'Open source'", () => {
    // There may be other pills; find the dark-variant one
    const pillDark = document.querySelector(".hsec__pill--dark");
    expect(pillDark).not.toBeNull();
    expect(pillDark).toHaveTextContent(/Open source/i);
  });

  it("renders the dark icon variant 'hsec__icon--dark'", () => {
    const darkIcon = document.querySelector(".hsec__icon--dark");
    expect(darkIcon).not.toBeNull();
  });

  it("renders the 'View on GitHub' CTA with dark class and correct href", () => {
    const githubLink = screen.getByRole("link", { name: /View on GitHub/i });
    expect(githubLink).toHaveAttribute(
      "href",
      "https://github.com/anupam8nith/HealAll"
    );
    expect(githubLink).toHaveClass("hsec__cta--dark");
    expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(githubLink).toHaveAttribute("target", "_blank");
  });

  it("renders the subtitle about building in the open", () => {
    expect(
      screen.getByText(/HealAll is built in the open by neighbours/i)
    ).toBeInTheDocument();
  });

  it("renders footer note '⭐ Fork · open an issue · ship a PR'", () => {
    expect(
      screen.getByText(/Fork · open an issue · ship a PR/i)
    ).toBeInTheDocument();
  });

  it("renders the 'Read README.md' footer link with correct href", () => {
    const readmeLink = screen.getByRole("link", { name: /Read README\.md/i });
    expect(readmeLink).toHaveAttribute(
      "href",
      "https://github.com/anupam8nith/HealAll/blob/main/README.md"
    );
    expect(readmeLink).toHaveClass("hsec__foot-link");
  });
});

// ---------------------------------------------------------------------------
// Developer Contribution — Tech stack items
// ---------------------------------------------------------------------------

describe("Developer Contribution — Tech stack", () => {
  beforeEach(() => renderPage());

  it("renders the '🔧 Tech stack' column label", () => {
    expect(screen.getByText(/Tech stack/i)).toBeInTheDocument();
  });

  it("renders 4 stack-item elements", () => {
    const stackItems = document.querySelectorAll(".stack-item");
    expect(stackItems).toHaveLength(4);
  });

  it("renders FastAPI + SQLAlchemy stack item with sub-text", () => {
    expect(screen.getByText("FastAPI + SQLAlchemy")).toBeInTheDocument();
    expect(screen.getByText("Python 3.12, async")).toBeInTheDocument();
  });

  it("renders Next.js 16 + React 19 stack item", () => {
    expect(screen.getByText("Next.js 16 + React 19")).toBeInTheDocument();
    expect(screen.getByText("TypeScript, App Router")).toBeInTheDocument();
  });

  it("renders PostgreSQL + Redis stack item", () => {
    expect(screen.getByText("PostgreSQL + Redis")).toBeInTheDocument();
    expect(screen.getByText("Neon, Upstash")).toBeInTheDocument();
  });

  it("renders Railway + Vercel stack item", () => {
    expect(screen.getByText("Railway + Vercel")).toBeInTheDocument();
    expect(screen.getByText("Backend + Frontend deploy")).toBeInTheDocument();
  });

  it("each stack-item has stack-item__ico, stack-item__name, stack-item__sub", () => {
    const stackItems = document.querySelectorAll(".stack-item");
    stackItems.forEach((item) => {
      expect(item.querySelector(".stack-item__ico")).not.toBeNull();
      expect(item.querySelector(".stack-item__name")).not.toBeNull();
      expect(item.querySelector(".stack-item__sub")).not.toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Developer Contribution — Contribution areas with tone modifiers
// ---------------------------------------------------------------------------

describe("Developer Contribution — Contribution areas", () => {
  beforeEach(() => renderPage());

  it("renders the '🌱 Contribution areas' column label", () => {
    expect(screen.getByText(/Contribution areas/i)).toBeInTheDocument();
  });

  it("renders 4 area-item elements", () => {
    const areaItems = document.querySelectorAll(".area-item");
    expect(areaItems).toHaveLength(4);
  });

  it("renders 'Frontend UI & UX' area with green tone class", () => {
    const item = screen.getByText("Frontend UI & UX").closest(".area-item");
    expect(item).not.toBeNull();
    expect(item).toHaveClass("area-item--green");
  });

  it("renders 'API features' area with blue tone class", () => {
    const item = screen.getByText("API features").closest(".area-item");
    expect(item).not.toBeNull();
    expect(item).toHaveClass("area-item--blue");
  });

  it("renders 'Tests & coverage' area with purple tone class", () => {
    const item = screen.getByText("Tests & coverage").closest(".area-item");
    expect(item).not.toBeNull();
    expect(item).toHaveClass("area-item--purple");
  });

  it("renders 'Docs & translations' area with orange tone class", () => {
    const item = screen.getByText("Docs & translations").closest(".area-item");
    expect(item).not.toBeNull();
    expect(item).toHaveClass("area-item--orange");
  });

  it("area-item class names are composed as 'area-item area-item--{tone}' (dynamic template literal)", () => {
    // Verify the base class is always present alongside the tone modifier
    const areaItems = document.querySelectorAll(".area-item");
    areaItems.forEach((item) => {
      expect(item.classList.contains("area-item")).toBe(true);
      const hasTone = ["green", "blue", "purple", "orange"].some((t) =>
        item.classList.contains(`area-item--${t}`)
      );
      expect(hasTone).toBe(true);
    });
  });

  it("no area-item has an undefined or empty tone modifier (regression: broken template literal)", () => {
    const badItems = document.querySelectorAll(
      ".area-item--undefined, .area-item--, .area-item--null"
    );
    expect(badItems).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Removal of CSS module dependency (key PR change)
// ---------------------------------------------------------------------------

describe("CSS module import removal", () => {
  it("page renders without any element carrying old CSS-module class patterns (s.guidelines, s.contributeCard, etc.)", () => {
    renderPage();
    // CSS modules generate classes like `guidelines`, `contributeCard`, etc.
    // If the old import were present they'd appear as hashed names; since we're
    // in jsdom with no module transform, they would literally be undefined.
    // The simplest regression guard: the old section class is gone, replaced by hsec.
    const oldGuidelinesClass = document.querySelector(".guidelines");
    const oldContributeClass = document.querySelector(".contributeCard");
    expect(oldGuidelinesClass).toBeNull();
    expect(oldContributeClass).toBeNull();
  });

  it("both sections use 'hsec__card' as their card wrapper", () => {
    renderPage();
    const cards = document.querySelectorAll(".hsec__card");
    // Community Guidelines + Developer Contribution = at least 2
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });
});