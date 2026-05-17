import Link from "next/link";
import { AuthRedirect } from "@/components/auth/auth-redirect";

const COMMUNITY_GUIDELINES_PDF_ID = "16umjQCumoecqR0Y2AoNi8zY-IUKHKvws";
const GUIDELINES_PDF_VIEW = `https://drive.google.com/file/d/${COMMUNITY_GUIDELINES_PDF_ID}/view`;
const GUIDELINES_PDF_PREVIEW = `https://drive.google.com/file/d/${COMMUNITY_GUIDELINES_PDF_ID}/preview`;
const GUIDELINES_PDF_DOWNLOAD = `https://drive.google.com/uc?export=download&id=${COMMUNITY_GUIDELINES_PDF_ID}`;

const CATEGORIES = [
  { emoji: "🆘", label: "Urgent",     color: "#e11d48", bg: "#fff1f2" },
  { emoji: "🤗", label: "Support",    color: "#f59e0b", bg: "#fef3c7" },
  { emoji: "🎓", label: "Mentorship", color: "#2563eb", bg: "#eff6ff" },
  { emoji: "🔧", label: "Skills",     color: "#16a34a", bg: "#f0fdf4" },
  { emoji: "🧭", label: "Navigate",   color: "#7c3aed", bg: "#faf5ff" },
  { emoji: "🤝", label: "On Ground",  color: "#d97706", bg: "#fffbeb" },
];

const MOCK_POSTS = [
  { initials: "RK", name: "Riya K.", city: "Delhi", title: "Need O+ blood by 6 PM today", category: "🆘 Urgent", helpers: 8 },
  { initials: "AS", name: "Arjun S.", city: "Mumbai", title: "Seeking insulin — out of stock near me", category: "💊 Medicine", helpers: 5 },
  { initials: "PM", name: "Priya M.", city: "Bangalore", title: "Family needs emergency shelter", category: "🏠 Shelter", helpers: 12 },
];

