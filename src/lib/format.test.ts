import { describe, expect, it } from "vitest";
import { formatPrice, hhmm, intlPhone } from "./format";

describe("format", () => {
  it("formats pence as pounds", () => {
    expect(formatPrice(1400)).toBe("£14");
    expect(formatPrice(1450)).toBe("£14.50");
    expect(formatPrice(500)).toBe("£5");
  });
  it("converts UK phone to international digits", () => {
    expect(intlPhone("07535 423544")).toBe("447535423544");
  });
  it("trims seconds from DB times", () => {
    expect(hhmm("09:30:00")).toBe("09:30");
  });
});
