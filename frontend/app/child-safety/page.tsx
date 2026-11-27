import Link from "next/link";

import { LegalSection } from "@/components/legal/legal-section";

export const metadata = {
  title: "Child safety standards · HealAll",
  description: "HealAll's standards against child sexual abuse and exploitation, and how to report it.",
};

/** Published child safety standards, which Google Play requires of social apps. */
export default function ChildSafetyPage() {
  return (
    <main className="legal">
      <div className="legal__header">
        <p className="legal__updated">Last updated: November 26, 2026</p>
        <h1 className="legal__title">Child safety standards</h1>
        <p className="legal__lead">
          HealAll has zero tolerance for child sexual abuse and exploitation (CSAE). This page sets out what we ban,
          how to report it, and what we do when we find it. It applies to everything on HealAll: posts, comments,
          profiles and private messages, on the website and in the HealAll app.
        </p>
      </div>

      <LegalSection title="What is banned">
        <ul>
          <li>Child sexual abuse material (CSAM) of any kind, including drawn, edited or AI-generated images</li>
          <li>Sexualising a child, or sexual conversation with anyone under 18</li>
          <li>Grooming: building trust with a child, or their family, in order to abuse or exploit them</li>
          <li>Sextortion, or threatening to share intimate images of a child</li>
          <li>Trafficking, or offering or seeking access to a child for any sexual purpose</li>
          <li>Using a &ldquo;help&rdquo; request as cover to contact, meet or move a child</li>
        </ul>
        <p>
          Breaking these rules means a permanent ban, removal of the content, and a report to the authorities.
        </p>
      </LegalSection>

      <LegalSection title="How to report it">
        <ul>
          <li>
            In HealAll, open the post and use <strong>Report</strong>. Choose the reason that fits best and say a child
            is involved. Reports go to our moderators, not to the person you report.
          </li>
          <li>
            For a comment, message or profile, or if you can&apos;t use Report, email{" "}
            <a href="mailto:hello@healallindia.com?subject=Child%20safety%20report">hello@healallindia.com</a> with the
            subject &ldquo;Child safety report&rdquo; and say where you saw it.
          </li>
          <li>
            If a child is in immediate danger, call <a href="tel:112">112</a>. You can also call Childline on{" "}
            <a href="tel:1098">1098</a>, or report online abuse to the National Cyber Crime Reporting Portal.
          </li>
        </ul>
        <p>Never download, forward or screenshot abuse material to &ldquo;prove&rdquo; it. Just report it.</p>
      </LegalSection>

      <LegalSection title="What we do">
        <ul>
          <li>Moderators review child safety reports as a priority.</li>
          <li>We remove the content, ban the account and preserve the evidence securely for the police.</li>
          <li>
            We report child sexual abuse material and exploitation to the police and the National Cyber Crime
            Reporting Portal, as Indian law, including the POCSO Act, requires.
          </li>
          <li>We cooperate with law enforcement requests made through valid legal process.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Child safety contact">
        <p>
          Our child safety point of contact answers at{" "}
          <a href="mailto:hello@healallindia.com?subject=Child%20safety">hello@healallindia.com</a>. Authorities and
          app stores can use the same address.
        </p>
      </LegalSection>

      <p>
        See also the <Link href="/terms">Terms of Service</Link>, the{" "}
        <Link href="/#community-guidelines">Community Guidelines</Link> and the{" "}
        <Link href="/privacy-policy">Privacy Policy</Link>.
      </p>
    </main>
  );
}
