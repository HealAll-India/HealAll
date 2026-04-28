import Link from "next/link";

export const metadata = {
  title: "Terms of Service — HealAll",
  description: "Terms governing your use of the HealAll mutual-aid platform.",
};

export default function TermsPage() {
  return (
    <main style={{ maxWidth: "720px", margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>
      <div style={{ marginBottom: "2.5rem" }}>
        <p style={{ fontSize: "13px", color: "#9ca3af", margin: "0 0 8px" }}>Last updated: April 26, 2026</p>
        <h1 style={{ fontSize: "32px", fontWeight: 800, color: "#111827", margin: "0 0 12px" }}>Terms of Service</h1>
        <p style={{ fontSize: "16px", color: "#6b7280", lineHeight: 1.7, margin: 0 }}>
          By creating an account or using HealAll, you agree to these terms.
          Please read them carefully.
        </p>
      </div>

      <Section title="1. About HealAll">
        <p>
          HealAll is an invite-only mutual-aid platform that connects people across India who need
          help with people who can offer it — across categories like emotional support, mentorship,
          skill sharing, navigation, and on-ground assistance.
        </p>
        <p>
          HealAll is operated as a community platform. It is not a professional services provider,
          medical provider, legal service, or financial institution.
        </p>
      </Section>

      <Section title="2. Eligibility">
        <ul>
          <li>You must be at least 13 years old. Users aged 13–17 must have parental consent.</li>
          <li>You must have a valid invite code to create an account.</li>
          <li>You must provide accurate information during registration.</li>
          <li>One account per person. Creating duplicate accounts may result in suspension.</li>
        </ul>
      </Section>

      <Section title="3. Accounts">
        <ul>
          <li>You are responsible for all activity on your account.</li>
          <li>Keep your login credentials secure. Do not share your OTP with anyone.</li>
          <li>Notify us immediately at{" "}
            <a href="mailto:hello@healallindia.com" style={{ color: "#16a34a" }}>hello@healallindia.com</a>{" "}
            if you believe your account has been compromised.
          </li>
          <li>We may suspend or terminate accounts that violate these terms.</li>
        </ul>
      </Section>

      <Section title="4. Community Guidelines">
        <p>HealAll is built on trust. All users must:</p>
        <ul>
          <li><strong>Be honest</strong> — do not fabricate help requests or misrepresent your situation</li>
          <li><strong>Be respectful</strong> — no harassment, hate speech, discrimination, or threats</li>
          <li><strong>No spam</strong> — do not post irrelevant, repetitive, or commercial content</li>
          <li><strong>No fraud</strong> — do not solicit money, request payment, or impersonate others</li>
          <li><strong>No illegal activity</strong> — do not use HealAll to facilitate any illegal act</li>
          <li><strong>Protect privacy</strong> — do not share other users&rsquo; personal information without consent</li>
          <li><strong>Crisis situations</strong> — if you or someone is in immediate danger, contact emergency services (112)</li>
        </ul>
        <p>Violations may result in content removal, account restriction, or permanent ban.</p>
      </Section>

      <Section title="5. Content">
        <p>
          You retain ownership of content you post. By posting, you grant HealAll a non-exclusive,
          royalty-free licence to display your content to other users as necessary to operate the platform.
        </p>
        <p>You must not post content that is:</p>
        <ul>
          <li>False, misleading, or fraudulent</li>
          <li>Hateful, threatening, or abusive</li>
          <li>Sexually explicit or involving minors</li>
          <li>In violation of any applicable Indian law</li>
        </ul>
        <p>
          We reserve the right to remove any content that violates these terms without prior notice.
        </p>
      </Section>

      <Section title="6. Helpers and Help Seekers">
        <p>
          HealAll facilitates connections between users. We do not vet, verify (beyond identity
          verification), guarantee, or endorse any user or the quality of any help offered or received.
        </p>
        <ul>
          <li>All interactions are between users directly. HealAll is not a party to any agreement between users.</li>
          <li>Exercise your own judgment before sharing personal information or meeting in person.</li>
          <li>Report any suspicious behaviour using the in-app report function.</li>
        </ul>
      </Section>

      <Section title="7. Privacy">
        <p>
          Your use of HealAll is governed by our{" "}
          <a href="/privacy-policy" style={{ color: "#16a34a" }}>Privacy Policy</a>,
          which is incorporated into these Terms by reference.
        </p>
      </Section>

      <Section title="8. Prohibited Uses">
        <p>You must not:</p>
        <ul>
          <li>Attempt to hack, scrape, or reverse-engineer any part of the platform</li>
          <li>Use automated tools (bots, scripts) to interact with the platform</li>
          <li>Circumvent rate limits or security measures</li>
          <li>Sell, transfer, or commercialise your invite codes or account</li>
          <li>Use the platform for commercial solicitation or advertising</li>
        </ul>
      </Section>

      <Section title="9. Intellectual Property">
        <p>
          The HealAll name, logo, and platform design are our intellectual property.
          You may not use them without written permission.
        </p>
      </Section>

      <Section title="10. Disclaimers">
        <p>
          HealAll is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied.
          We do not guarantee uninterrupted access, accuracy of user-provided content,
          or any specific outcome from using the platform.
        </p>
        <p>
          HealAll is a community tool, not a substitute for professional medical, legal, financial,
          or emergency services.
        </p>
      </Section>

      <Section title="11. Limitation of Liability">
        <p>
          To the maximum extent permitted by Indian law, HealAll shall not be liable for any
          indirect, incidental, or consequential damages arising from your use of the platform,
          including harm arising from interactions with other users.
        </p>
      </Section>

      <Section title="12. Termination">
        <p>
          You may delete your account at any time by contacting{" "}
          <a href="mailto:hello@healallindia.com" style={{ color: "#16a34a" }}>hello@healallindia.com</a>.
        </p>
        <p>
          We may terminate or suspend your account immediately, without prior notice, for violation
          of these Terms or conduct we determine to be harmful to the community.
        </p>
      </Section>

      <Section title="13. Governing Law">
        <p>
          These Terms are governed by the laws of India. Any disputes shall be subject to the
          exclusive jurisdiction of courts in India.
        </p>
      </Section>

      <Section title="14. Changes to These Terms">
        <p>
          We may update these Terms. We will notify users via email for material changes.
          Continued use after changes constitutes acceptance of the revised Terms.
        </p>
      </Section>

      <Section title="15. Contact">
        <p>
          Questions about these Terms:{" "}
          <a href="mailto:hello@healallindia.com" style={{ color: "#16a34a" }}>hello@healallindia.com</a>
        </p>
      </Section>

      <div style={{ marginTop: "3rem", padding: "20px 24px", background: "#f9fafb", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
          Also see:{" "}
          <Link href="/privacy-policy" style={{ color: "#16a34a", fontWeight: 600 }}>Privacy Policy</Link>
          {" "}&middot;{" "}
          <Link href="/#community-guidelines" style={{ color: "#16a34a", fontWeight: 600 }}>Community Guidelines</Link>
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "2.5rem" }}>
      <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", margin: "0 0 16px", paddingBottom: "10px", borderBottom: "1px solid #e5e7eb" }}>
        {title}
      </h2>
      <div style={{ fontSize: "15px", color: "#374151", lineHeight: 1.75 }}>
        {children}
      </div>
    </section>
  );
}