export default function HomePage() {
  return (
    <>
      <AuthRedirect />

      {/* ── Editorial Hero ── */}
      <section className="land">
        <div className="land__bg" />
        <div className="land__grid">
          {/* Left: headline + CTAs */}
          <div>
            <span className="land__eyebrow">🔒 Invite-only · India</span>
            <h1 className="land__h1">
              Real neighbours.<br />
              <span className="grad">Real help.</span><br />
              Right when you need it.
            </h1>
            <p className="land__lede">
              HealAll is India&apos;s invite-only mutual-aid platform. Blood, medicine, shelter, food, fees, mentorship — verified members showing up for each other.
            </p>
            <div className="land__ctas">
              <Link href="/signup">
                <button className="btn-lg">Join HealAll →</button>
              </Link>
              <Link href="/login">
                <button className="ghost btn-lg">I have an invite</button>
              </Link>
            </div>
            <div className="land__lock">🔒 Invite-only · need a code? Ask an existing member.</div>

            <div className="land__nums">
              <div className="land__num-card">
                <div className="land__num-val">47</div>
                <div className="land__num-label">Helped today</div>
              </div>
              <div className="land__num-card">
                <div className="land__num-val">184</div>
                <div className="land__num-label">Helpers online</div>
              </div>
              <div className="land__num-card">
                <div className="land__num-val">19</div>
                <div className="land__num-label">Indian cities</div>
              </div>
            </div>

            <div className="land__pillrow">
              {CATEGORIES.map(c => (
                <span key={c.label} style={{
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  background: "#fff", color: c.color,
                  fontSize: "11px", fontWeight: 700,
                  padding: "5px 11px", borderRadius: "9999px",
                  boxShadow: "inset 0 0 0 1px var(--border-strong)",
                }}>
                  {c.emoji} {c.label}
                </span>
              ))}
            </div>
          </div>

          {/* Right: live feed preview card */}
          <div className="land__device">
            <div className="land__feed">
              <div className="land__feed-head">
                <div className="logo-mark" style={{ width: 28, height: 28, borderRadius: 8 }} aria-hidden="true" />
                <span className="land__feed-title">Feed · live</span>
                <span className="land__feed-sub">
                  <span className="impact-strip__dot" style={{ display: "inline-block", marginRight: 6, verticalAlign: "middle" }} />
                  184 online
                </span>
              </div>
              <div className="miniposts">
                {MOCK_POSTS.map((p) => (
                  <div key={p.title} className="minipost">
                    <span className="av av-sm" style={{ background: "linear-gradient(135deg,#16a34a,#2563eb)" }}>{p.initials}</span>
                    <div>
                      <div className="minipost__who">{p.name} · {p.city}</div>
                      <div className="minipost__title">{p.title}</div>
                      <div className="minipost__meta">{p.category} · {p.helpers} helping</div>
                    </div>
                    <span className="minipost__cta">♥ Help</span>
                  </div>
                ))}
              </div>
              <div style={{
                padding: "10px 12px",
                background: "var(--gradient-brand-soft)",
                borderRadius: 12,
                boxShadow: "inset 0 0 0 1px #bbf7d0",
                fontSize: "11.5px", color: "#15803d", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span className="impact-strip__dot" /> 47 helped today · 184 helpers online · 19 cities active
              </div>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="land__how">
          {[
            { step: "Step 1", big: "🔐", title: "Join by invite", text: "Trust is the product. Every member is vouched in by another. Your real name, your real city." },
            { step: "Step 2", big: "🆘", title: "Ask for what you need", text: "Be specific. Blood by 6 PM. Insulin by Tuesday. Shelter for a week. Verified members nearby see it instantly." },
            { step: "Step 3", big: "🤝", title: "Help shows up", text: "Real people offering real help. DM, coordinate, get it done. Then pay it forward when it's your turn." },
          ].map(h => (
            <div key={h.title} className="howcard">
              <div className="howcard__step">{h.step}</div>
              <div className="howcard__big">{h.big}</div>
              <h3 className="howcard__title">{h.title}</h3>
              <p className="howcard__text">{h.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Community Guidelines ── */}
      <section id="community-guidelines" className="hsec">
        <div className="hsec__card">

          <div className="hsec__head">
            <div className="hsec__head-left">
              <div className="hsec__icon">📜</div>
              <div>
                <span className="hsec__pill">Read before joining</span>
                <h2 className="hsec__title">Community Guidelines</h2>
                <p className="hsec__sub">
                  Four principles up top — and the full PDF embedded below for anyone who wants every word.
                </p>
              </div>
            </div>
            <a
              href={GUIDELINES_PDF_VIEW}
              target="_blank"
              rel="noopener noreferrer"
              className="hsec__cta"
            >
              Open PDF ↗
            </a>
          </div>

          {/* 4-card horizontal scroll preview */}
          <div className="pdf-scroll" role="region" aria-label="Guidelines preview cards">
            <div className="pdf-scroll__rail">
              {[
                { n: "01 · Identity", title: "Be a verified neighbour", intro: "Every member is vouched in by another. Show your real name, your real city.", bullets: ["One account per person — no anonymous handles.", "Verified members get the ✓ pill. L2 / L3 unlock more.", "Vouch responsibly — your name backs theirs."] },
                { n: "02 · Honesty",  title: "Help honestly",           intro: "Offering help is a commitment. Don't ghost. Don't promise what you can't deliver.", bullets: ["Reply to DMs within 24 hours or remove your offer.", "No money requests until trust is built.", "Report any pressure tactics — we act fast."] },
                { n: "03 · Safety",   title: "Money & meetings",        intro: "HealAll never asks for payment on your behalf. Verify before sending money.", bullets: ["Meet first responders in public, daylight if possible.", "Keep receipts and screenshots of every transfer.", "Flag off-platform payment pressure immediately."] },
                { n: "04 · Conduct",  title: "Keep it human",           intro: "We're a neighbourhood, not a startup. Speak how you would in a WhatsApp group.", bullets: ["No solicitation, no proselytising, no political campaigns.", "No mass DMs — quality over volume.", "Disagree without being a jerk. Block, don't escalate."] },
              ].map((p) => {
                const descId = `pdf-page-desc-${p.n.split(" ")[0]}`;
                return (
                  <div
                    key={p.n}
                    className="pdf-page"
                    role="group"
                    tabIndex={0}
                    aria-label={`Preview: ${p.title}`}
                    aria-describedby={descId}
                  >
                    <span id={descId} className="sr-only">
                      Preview of guideline {p.n}: {p.title}. Scroll down to the embedded viewer to read the full PDF.
                    </span>
                    <div className="pdf-page__bar" />
                    <div className="pdf-page__num">{p.n}</div>
                    <h3>{p.title}</h3>
                    <p>{p.intro}</p>
                    <ul>{p.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full PDF viewer */}
          <div className="pdf-viewer">
            <div className="pdf-viewer__bar">
              <span className="pdf-viewer__title">HealAll · Community Guidelines v1.0</span>
              <span className="pdf-viewer__page-indicator">Embedded PDF · scroll to read</span>
              <span className="pdf-viewer__controls">
                <a className="pdf-viewer__btn" href={GUIDELINES_PDF_VIEW} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab">↗</a>
                <a className="pdf-viewer__btn" href={GUIDELINES_PDF_DOWNLOAD} target="_blank" rel="noopener noreferrer" aria-label="Download PDF">↓</a>
              </span>
            </div>
            <iframe
              className="pdf-viewer__frame"
              src={GUIDELINES_PDF_PREVIEW}
              title="HealAll Community Guidelines"
              loading="lazy"
            />
          </div>

          <div className="hsec__foot">
            <span className="hsec__note">📌 These guidelines apply to all members · HealAll v1.0</span>
            <a
              href={GUIDELINES_PDF_DOWNLOAD}
              target="_blank"
              rel="noopener noreferrer"
              className="hsec__foot-link"
            >
              Download ↓
            </a>
          </div>

        </div>
      </section>

      {/* ── Developer Contribution ── */}
      <section className="hsec">
        <div className="hsec__card">

          <div className="hsec__head">
            <div className="hsec__head-left">
              <div className="hsec__icon hsec__icon--dark">🛠️</div>
              <div>
                <span className="hsec__pill hsec__pill--dark">Open source</span>
                <h2 className="hsec__title">Contribute as a Developer</h2>
                <p className="hsec__sub">
                  HealAll is built in the open by neighbours, for neighbours. Fork it, open an issue, or ship a PR.
                </p>
              </div>
            </div>
            <a
              href="https://github.com/anupam8nith/HealAll"
              target="_blank"
              rel="noopener noreferrer"
              className="hsec__cta hsec__cta--dark"
            >
              View on GitHub ↗
            </a>
          </div>

          <div className="hsec__body">
            <div className="contrib-col">
              <p className="contrib-col__label">🔧 Tech stack</p>
              {[
                { ico: "⚡",  name: "FastAPI + SQLAlchemy", sub: "Python 3.12, async" },
                { ico: "⚛️", name: "Next.js 16 + React 19", sub: "TypeScript, App Router" },
                { ico: "🐘", name: "PostgreSQL + Redis",    sub: "Neon, Upstash" },
                { ico: "🚀", name: "Railway + Vercel",      sub: "Backend + Frontend deploy" },
              ].map((item) => (
                <div key={item.name} className="stack-item">
                  <span className="stack-item__ico">{item.ico}</span>
                  <div>
                    <div className="stack-item__name">{item.name}</div>
                    <div className="stack-item__sub">{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="contrib-col">
              <p className="contrib-col__label">🌱 Contribution areas</p>
              {[
                { ico: "🎨", label: "Frontend UI & UX",   tone: "green"  },
                { ico: "⚙️", label: "API features",        tone: "blue"   },
                { ico: "🧪", label: "Tests & coverage",    tone: "purple" },
                { ico: "📝", label: "Docs & translations", tone: "orange" },
              ].map((area) => (
                <div key={area.label} className={`area-item area-item--${area.tone}`}>
                  <span>{area.ico}</span>
                  <span>{area.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hsec__foot">
            <span className="hsec__note">⭐ Fork · open an issue · ship a PR</span>
            <a
              href="https://github.com/anupam8nith/HealAll/blob/main/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="hsec__foot-link"
            >
              Read README.md →
            </a>
          </div>

        </div>
      </section>
    </>
  );
}
