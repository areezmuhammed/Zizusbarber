import { expect, it } from "vitest";
import { applyCookies } from "./response-cookies";

it("sets cookies and cache headers on the response", () => {
  const set: string[] = [];
  const res = { cookies: { set: (n: string) => set.push(n) }, headers: new Headers() };
  applyCookies(res, [{ name: "sb", value: "v", options: {} }], { "Cache-Control": "private, no-store", Pragma: "no-cache" });
  expect(set).toEqual(["sb"]);
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(res.headers.get("pragma")).toBe("no-cache");
});
