/**
 * Tests for .github/workflows/copilot-review.yml
 *
 * This PR replaced the simple `gh pr edit --add-reviewer "Copilot"` command
 * with a two-step GraphQL approach:
 *  1. Query `suggestedActors` to resolve the Copilot bot's node ID
 *  2. Run `requestReviews` mutation with that ID
 *
 * Key changes validated here:
 *  - `continue-on-error: true` was removed (the step now fails hard via `set -e`)
 *  - Three new env vars are injected: OWNER, REPO, PR_NODE_ID
 *  - The jq filter uses a case-insensitive regex `[Cc]opilot`
 *  - Empty-BOT_ID guard exits 0 with a ::warning:: annotation
 *  - The mutation uses `union: true` to avoid clobbering existing reviewers
 */
import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect, beforeAll } from "vitest";

// ---------------------------------------------------------------------------
// Load raw YAML content
// ---------------------------------------------------------------------------

const WORKFLOW_PATH = path.resolve(
  __dirname,
  "../../.github/workflows/copilot-review.yml"
);

let raw: string;

beforeAll(() => {
  raw = readFileSync(WORKFLOW_PATH, "utf-8");
});

// ---------------------------------------------------------------------------
// Workflow trigger and permissions
// ---------------------------------------------------------------------------

describe("copilot-review.yml — trigger configuration", () => {
  it("triggers on pull_request events", () => {
    expect(raw).toContain("pull_request:");
  });

  it("targets the 'main' branch", () => {
    expect(raw).toContain("branches: [main]");
  });

  it("triggers on opened, ready_for_review, and reopened types", () => {
    expect(raw).toMatch(/types:.*\[opened, ready_for_review, reopened\]/s);
  });

  it("declares pull-requests: write permission (required for requestReviews)", () => {
    expect(raw).toContain("pull-requests: write");
  });
});

// ---------------------------------------------------------------------------
// Draft PR skip condition
// ---------------------------------------------------------------------------

describe("copilot-review.yml — draft PR skip", () => {
  it("skips draft PRs via the job-level if condition", () => {
    expect(raw).toContain("!github.event.pull_request.draft");
  });
});

// ---------------------------------------------------------------------------
// continue-on-error removal (key PR change)
// ---------------------------------------------------------------------------

describe("copilot-review.yml — continue-on-error removed", () => {
  it("does NOT contain 'continue-on-error: true' (was removed in this PR)", () => {
    expect(raw).not.toContain("continue-on-error: true");
  });
});

// ---------------------------------------------------------------------------
// Environment variables injected into the step
// ---------------------------------------------------------------------------

describe("copilot-review.yml — environment variables", () => {
  it("injects OWNER from github.repository_owner", () => {
    expect(raw).toContain("OWNER: ${{ github.repository_owner }}");
  });

  it("injects REPO from github.event.repository.name", () => {
    expect(raw).toContain("REPO: ${{ github.event.repository.name }}");
  });

  it("injects PR_NODE_ID from github.event.pull_request.node_id", () => {
    expect(raw).toContain(
      "PR_NODE_ID: ${{ github.event.pull_request.node_id }}"
    );
  });

  it("injects GH_TOKEN from secrets.GITHUB_TOKEN", () => {
    expect(raw).toContain("GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
  });
});

// ---------------------------------------------------------------------------
// Shell script: set -e (fail-fast)
// ---------------------------------------------------------------------------

describe("copilot-review.yml — shell script safety", () => {
  it("uses 'set -e' for fail-fast behaviour", () => {
    expect(raw).toContain("set -e");
  });
});

// ---------------------------------------------------------------------------
// GraphQL suggestedActors query
// ---------------------------------------------------------------------------

describe("copilot-review.yml — suggestedActors GraphQL query", () => {
  it("queries the suggestedActors field", () => {
    expect(raw).toContain("suggestedActors");
  });

  it("passes CAN_BE_ASSIGNED capability filter", () => {
    expect(raw).toContain("CAN_BE_ASSIGNED");
  });

  it("requests first: 100 nodes to ensure the bot is found", () => {
    expect(raw).toContain("first: 100");
  });

  it("selects both Bot and User fragments (covers different bot account types)", () => {
    expect(raw).toContain("... on Bot { login id }");
    expect(raw).toContain("... on User { login id }");
  });

  it("passes owner and repo as GraphQL variables via -F flags", () => {
    expect(raw).toContain('-F owner="$OWNER"');
    expect(raw).toContain('-F repo="$REPO"');
  });

  it("uses case-insensitive jq regex [Cc]opilot to find the bot", () => {
    expect(raw).toContain("[Cc]opilot");
  });

  it("pipes through head -n1 to take only the first matching bot ID", () => {
    expect(raw).toContain("head -n1");
  });
});

// ---------------------------------------------------------------------------
// Empty BOT_ID guard
// ---------------------------------------------------------------------------

describe("copilot-review.yml — empty BOT_ID guard", () => {
  it('checks if BOT_ID is empty with [ -z "$BOT_ID" ]', () => {
    expect(raw).toContain('[ -z "$BOT_ID" ]');
  });

  it("emits a ::warning:: annotation when BOT_ID is not found", () => {
    expect(raw).toContain("::warning::");
    expect(raw).toContain("Copilot reviewer bot not available");
  });

  it("exits 0 (not failure) when bot is unavailable", () => {
    // Should find `exit 0` inside the if block
    expect(raw).toMatch(/if \[ -z "\$BOT_ID" \][\s\S]*?exit 0/);
  });

  it("mentions that bot can be enabled via repo/org settings in the warning", () => {
    expect(raw).toContain("Enable Copilot code review in repo/org settings");
  });
});

// ---------------------------------------------------------------------------
// requestReviews mutation
// ---------------------------------------------------------------------------

describe("copilot-review.yml — requestReviews mutation", () => {
  it("uses the requestReviews GraphQL mutation", () => {
    expect(raw).toContain("requestReviews");
  });

  it("passes PR node ID as the 'pr' variable via -F flag", () => {
    expect(raw).toContain('-F pr="$PR_NODE_ID"');
  });

  it("passes bot ID as the 'reviewer' variable via -F flag", () => {
    expect(raw).toContain('-F reviewer="$BOT_ID"');
  });

  it("uses 'union: true' to preserve existing reviewers", () => {
    expect(raw).toContain("union: true");
  });

  it("mutation input uses pullRequestId and userIds fields", () => {
    expect(raw).toContain("pullRequestId: $pr");
    expect(raw).toContain("userIds: [$reviewer]");
  });

  it("returns pullRequest { id } in the mutation response", () => {
    expect(raw).toContain("pullRequest { id }");
  });
});

// ---------------------------------------------------------------------------
// No legacy gh pr edit approach (key PR change)
// ---------------------------------------------------------------------------

describe("copilot-review.yml — legacy reviewer approach removed", () => {
  it("does NOT use the old 'gh pr edit --add-reviewer' command", () => {
    expect(raw).not.toContain("gh pr edit");
    expect(raw).not.toContain("--add-reviewer");
  });

  it("does NOT reference the literal string Copilot as a reviewer name (now uses node ID)", () => {
    // Old approach was --add-reviewer "Copilot"
    expect(raw).not.toContain('--add-reviewer "Copilot"');
  });
});