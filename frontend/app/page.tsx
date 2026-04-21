import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "calc(100vh - 60px)", padding: "2rem 1rem",
    }}>
      <div style={{ width: "100%", maxWidth: "480px", textAlign: "center" }}>

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
        <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap", marginTop: "40px" }}>
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
    </main>
  );
}
