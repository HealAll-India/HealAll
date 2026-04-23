import Link from "next/link";
import s from "./page.module.css";

export default function HomePage() {
  return (
    <>
      {/* ── Hero ── */}
      <div className={s.hero}>
        <div className={s.heroInner}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "32px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="HealAll" width={56} height={56} style={{ borderRadius: "14px" }} />
            <span className="logo-text" style={{ fontSize: "32px" }}>HealAll</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#111827", margin: "0 0 12px", lineHeight: 1.3 }}>
            Help and be helped<br />by your community
          </h1>
          <p style={{ fontSize: "15px", color: "#6b7280", margin: "0 0 32px", lineHeight: 1.6 }}>
            India&apos;s invite-only mutual-aid platform. Blood, medicine, shelter, food,
            mentorship — real people helping real people.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginBottom: "24px" }}>
            <Link href="/signup">
              <button style={{ fontSize: "15px", padding: "11px 28px" }}>Join HealAll</button>
            </Link>
            <Link href="/login">
              <button className="ghost" style={{ fontSize: "15px", padding: "11px 28px" }}>Sign in</button>
            </Link>
          </div>

          {/* Invite note */}
          <p style={{ fontSize: "12px", color: "#9ca3af" }}>
            🔒 Invite-only community · Need a code? Ask an existing member.
          </p>

          {/* Category pills */}
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap", marginTop: "40px", paddingBottom: "8px" }}>
            {[
              { emoji: "🆘", label: "Urgent",     color: "#e11d48", bg: "#fff1f2" },
              { emoji: "🤗", label: "Support",    color: "#f59e0b", bg: "#fef3c7" },
              { emoji: "🎓", label: "Mentorship", color: "#2563eb", bg: "#eff6ff" },
              { emoji: "🔧", label: "Skills",     color: "#16a34a", bg: "#f0fdf4" },
              { emoji: "🧭", label: "Navigate",   color: "#7c3aed", bg: "#faf5ff" },
              { emoji: "🤝", label: "On Ground",  color: "#d97706", bg: "#fffbeb" },
            ].map(c => (
              <span key={c.label} style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                background: c.bg, color: c.color,
                fontSize: "12px", fontWeight: 700,
                padding: "5px 12px", borderRadius: "9999px",
              }}>
                {c.emoji} {c.label}
              </span>
            ))}
          </div>

        </div>
      </div>

      {/* ── Community Guidelines ── */}
      <section className={s.guidelines}>
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
