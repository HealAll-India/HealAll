# HealAll Architecture README (v1, non-technical)

This document explains how the HealAll platform is intended to work end-to-end, with clear flows and responsibilities. It avoids deep technical details, but it is detailed enough for operations, moderation, and product planning.

## 1) Phase-1 scope (what we are building first)
HealAll Phase 1 is:
- India-first
- Web-only (fast MVP)
- Invite-only / waitlist at the start
- Feed-based discovery (“Instagram-like”), with a case lifecycle behind every post
- No anonymous help requests (identity verification is required)
- Helpers must be 18+; help-seekers can be any legal age (extra safeguards for minors)
- Money is not handled by HealAll; any voluntary financial support happens outside HealAll with strict disclaimers and anti-solicitation enforcement

## 2) The main idea in one line
HealAll connects people who genuinely need help with volunteers willing to offer time, skills, guidance, and presence—through verified requests, safe communication, and case closure accountability.

## 3) Roles and permissions (who can do what)
### A) Community roles (users)
- **Help-seeker:** Creates help requests for themselves.
- **Helper:** Offers help on verified requests.
- **Both:** A user can be both.

### B) Operational roles (trusted roles)
- **Founder / Head Admin:** final authority on policy, escalations, bans, and legal actions.
- **Admin / Moderator:** enforces guidelines, handles reports, manages moderation queue.
- **Case Verifier:** verifies help requests, adds remarks/evidence, controls “Verified” status.
- **Case Owner (Volunteer Lead):** coordinates one case when multiple helpers are involved, maintains case notes, drives closure.

## 4) Core building blocks (platform features)
### Profiles
Profiles are identity-first (no pseudonymous posting for requests). Each profile includes:
- name, age range, city (city-level location only),
- skills and “ways I can help,” availability,
- verification status and badges (identity verification + contribution recognition),
- privacy controls for contact visibility (restricted by default).

### Posts (Help Requests)
A help request is a post with:
- category (emotional support, mentorship, guidance, services navigation, urgent support, etc.),
- urgency level,
- city,
- description and optional media/documents (handled carefully),
- status (draft / submitted / needs info / verified / rejected / active / resolved).

### Case Management
Every verified post becomes a “case” behind the scenes:
- assigned case owner (when needed),
- case notes (private to the case team + admins),
- progress updates,
- evidence / remarks by verifier,
- closure and post-resolution reflection (optional testimonial, anonymized impact story with consent).

### Trust & Safety
- report/flag system,
- moderation queue,
- blocking and DM controls,
- verification workflow and evidence handling,
- clear enforcement actions (warn, restrict, suspend, ban).

### Announcements
Admins can post announcements that are pinned and optionally sent as a digest.

## 5) The core flows (end-to-end)

### Flow 1: Invite-only onboarding and identity verification
1. User receives an invite/waitlist approval.
2. User signs up with phone + email + name + city + age range.
3. User submits Aadhaar for identity verification (minimum collection and retention; store only what is required).
4. User chooses role(s): helper, help-seeker, or both.
5. User accepts Terms, Community Guidelines, and Safety Rules.
6. Platform marks verification level (example):
   - Level 0: Unverified (cannot post requests)
   - Level 1: Phone/email verified
   - Level 2: ID verified (Aadhaar verified)
   - Level 3: Request verified (per case)

Outcome: a verified user can post requests and participate in cases under policy.

### Flow 2: Creating a help request (post → verification)
1. Help-seeker creates a help request post and selects category + urgency + city.
2. Before submission, the platform shows boundary warnings (no illegal activity, no solicitation, no medical/legal claims, etc.).
3. The post enters “Verification Queue.”
4. A Case Verifier reviews the request and can:
   - verify (approve),
   - request more info (needs info),
   - reject (fraud/unsafe/illegal/insufficient info).
5. The verifier adds remarks and evidence notes (without exposing sensitive personal details publicly).
6. Once verified, the post goes live in the feed and becomes an “Active Case.”

