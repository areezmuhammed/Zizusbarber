import { describe, expect, it } from "vitest";
import { shopConfig } from "../../shop.config";

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("theme", () => {
  it("theme text colours meet 4.5:1 on every surface", () => {
    const t = shopConfig.theme;
    for (const fg of [t.text, t.muted, t.accent, t.destructive])
      for (const bg of [t.bg, t.band, t.surface]) expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.bg, t.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("theme is the approved Heritage palette", () => {
    expect(shopConfig.theme).toEqual({
      bg: "#120F0B", band: "#17130E", surface: "#1F1913", text: "#F3EAD8",
      muted: "#B3A487", accent: "#C9A44C", destructive: "#E5605A",
    });
  });

  it("admin status chips meet 4.5:1 on the card surface", () => {
    const t = shopConfig.theme;
    const mix = (fg: string, a: number) =>
      "#" + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(t.surface.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, "0")).join("");
    // bg-primary/15 text-primary, bg-destructive/10 (15% is only 4.19:1) text-destructive, bg-muted text-muted-foreground, arrived: bg-primary text-primary-foreground
    expect(ratio(t.accent, mix(t.accent, 0.15))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.destructive, mix(t.destructive, 0.1))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.muted, t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.bg, t.accent)).toBeGreaterThanOrEqual(4.5);
  });
});
