import { describe, expect, it } from "vitest";

import { buildAssetLinks, parseFingerprints } from "@/lib/android/asset-links";

const A = Array.from({ length: 32 }, () => "AB").join(":");
const B = Array.from({ length: 32 }, () => "0f").join(":");

describe("parseFingerprints", () => {
  it("returns nothing when unset", () => {
    expect(parseFingerprints(undefined)).toEqual([]);
    expect(parseFingerprints("")).toEqual([]);
  });

  it("accepts comma or whitespace separated values, uppercases and dedupes", () => {
    expect(parseFingerprints(`${A}, ${B}\n${A.toLowerCase()}`)).toEqual([A, B.toUpperCase()]);
  });

  it("drops malformed values", () => {
    expect(parseFingerprints("AB:CD, not-a-key")).toEqual([]);
  });
});

describe("buildAssetLinks", () => {
  it("delegates all URLs to the Android package", () => {
    expect(buildAssetLinks("com.healallindia.app", [A])).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "com.healallindia.app", sha256_cert_fingerprints: [A] },
      },
    ]);
  });
});
