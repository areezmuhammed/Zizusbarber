import { describe, expect, it } from "vitest";
import { parseBump, parseSetStatus } from "./status-form";

describe("parseBump", () => {
  it("accepts a +/-1 step on a known counter", () => {
    expect(parseBump({ field: "in_shop", delta: 1 })).toEqual({ field: "in_shop", delta: 1 });
    expect(parseBump({ field: "waiting", delta: -1 })).toEqual({ field: "waiting", delta: -1 });
  });
  it.each([null, "x", {}, { field: "state", delta: 1 }, { field: "waiting", delta: 5 }, { field: "waiting", delta: "1" }])(
    "rejects %j",
    (v) => expect(parseBump(v)).toBeNull(),
  );
});

describe("parseSetStatus", () => {
  it("accepts a state and trims the note, empty becomes null", () => {
    expect(parseSetStatus({ state: "busy", note: "  back at 3  " })).toEqual({ state: "busy", note: "back at 3" });
    expect(parseSetStatus({ state: "open", note: "   " })).toEqual({ state: "open", note: null });
    expect(parseSetStatus({ state: "open", note: "x".repeat(80) })?.note).toHaveLength(80);
  });
  it.each([null, {}, { state: "shut", note: "" }, { state: "open" }, { state: "open", note: 5 }, { state: "open", note: "x".repeat(81) }])(
    "rejects %j",
    (v) => expect(parseSetStatus(v)).toBeNull(),
  );
});
