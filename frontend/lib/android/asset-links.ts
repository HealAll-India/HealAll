/**
 * Digital Asset Links for the HealAll Android app (a Trusted Web Activity).
 *
 * Android only opens the app full screen, without a browser address bar, when
 * https://healallindia.com/.well-known/assetlinks.json lists the SHA-256
 * fingerprint of the key the installed app was signed with. With Play App
 * Signing that is Google's app signing key, so list it as well as the upload
 * key. Both come from env so a key change needs no code change.
 */

export const DEFAULT_ANDROID_PACKAGE = "com.healallindia.app";

const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** Parse a comma- or whitespace-separated list, keeping only well-formed SHA-256 fingerprints. */
export function parseFingerprints(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,]+/)) {
    const value = part.trim().toUpperCase();
    if (FINGERPRINT.test(value)) seen.add(value);
  }
  return [...seen];
}

export function buildAssetLinks(packageName: string, fingerprints: string[]) {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
