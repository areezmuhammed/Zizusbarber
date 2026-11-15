import { describe, expect, it } from "vitest";
import { formatPrice, hhmm, intlPhone, marqueeText, nationalPhone } from "./format";

describe("format", () => {
  it("formats pence as pounds", () => {
    expect(formatPrice(1400)).toBe("£14");
    expect(formatPrice(1450)).toBe("£14.50");
    expect(formatPrice(500)).toBe("£5");
  });
  it("converts UK phone to international digits", () => {
    expect(intlPhone("07535 423544")).toBe("447535423544");
  });
  it("shows stored +44 numbers in UK national format", () => {
    expect(nationalPhone("+447700900123")).toBe("07700 900123");
    expect(nationalPhone("+441144960000")).toBe("01144960000");
    expect(nationalPhone("0700")).toBe("0700"); // anything else shown as stored
  });
  it("trims seconds from DB times", () => {
    expect(hhmm("09:30:00")).toBe("09:30");
  });
});

describe("marqueeText", () => {
  it("joins trimmed names with a middle dot", () => {
    expect(marqueeText(["Skin fade", "Beard trim"])).toBe("Skin fade · Beard trim");
    expect(marqueeText([])).toBe("");
    expect(marqueeText([" Taper "])).toBe("Taper");
  });
});