Outcome: only verified requests are promoted in the main feed (trust-first design).

### Flow 3: Discovery (feed) and offering help
1. Helpers browse a feed of verified requests (filtered by city, category, urgency).
2. A helper can react/support, comment to clarify, or press “Offer Help.”
3. The platform encourages staged communication:
   - comment first (public clarifications),
   - then consent-based DM,
   - off-platform contact only when necessary and after both parties agree.
4. If multiple helpers join, a Case Owner is assigned.

Outcome: helpers join safely, with clarity and structure.

### Flow 4: Case coordination (case owner + notes + updates)
1. Case Owner coordinates actions and maintains case notes.
2. Helpers log what they did (time/skills/support), without exposing private details.
3. If in-person help is involved, additional safety rules must be acknowledged:
   - meet only in public places,
   - buddy system if possible,
   - no coercion, no home visits by default,
   - for minors: online only or guardian present.
4. Any suspicious behavior can be reported immediately.

Outcome: the case stays organized and safer, even if multiple volunteers participate.

### Flow 5: Case closure and evidence
1. Closure can be initiated by:
   - Case Verifier, or
   - Case Owner / help-seeker requesting closure, followed by verifier confirmation.
2. The verifier confirms resolution and logs closure remarks.
3. Evidence of help provided may be attached/recorded (as a proof label or document) but sensitive info is minimized.
4. The platform awards recognition (badges/impact stats) based on verified contributions.
5. With consent, the story can be shared as an anonymized impact highlight.

Outcome: closure creates accountability, reduces burnout, and builds trust.

## 6) Money policy flow (platform-strict, individuals-permissive)
- HealAll never collects, holds, or processes money.
- The platform does not provide a “donate” button or any fundraising tools.
- If a helper wants to provide voluntary financial support, it happens outside HealAll and is never solicited or expected.
- Any post/comment/DM that pressures for money is disallowed and can be reported.
- Proof of help can be recorded for verification and trust, but the platform should avoid recording exact payment amounts publicly.

## 7) Safety and crisis protocol (high-level)
HealAll must have a documented protocol for:
- self-harm or suicide-related content (immediate crisis resources + admin escalation),
- domestic violence / coercion (safety-first response + resources + escalation),
- medical emergencies (redirect to emergency services; HealAll Heroes is not a replacement),
- minors (guardian safeguards; restricted interactions),
- doxxing, harassment, stalking (rapid moderation + bans + reporting to authorities if needed).

Important: The platform should not promise 24/7 response. It should clearly communicate moderation expectations and escalation paths.

## 8) What is “HealAll Heroes”
HealAll Heroes is a community-backed urgent-support lane for time-sensitive cases (logistics, immediate guidance, reaching emergency services, coordinating safe local support). It must:
- include strong safety disclaimers,
- redirect to local emergency services when needed,
- prevent risky “vigilante” behavior,
- follow stricter verification and moderation.

## 9) MVP feature checklist (Phase 1)
Minimum set:
- invite-only onboarding + phone/email + Aadhaar verification status
- profile + skills/availability + city
- create help request post + categories + urgency
- verification queue + verifier remarks/evidence
- feed of verified requests + search/filter
- offer help + comments + consent-based DM
- case dashboard + case owner + case notes
- case closure workflow + contribution recognition
- reporting + basic moderation actions
- announcements section

## 10) What comes later (Phase 2+)
Examples:
- multi-language support
- resource library (guides/templates)
- workshop/events module
- richer matching recommendations
- mobile app or PWA improvements
- deeper analytics and public impact reports (anonymized)

## 11) Operating principles to keep the platform healthy
- verify just enough, store as little as possible, retain data for limited time
- protect users from solicitation, coercion, and pressure
- reduce volunteer burnout through case closure, boundaries, and gratitude loops
- keep the platform humble, youth-driven, community-first, and mental-health-safe

---

This README is meant to align product, operations, and community expectations. If policies change (money, anonymity, age rules, verification), update this README before the platform is built or shared widely.
