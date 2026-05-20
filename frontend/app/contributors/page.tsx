import type { Metadata } from "next";
import Image from "next/image";

import { CONTRIBUTORS, getContributorInitials } from "@/lib/data/contributors";

export const metadata: Metadata = {
  title: "Contributors · HealAll",
  description: "The people building HealAll — India's invite-only mutual-aid community."
};

export default function ContributorsPage() {
  return (
    <main className="docpage">
      <header className="docpage__header">
        <h1 className="docpage__title">Contributors</h1>
        <p className="docpage__lede">
          HealAll is built by volunteers. This page recognises everyone who has shipped code, design,
          docs, or community work. Want to join? Fork the repo and open a PR.
        </p>
      </header>

      <div className="contrib-grid">
        {CONTRIBUTORS.map((c) => {
          const initials = getContributorInitials(c.name);
          return (
            <article key={c.id} className="contrib-card">
              <div className="contrib-card__avatar" aria-hidden={c.avatarUrl ? "true" : undefined}>
                {c.avatarUrl ? (
                  <Image
                    src={c.avatarUrl}
                    alt={`${c.name} avatar`}
                    width={80}
                    height={80}
                    unoptimized
                  />
                ) : (
                  initials || "··"
                )}
              </div>
              <h2 className="contrib-card__name">{c.name}</h2>
              <p className="contrib-card__role">{c.role}</p>
              {c.bio ? <p className="contrib-card__bio">{c.bio}</p> : null}
              <div className="contrib-card__links">
                {c.githubUrl ? (
                  <a href={c.githubUrl} target="_blank" rel="noopener noreferrer">
                    GitHub
                  </a>
                ) : null}
                {c.websiteUrl ? (
                  <a href={c.websiteUrl} target="_blank" rel="noopener noreferrer">
                    Website
                  </a>
                ) : null}
                {c.twitterUrl ? (
                  <a href={c.twitterUrl} target="_blank" rel="noopener noreferrer">
                    Twitter
                  </a>
                ) : null}
                {c.linkedinUrl ? (
                  <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer">
                    LinkedIn
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
