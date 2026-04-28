import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — HealAll",
  description: "How HealAll collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: "720px", margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>
      <div style={{ marginBottom: "2.5rem" }}>
        <p style={{ fontSize: "13px", color: "#9ca3af", margin: "0 0 8px" }}>Last updated: April 26, 2026</p>
        <h1 style={{ fontSize: "32px", fontWeight: 800, color: "#111827", margin: "0 0 12px" }}>Privacy Policy</h1>
        <p style={{ fontSize: "16px", color: "#6b7280", lineHeight: 1.7, margin: 0 }}>
          HealAll (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is committed to protecting your privacy.
          This policy explains what data we collect, why we collect it, and how we protect it.
        </p>
      </div>

      <Section title="1. Who We Are">
        <p>
          HealAll is an invite-only mutual-aid platform connecting people across India who need help with
          people who can offer it. We operate at{" "}
          <a href="https://healallindia.com" style={{ color: "#16a34a" }}>healallindia.com</a>.
        </p>
        <p>Contact: <a href="mailto:hello@healallindia.com" style={{ color: "#16a34a" }}>hello@healallindia.com</a></p>
      </Section>

      <Section title="2. Information We Collect">
        <h3>Information you provide directly</h3>
        <ul>
          <li><strong>Account details:</strong> Full name, phone number, email address, city, age range</li>
          <li><strong>Roles:</strong> Whether you are seeking help, offering help, or both</li>
          <li><strong>Invite code:</strong> Used to verify you were invited to join</li>
          <li><strong>Profile information:</strong> Bio, skills, avatar image (optional)</li>
          <li><strong>Posts &amp; messages:</strong> Help requests, comments, and direct messages you create</li>
        </ul>

        <h3>Information from Google (if you sign in with Google)</h3>
        <ul>
          <li>Your Google account email address</li>
          <li>Your display name</li>
          <li>A unique Google identifier (used only to link your Google account to your HealAll account)</li>
        </ul>
        <p>We do not receive your Google password or access your Google Drive, Gmail, or other Google services.</p>

        <h3>Automatically collected information</h3>
        <ul>
          <li>IP address and browser/device type (for security and rate limiting)</li>
          <li>Pages visited and actions taken within the platform (for service improvement)</li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Information">
        <ul>
          <li><strong>Account creation and authentication</strong> — verify identity via OTP or Google OAuth</li>
          <li><strong>Platform functionality</strong> — match help seekers with helpers, display your profile and posts</li>
          <li><strong>Communications</strong> — send OTP codes, welcome emails, and important service updates</li>
          <li><strong>Safety and moderation</strong> — detect fraud, prevent abuse, enforce community guidelines</li>
          <li><strong>Legal compliance</strong> — comply with applicable Indian law</li>
        </ul>
        <p>We do <strong>not</strong> sell your personal data. We do <strong>not</strong> use your data for advertising.</p>
      </Section>

      <Section title="4. Data Sharing">
        <p>We share data only with:</p>
        <ul>
          <li>
            <strong>Other users</strong> — your name, city, roles, and posts are visible to other HealAll members.
            Email and phone are hidden by default; you can choose to share them in privacy settings.
          </li>
          <li>
            <strong>Service providers</strong> — we use third-party services to operate the platform:
            <ul style={{ marginTop: "8px" }}>
              <li>Neon (PostgreSQL database hosting)</li>
              <li>Upstash (Redis caching)</li>
              <li>Resend (transactional email delivery)</li>
              <li>Google (OAuth authentication)</li>
              <li>Vercel (frontend hosting)</li>
              <li>Railway (backend hosting)</li>
            </ul>
            All providers are contractually bound to protect your data.
          </li>
          <li>
            <strong>Law enforcement</strong> — only when required by valid legal process under Indian law.
          </li>
        </ul>
      </Section>

      <Section title="5. Data Storage and Security">
        <ul>
          <li>Data is stored on servers located in cloud infrastructure with encryption at rest and in transit (TLS)</li>
          <li>Passwords are never stored — we use OTP-based authentication</li>
          <li>Access tokens use short-lived JWTs (15 minutes); refresh tokens are stored as hashed values</li>
          <li>We implement rate limiting and abuse detection to protect accounts</li>
        </ul>
      </Section>

      <Section title="6. Data Retention">
        <ul>
          <li>Account data is retained while your account is active</li>
          <li>OTP codes expire within 10 minutes and are deleted after use</li>
          <li>If you request account deletion, we delete your personal data within 30 days, except where retention is required by law</li>
        </ul>
      </Section>

      <Section title="7. Your Rights">
        <p>You have the right to:</p>
        <ul>
          <li><strong>Access</strong> — request a copy of data we hold about you</li>
          <li><strong>Correction</strong> — update incorrect information via your profile settings</li>
          <li><strong>Deletion</strong> — request account and data deletion by emailing us</li>
          <li><strong>Portability</strong> — request your data in a machine-readable format</li>
          <li><strong>Withdraw consent</strong> — stop using the platform at any time</li>
        </ul>
        <p>
          To exercise these rights, email{" "}
          <a href="mailto:hello@healallindia.com" style={{ color: "#16a34a" }}>hello@healallindia.com</a>.
        </p>
      </Section>

      <Section title="8. Children">
        <p>
          HealAll is available to users aged 13 and above. Users aged 13–17 must have parental consent.
          We do not knowingly collect data from children under 13. If you believe a child under 13
          has created an account, please contact us immediately.
        </p>
      </Section>

      <Section title="9. Cookies">
        <p>
          We use only a single essential cookie: <code>healall_refresh</code>, an httpOnly cookie that stores
          your refresh token for session management. We do not use tracking or advertising cookies.
        </p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>
          We may update this policy. We will notify users via email for material changes.
          Continued use of HealAll after changes constitutes acceptance of the updated policy.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          Questions or concerns about this policy:{" "}
          <a href="mailto:hello@healallindia.com" style={{ color: "#16a34a" }}>hello@healallindia.com</a>
        </p>
        <p>We aim to respond within 7 business days.</p>
      </Section>

      <div style={{ marginTop: "3rem", padding: "20px 24px", background: "#f9fafb", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
          Also see:{" "}
          <Link href="/terms" style={{ color: "#16a34a", fontWeight: 600 }}>Terms of Service</Link>
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
