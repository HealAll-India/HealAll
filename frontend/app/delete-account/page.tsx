import Link from "next/link";

import { LegalSection } from "@/components/legal/legal-section";

export const metadata = {
  title: "Delete your account · HealAll",
  description: "How to delete your HealAll account and data, in the app or by email.",
};

/**
 * Public page for account deletion requests. Google Play requires one that
 * works without the app, for people who have already uninstalled it.
 */
export default function DeleteAccountPage() {
  return (
    <main className="legal">
      <div className="legal__header">
        <p className="legal__updated">Last updated: November 26, 2026</p>
        <h1 className="legal__title">Delete your HealAll account</h1>
        <p className="legal__lead">
          You can delete your HealAll account and the data tied to it at any time, from the app or the website,
          or by email if you no longer have the app.
        </p>
      </div>

      <LegalSection title="Delete it yourself">
        <ol>
          <li>Sign in to HealAll in the app or at healallindia.com.</li>
          <li>
            Open <Link href="/profile">your profile</Link> and scroll to <strong>Delete account</strong>.
          </li>
          <li>
            Tap <strong>Delete my account</strong>, type DELETE, and confirm.
          </li>
        </ol>
        <p>Your account is deleted straight away and you are signed out on every device.</p>
      </LegalSection>

      <LegalSection title="Ask us by email">
        <p>
          Can&apos;t sign in, or already uninstalled the app? Email{" "}
          <a href="mailto:hello@healallindia.com?subject=Delete%20my%20HealAll%20account">hello@healallindia.com</a>{" "}
          from the email address on your account, with the subject &ldquo;Delete my HealAll account&rdquo;. We
          confirm it is you and delete the account within 30 days, usually much sooner.
        </p>
      </LegalSection>

      <LegalSection title="What gets deleted">
        <ul>
          <li>Your profile: name, email, phone number, city, age range, bio, skills and privacy settings</li>
          <li>Your posts, comments and the messages you sent or received</li>
          <li>Your sign-in sessions, one-time codes, blocks, votes and reports</li>
          <li>Your profile photo and the photos on your posts, within 30 days</li>
        </ul>
      </LegalSection>

      <LegalSection title="What we keep, and for how long">
        <ul>
          <li>Encrypted database backups that contain your data expire within 30 days.</li>
          <li>
            Help cases on your own requests are deleted with them. On other members&apos; cases, your helper role and
            your notes are removed and the case stays for the people still on it.
          </li>
          <li>
            Anything Indian law requires us to keep, for example in response to a valid legal request, is kept only
            for as long as the law requires.
          </li>
        </ul>
        <p>
          Moderators and admins need a head admin to remove their staff role before they can delete their account,
          so the record of moderation decisions stays intact.
        </p>
      </LegalSection>

      <p>
        See also the <Link href="/privacy-policy">Privacy Policy</Link>.
      </p>
    </main>
  );
}
