import { afterEach, describe, expect, it, vi } from "vitest";
import { fitWithin, MAX_EDGE, MAX_INPUT, resizeForUpload } from "./image";

describe("fitWithin", () => {
  it("scales the long edge down to the max, keeping aspect", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(5000, 1000, 1600)).toEqual({ width: 1600, height: 320 });
  });
  it("never upscales", () => expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 }));
  it("never rounds a side to zero", () => expect(fitWithin(10000, 1, 1600)).toEqual({ width: 1600, height: 1 }));
});

// Stubbed browser: createImageBitmap + OffscreenCanvas record what the resizer asked for.
function stubBrowser(bitmap: { width: number; height: number } | Error) {
  const drawn: number[][] = [];
  const encoded: { type?: string; quality?: number }[] = [];
  vi.stubGlobal("createImageBitmap", vi.fn(async () => {
    if (bitmap instanceof Error) throw bitmap;
    return { ...bitmap, close: vi.fn() };
  }));
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      constructor(public width: number, public height: number) {}
      getContext() {
        return { drawImage: (_b: unknown, ...a: number[]) => drawn.push(a) };
      }
      async convertToBlob(o: { type?: string; quality?: number }) {
        encoded.push(o);
        return new Blob(["jpeg"], { type: o.type });
      }
    },
  );
  return { drawn, encoded };
}

const file = (type: string, size = 10) => new File([new Uint8Array(size)], "x", { type });

afterEach(() => vi.unstubAllGlobals());

describe("resizeForUpload", () => {
  it("re-encodes a large photo to a JPEG within 1600px", async () => {
    const { drawn, encoded } = stubBrowser({ width: 4000, height: 3000 });
    const out = await resizeForUpload(file("image/jpeg"));
    expect(out.type).toBe("image/jpeg");
    expect(drawn).toEqual([[0, 0, 1600, 1200]]);
    expect(encoded).toEqual([{ type: "image/jpeg", quality: 0.8 }]);
    expect(MAX_EDGE).toBe(1600);
  });
  it("rejects a file that is not an image type", async () => {
    stubBrowser({ width: 10, height: 10 });
    await expect(resizeForUpload(file("application/pdf"))).rejects.toThrow("not a photo");
  });
  it("rejects an 'image' that will not decode", async () => {
    stubBrowser(new Error("bad"));
    vi.stubGlobal("Image", undefined); // no <img> fallback in node
    await expect(resizeForUpload(file("image/jpeg"))).rejects.toThrow("not a photo");
  });
  it("rejects an oversized original", async () => {
    stubBrowser({ width: 10, height: 10 });
    await expect(resizeForUpload(file("image/jpeg", MAX_INPUT + 1))).rejects.toThrow("too big");
  });
});
