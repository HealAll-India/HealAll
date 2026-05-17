import Link from "next/link";
import s from "./page.module.css";
import { AuthRedirect } from "@/components/auth/auth-redirect";

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
      <section id="community-guidelines" className={s.guidelines}>
        <div className={s.guidelinesCard}>

          {/* Header */}
          <div className={s.guidelinesHeader}>
            <div className={s.guidelinesHeaderLeft}>
              <div className={s.docIcon}>📜</div>
              <div className={s.guidelinesHeaderText}>
                <span className={s.importantBadge}>Read before joining</span>
                <h2 className={s.guidelinesTitle}>Community Guidelines</h2>
                <p className={s.guidelinesSubtitle}>
                  The principles that keep HealAll safe, honest, and human.
                </p>
              </div>
            </div>
            <a
              href="https://drive.google.com/file/d/16umjQCumoecqR0Y2AoNi8zY-IUKHKvws/view"
              target="_blank"
              rel="noopener noreferrer"
              className={s.openBtn}
            >
              Open PDF ↗
            </a>
          </div>

          {/* PDF embed */}
          <div className={s.pdfWrapper}>
            <iframe
              src="https://drive.google.com/file/d/16umjQCumoecqR0Y2AoNi8zY-IUKHKvws/preview"
              allow="autoplay"
              title="HealAll Community Guidelines"
            />
          </div>

          {/* Footer */}
          <div className={s.guidelinesFooter}>
            <span className={s.footerNote}>
              📌 These guidelines apply to all members
            </span>
            <a
              href="https://drive.google.com/file/d/16umjQCumoecqR0Y2AoNi8zY-IUKHKvws/view"
              target="_blank"
              rel="noopener noreferrer"
              className={s.footerLink}
            >
              Download ↓
            </a>
          </div>

        </div>
      </section>

      {/* ── Developer Contribution ── */}
      <section className={s.contribute}>
        <div className={s.contributeCard}>

          {/* Header */}
          <div className={s.contributeHeader}>
            <div className={s.contributeHeaderLeft}>
              <div className={s.contributeIcon}>🛠️</div>
              <div className={s.contributeHeaderText}>
                <span className={s.contributeLabel}>Open Source</span>
                <h2 className={s.contributeTitle}>Contribute as a Developer</h2>
              </div>
            </div>
            <a
              href="https://github.com/anupam8nith/HealAll"
              target="_blank"
              rel="noopener noreferrer"
              className={s.githubBtn}
            >
              View on GitHub ↗
            </a>
          </div>

          {/* Two-panel body */}
          <div className={s.contributeBody}>

            {/* Left: Tech stack */}
            <div className={s.techStack}>
              <p className={s.panelLabel}>🔧 Tech stack</p>
              {[
                { emoji: "⚡", name: "FastAPI + SQLAlchemy", sub: "Python 3.12, async" },
                { emoji: "⚛️", name: "Next.js 15", sub: "TypeScript, App Router" },
                { emoji: "🐘", name: "PostgreSQL + Redis", sub: "Neon, Upstash" },
                { emoji: "🚀", name: "Railway + Vercel", sub: "Backend + Frontend deploy" },
              ].map((item) => (
                <div key={item.name} className={s.stackItem}>
                  <span className={s.stackEmoji}>{item.emoji}</span>
                  <div>
                    <div className={s.stackName}>{item.name}</div>
                    <div className={s.stackSub}>{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Contribution areas */}
            <div className={s.contributionAreas}>
              <p className={s.panelLabel}>🌱 Contribution areas</p>
              {(
                [
                  { emoji: "🎨", label: "Frontend UI & UX",   color: s.green  },
                  { emoji: "⚙️", label: "API features",        color: s.blue   },
                  { emoji: "🧪", label: "Tests & coverage",    color: s.purple },
                  { emoji: "📝", label: "Docs & translations", color: s.orange },
                ] as const
              ).map((area) => (
                <div key={area.label} className={`${s.areaItem} ${area.color}`}>
                  <span>{area.emoji}</span>
                  <span>{area.label}</span>
                </div>
              ))}
            </div>

          </div>

          {/* Footer */}
          <div className={s.contributeFooter}>
            <span className={s.footerHint}>⭐ Fork · open an issue · ship a PR</span>
            <a
              href="https://github.com/anupam8nith/HealAll/blob/main/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className={s.contributeFooterLink}
            >
              Read README.md →
            </a>
          </div>

        </div>
      </section>
    </>
  );
}
