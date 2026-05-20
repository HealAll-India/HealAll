/**
 * Contributors registry.
 *
 * Owner-only edits: this file is committed to the repository, so only
 * maintainers with merge access can update it. To add a contributor,
 * append a new entry below and open a PR.
 */

export interface Contributor {
  id: string;
  name: string;
  role: string;
  bio?: string;
  avatarUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
}

export const CONTRIBUTORS: Contributor[] = [
  {
    id: "anupam-kumar",
    name: "Anupam Kumar",
    role: "Founder · Maintainer",
    bio: "Builds HealAll end-to-end. Backend, frontend, infra, design.",
    avatarUrl: "https://avatars.githubusercontent.com/u/anupam8nith",
    githubUrl: "https://github.com/anupam8nith",
    websiteUrl: "https://healallindia.com"
  }
];

export function getContributorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
