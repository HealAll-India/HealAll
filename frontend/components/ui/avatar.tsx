import Image from "next/image";

type AvatarSize = "sm" | "md" | "lg" | "xl";

const PX: Record<AvatarSize, number> = { sm: 30, md: 40, lg: 56, xl: 88 };
const TONES = 6;

/** Up to two initials from a display name: "Aisha Khan" → "AK". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

/** Stable tone index for a name, so the same person always gets the same colour. */
export function toneOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % TONES;
}

interface Props {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}

/**
 * Initials on a soft tint (dark text, ≥ 4.6 : 1) or the member's photo.
 * Decorative by default — the name is always rendered next to it.
 */
export function Avatar({ name, src, size = "md", className }: Props) {
  const classes = ["avatar", `avatar--${size}`, `avatar--tone-${toneOf(name)}`, className]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes} aria-hidden="true">
      {src ? (
        <Image src={src} alt="" width={PX[size]} height={PX[size]} className="avatar__img" unoptimized />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
