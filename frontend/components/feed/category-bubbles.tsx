"use client";

interface Bubble {
  value:  string;
  emoji:  string;
  label:  string;
  color:  string;
  bg:     string;
  border: string;
}

const BUBBLES: Bubble[] = [
  { value: "",                  emoji: "💚", label: "All",        color: "transparent", bg: "linear-gradient(135deg,#16a34a,#2563eb)", border: "transparent" },
  { value: "urgent",            emoji: "🆘", label: "Urgent",     color: "#e11d48",     bg: "#fff1f2",                                 border: "#e11d48"     },
  { value: "emotional_support", emoji: "🤗", label: "Support",    color: "#f59e0b",     bg: "#fef3c7",                                 border: "#f59e0b"     },
  { value: "mentorship",        emoji: "🎓", label: "Mentorship", color: "#2563eb",     bg: "#eff6ff",                                 border: "#2563eb"     },
  { value: "skill_sharing",     emoji: "🔧", label: "Skills",     color: "#16a34a",     bg: "#f0fdf4",                                 border: "#16a34a"     },
  { value: "navigation",        emoji: "🧭", label: "Navigate",   color: "#7c3aed",     bg: "#faf5ff",                                 border: "#7c3aed"     },
  { value: "on_ground",         emoji: "🤝", label: "On Ground",  color: "#d97706",     bg: "#fffbeb",                                 border: "#d97706"     },
];

interface Props {
  active:   string;
  onChange: (category: string) => void;
}

export function CategoryBubbles({ active, onChange }: Props) {
  return (
    <div style={{
      display: "flex", gap: "14px", overflowX: "auto", padding: "16px",
      background: "#fff", borderRadius: "20px",
      boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: "20px",
      scrollbarWidth: "none",
    }}>
      {BUBBLES.map(b => {
        const isActive = b.value === active;
        const isAll    = b.value === "";
        return (
          <button
            key={b.value || "all"}
            type="button"
            onClick={() => onChange(b.value)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "5px", background: "transparent", border: "none",
              cursor: "pointer", flexShrink: 0, padding: 0,
            }}
          >
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: b.bg,
              border: `${isActive ? "3px" : "2px"} solid ${isActive ? b.border : "transparent"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: isAll ? "20px" : "24px",
              transform: isActive ? "scale(1.08)" : "scale(1)",
              transition: "transform 0.12s",
              boxShadow: isActive ? `0 0 0 3px ${isAll ? "rgba(22,163,74,0.2)" : b.border + "33"}` : "none",
            }}>
              {b.emoji}
            </div>
            <span style={{
              fontSize: "10px", fontWeight: 700,
              color: isAll ? (isActive ? "#16a34a" : "#6b7280") : b.color,
            }}>
              {b.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
