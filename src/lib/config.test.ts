import { describe, expect, it } from "vitest";
import { shopConfig } from "../../shop.config";

describe("shopConfig", () => {
  it("has name and London timezone", () => {
    expect(shopConfig.name).toBe("Zizu's Barbers");
    expect(shopConfig.timezone).toBe("Europe/London");
  });
});
