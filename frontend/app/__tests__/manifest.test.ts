import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string): string {
  const bytes = readFileSync(file);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe("web app manifest", () => {
  const m = manifest();

  it("has what browsers need to offer installation", () => {
    expect(m.name).toBe("HealAll");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    const sizes = (purpose: string) => m.icons?.filter((icon) => icon.purpose === purpose).map((icon) => icon.sizes);
    expect(sizes("any")).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(sizes("maskable")).toEqual(expect.arrayContaining(["512x512"]));
  });

  it("points at PNG files of the declared size", () => {
    const icons = [...(m.icons ?? []), ...(m.shortcuts ?? []).flatMap((shortcut) => shortcut.icons ?? [])];
    for (const icon of icons) {
      const file = path.resolve(process.cwd(), "public", `.${icon.src}`);
      expect(existsSync(file), icon.src).toBe(true);
      expect(pngSize(file), icon.src).toBe(icon.sizes);
    }
  });
});
