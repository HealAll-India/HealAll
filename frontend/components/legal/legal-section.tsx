import type { ReactNode } from "react";

/** One titled section of a legal or policy page. Styles live in app/styles/legal.css. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2 className="legal-section__title">{title}</h2>
      <div className="legal-section__body">{children}</div>
    </section>
  );
}
