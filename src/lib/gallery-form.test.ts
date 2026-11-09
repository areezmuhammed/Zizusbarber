import { describe, expect, it } from "vitest";
import { MAX_ALT, parseAlt, parseMove, parsePath, parseRegister } from "./gallery-form";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("parseAlt", () => {
  it("trims and accepts up to the limit, empty is allowed", () => {
    expect(parseAlt("  Skin fade  ")).toBe("Skin fade");
    expect(parseAlt("")).toBe("");
    expect(parseAlt("x".repeat(MAX_ALT))).toHaveLength(120);
  });
  it.each([null, undefined, 3, "x".repeat(121)])("rejects %j", (v) => expect(parseAlt(v)).toBeNull());
});

describe("parsePath", () => {
  it("accepts only server-shaped gallery paths", () => expect(parsePath(`gallery/${ID}.jpg`)).toBe(`gallery/${ID}.jpg`));
  it.each([
    `${ID}.jpg`, `gallery/${ID}.png`, `gallery/../${ID}.jpg`, `other/${ID}.jpg`, `gallery/${ID}.jpg/x`,
    `gallery/${ID.toUpperCase()}.jpg`, "gallery/me.jpg", 1, null,
  ])("rejects %j", (v) => expect(parsePath(v)).toBeNull());
});

describe("parseRegister", () => {
  it("needs a valid path and alt", () => {
    expect(parseRegister({ path: `gallery/${ID}.jpg`, alt: " Beard " })).toEqual({ path: `gallery/${ID}.jpg`, alt: "Beard" });
    expect(parseRegister({ path: `gallery/${ID}.jpg`, alt: "x".repeat(121) })).toBeNull();
    expect(parseRegister({ path: "x", alt: "" })).toBeNull();
    expect(parseRegister(null)).toBeNull();
  });
});

describe("parseMove", () => {
  it("accepts a uuid and -1/1", () => {
    expect(parseMove({ id: ID, dir: -1 })).toEqual({ id: ID, dir: -1 });
    expect(parseMove({ id: ID, dir: 1 })).toEqual({ id: ID, dir: 1 });
  });
  it.each([{ id: ID, dir: 0 }, { id: ID, dir: 2 }, { id: ID, dir: "1" }, { id: "nope", dir: 1 }, null])("rejects %j", (v) =>
    expect(parseMove(v)).toBeNull(),
  );
});
