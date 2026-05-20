/**
 * Public changelog.
 *
 * Owner-only edits: this file is committed to the repository, so only
 * maintainers with merge access can update it. Add a new entry to the
 * top of the array for each shipped release.
 */

export type ChangelogTag = "feature" | "fix" | "infra" | "chore";

export interface ChangelogItem {
  tag: ChangelogTag;
  text: string;
}

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title?: string;
  items: ChangelogItem[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v0.6.0",
    date: "2026-05-20",
    title: "Landing-page feedback, contributors, changelog",
    items: [
      { tag: "feature", text: "Floating \"Report an issue\" button on the landing page — fans out to email + GitHub issue with label user-report." },
      { tag: "feature", text: "Public Contributors page listing maintainers and their links." },
      { tag: "feature", text: "Public Changelog page documenting shipped releases." },
      { tag: "infra", text: "Improved mobile breakpoints and viewport meta for the landing page and new pages." }
    ]
  },
  {
    version: "v0.5.0",
    date: "2026-04-24",
    title: "Profile photo upload",
    items: [
      { tag: "feature", text: "End-to-end profile photo upload via presigned PUT to S3." },
      { tag: "infra", text: "AWS CloudFormation stack for media + identity buckets with OIDC deploy role." }
    ]
  },
  {
    version: "v0.4.0",
    date: "2026-04-20",
    title: "Production launch",
    items: [
      { tag: "feature", text: "Public launch of healallindia.com on Vercel + api.healallindia.com on Railway." },
      { tag: "feature", text: "Community verification voting + post location pin + Get Directions." },
      { tag: "fix", text: "Post detail no-post-found handling — surfaces status-aware banner instead of generic error." }
    ]
  }
];
