import { buildAssetLinks, DEFAULT_ANDROID_PACKAGE, parseFingerprints } from "@/lib/android/asset-links";

// Served at /.well-known/assetlinks.json through a rewrite in next.config.ts.
export const dynamic = "force-dynamic";

export function GET() {
  const fingerprints = parseFingerprints(process.env.ANDROID_SHA256_CERT_FINGERPRINTS);
  if (fingerprints.length === 0) {
    return new Response("Not found", { status: 404 });
  }
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim() || DEFAULT_ANDROID_PACKAGE;
  return Response.json(buildAssetLinks(packageName, fingerprints), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
