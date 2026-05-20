import type { Metadata } from "next";

import { CHANGELOG, type ChangelogTag } from "@/lib/data/changelog";

export const metadata: Metadata = {
  title: "Changelog · HealAll",
  description: "What's new in HealAll — features shipped, fixes landed, infra improvements."
};

const TAG_LABEL: Record<ChangelogTag, string> = {
  feature: "Feature",
  fix: "Fix",
  infra: "Infra",
  chore: "Chore"
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

export default function ChangelogPage() {
  return (
    <main className="docpage">
      <header className="docpage__header">
        <h1 className="docpage__title">Changelog</h1>
        <p className="docpage__lede">
          A running log of features, fixes, and improvements shipped on HealAll. Newest entries first.
        </p>
      </header>

      <div className="changelog-list">
        {CHANGELOG.map((entry) => (
          <article key={entry.version} className="changelog-entry">
            <div className="changelog-entry__head">
              <span className="changelog-entry__version">{entry.version}</span>
              <time className="changelog-entry__date" dateTime={entry.date}>
                {formatDate(entry.date)}
              </time>
            </div>
            {entry.title ? <p className="changelog-entry__title">{entry.title}</p> : null}
            <ul className="changelog-entry__items">
              {entry.items.map((item, idx) => (
                <li key={idx}>
                  <span className={`changelog-tag changelog-tag--${item.tag}`}>
                    {TAG_LABEL[item.tag]}
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </main>
  );
}
