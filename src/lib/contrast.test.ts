import { describe, expect, it } from "vitest";
import { shopConfig } from "../../shop.config";

// WCAG 2 contrast for the theme tokens, including the color-mix() surfaces built in src/app/layout.tsx.
type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const unlin = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function toOklab(c: RGB): RGB {
  const [r, g, b] = c.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function fromOklab([L, a, b]: RGB): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => unlin(Math.min(1, Math.max(0, c)))) as RGB;
}
// color-mix(in oklab, a p, b)
const mix = (a: string, b: string, p: number): RGB => {
  const A = toOklab(hex(a)), B = toOklab(hex(b));
  return fromOklab(A.map((x, i) => x * p + B[i] * (1 - p)) as RGB);
};
const lum = (c: RGB) => { const [r, g, b] = c.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (x: RGB, y: RGB) => { const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p); return (a + 0.05) / (b + 0.05); };

const t = shopConfig.theme;
const bg = { background: hex(t.bg), card: hex(t.surface), "secondary/accent (raised)": mix(t.text, t.surface, 0.08) };

describe("theme contrast (WCAG AA, 4.5:1 for normal text)", () => {
  // text colours used on public pages, on every surface they sit on
  for (const [fg, c] of [["foreground", t.text], ["muted-foreground", t.muted], ["primary", t.accent]] as const)
    for (const [surface, s] of Object.entries(bg))
      it(`${fg} on ${surface}`, () => expect(ratio(hex(c), s)).toBeGreaterThanOrEqual(4.5));
  // error text sits on the page and on cards only
  for (const surface of ["background", "card"] as const)
    it(`destructive on ${surface}`, () => expect(ratio(hex(t.destructive), bg[surface])).toBeGreaterThanOrEqual(4.5));
  it("primary-foreground on primary buttons", () => expect(ratio(hex(t.bg), hex(t.accent))).toBeGreaterThanOrEqual(4.5));
  it("background-coloured text on destructive buttons (white would be 3.9:1)", () => {
    expect(ratio(hex(t.bg), hex(t.destructive))).toBeGreaterThanOrEqual(4.5);
    expect(ratio([1, 1, 1], hex(t.destructive))).toBeLessThan(4.5);
  });
});
