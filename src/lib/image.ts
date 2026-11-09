// Client-side photo prep before upload: phone photos are 3-12MB, the site needs ~200KB.
// Privacy: phone photos carry GPS and device EXIF. Drawing to a canvas and re-encoding keeps only pixels,
// so no metadata (location included) ever leaves the owner's phone.

export const MAX_EDGE = 1600;
export const MAX_INPUT = 25 * 1024 * 1024;
const QUALITY = 0.8;
const NOT_PHOTO = "That file is not a photo. Choose a photo from your camera or gallery.";

export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

type Source = { image: CanvasImageSource; width: number; height: number; close?: () => void };

async function decode(file: File): Promise<Source> {
  try {
    // from-image applies the EXIF rotation, so portrait phone shots stay upright
    const b = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { image: b, width: b.width, height: b.height, close: () => b.close() };
  } catch {
    if (typeof Image === "undefined") throw new Error(NOT_PHOTO);
    // older Safari: <img> decode (browsers also honour EXIF orientation here by default)
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { image: img, width: img.naturalWidth, height: img.naturalHeight };
    } catch {
      throw new Error(NOT_PHOTO);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function canvas(width: number, height: number) {
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(width, height);
    return { ctx: c.getContext("2d"), blob: () => c.convertToBlob({ type: "image/jpeg", quality: QUALITY }) };
  }
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return {
    ctx: c.getContext("2d"),
    blob: () =>
      new Promise<Blob>((ok, fail) =>
        c.toBlob((b) => (b ? ok(b) : fail(new Error("Could not prepare that photo."))), "image/jpeg", QUALITY),
      ),
  };
}

/** Decodes a picked photo, shrinks it to MAX_EDGE on the long side and re-encodes it as JPEG. Throws a readable Error. */
export async function resizeForUpload(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error(NOT_PHOTO);
  if (file.size > MAX_INPUT) throw new Error("That photo is too big (over 25MB). Choose a smaller one.");
  const src = await decode(file);
  try {
    const { width, height } = fitWithin(src.width, src.height, MAX_EDGE);
    const c = canvas(width, height);
    if (!c.ctx) throw new Error("Could not prepare that photo.");
    c.ctx.drawImage(src.image, 0, 0, width, height);
    return await c.blob();
  } finally {
    src.close?.();
  }
}
