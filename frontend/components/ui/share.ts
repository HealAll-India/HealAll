/**
 * Share a link with the OS share sheet when the browser has one, otherwise
 * copy it to the clipboard. Dismissing the share sheet (AbortError) is not
 * an error and doesn't fall back to copying.
 */
export type ShareOutcome = "shared" | "copied" | "dismissed" | "failed";

type ShareNavigator = Pick<Navigator, "clipboard"> & {
  share?: (data: ShareData) => Promise<void>;
};

function isAbort(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError";
}

export async function shareLink(
  data: { url: string; title: string },
  nav: ShareNavigator | undefined = typeof navigator === "undefined" ? undefined : navigator,
): Promise<ShareOutcome> {
  if (!nav) return "failed";
  if (typeof nav.share === "function") {
    try {
      await nav.share({ title: data.title, url: data.url });
      return "shared";
    } catch (err) {
      if (isAbort(err)) return "dismissed";
      // NotAllowedError etc. — fall through to the clipboard.
    }
  }
  try {
    await nav.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** What to announce for each outcome (nothing when the OS sheet handled it). */
export function shareMessage(outcome: ShareOutcome): string {
  if (outcome === "copied") return "Link copied";
  if (outcome === "failed") return "Couldn't copy the link";
  return "";
}
