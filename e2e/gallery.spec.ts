import { expect, test, type Browser, type Page } from "@playwright/test";
import { API, deleteUsers, H, makeUser } from "./helpers";

// Starts from (and restores) whatever gallery exists: rows and objects this spec adds are removed in teardown.
const rest = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`${API}/rest/v1/${path}`, { ...init, headers: { ...H, Prefer: "return=representation", ...init.headers } });
  expect(r.ok, await r.clone().text()).toBe(true);
  return r.status === 204 ? [] : r.json();
};
const listObjects = async (): Promise<string[]> => {
  const r = await fetch(`${API}/storage/v1/object/list/gallery`, {
    method: "POST", headers: H, body: JSON.stringify({ prefix: "gallery", limit: 1000 }),
  });
  expect(r.ok).toBe(true);
  return (await r.json()).filter((o: { id: string | null }) => o.id).map((o: { name: string }) => `gallery/${o.name}`);
};
const rows = (): Promise<{ id: string; storage_path: string; alt: string; sort: number }[]> =>
  rest("gallery?select=id,storage_path,alt,sort&order=sort,created_at");

let seedRows: string[] = [];
let seedObjects: string[] = [];

test.beforeAll(async () => {
  seedRows = (await rows()).map((r) => r.id);
  seedObjects = await listObjects();
});

test.afterAll(async () => {
  const errors: unknown[] = [];
  const step = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      errors.push(e);
    }
  };
  await step(async () => {
    const extra = (await rows()).filter((r) => !seedRows.includes(r.id)).map((r) => r.id);
    if (extra.length) await rest(`gallery?id=in.(${extra.join(",")})`, { method: "DELETE" });
  });
  await step(async () => {
    const extra = (await listObjects()).filter((o) => !seedObjects.includes(o));
    if (extra.length)
      await fetch(`${API}/storage/v1/object/gallery`, { method: "DELETE", headers: H, body: JSON.stringify({ prefixes: extra }) });
  });
  await step(deleteUsers);
  if (errors.length) throw errors[0];
});

async function signedIn(browser: Browser, label: string, owner: boolean) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, baseURL: "http://localhost:3107" });
  const page = await ctx.newPage();
  await page.goto(await makeUser(label, owner));
  await expect(page).toHaveURL(/\/admin$/);
  return page;
}

// A big, photo-like JPEG made by the browser's own encoder: smooth gradient + fine grain at max quality.
async function bigJpeg(page: Page, w: number, h: number, quality = 1): Promise<Buffer> {
  const b64 = await page.evaluate(
    async ([w, h, q]) => {
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext("2d")!;
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const x = (i / 4) % w, y = Math.floor(i / 4 / w), n = Math.random() * 40;
        img.data[i] = (x / w) * 200 + n;
        img.data[i + 1] = (y / h) * 160 + n;
        img.data[i + 2] = 90 + n;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const buf = new Uint8Array(await (await c.convertToBlob({ type: "image/jpeg", quality: q })).arrayBuffer());
      let s = "";
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    },
    [w, h, quality] as const,
  );
  return Buffer.from(b64, "base64");
}

// Inserts an EXIF APP1 with Orientation=6 ("rotate 90° clockwise to view"), as a phone held upright writes it.
function withOrientation6(jpeg: Buffer) {
  const app1 = Buffer.from([
    0xff, 0xe1, 0x00, 0x22, ...Buffer.from("Exif\0\0"), 0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

// Width/height from the JPEG frame header, and whether any EXIF segment survived.
function jpegInfo(buf: Buffer) {
  expect([buf[0], buf[1]]).toEqual([0xff, 0xd8]);
  let exif = false;
  for (let i = 2; i < buf.length; ) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xe1 && buf.subarray(i + 4, i + 8).toString() === "Exif") exif = true;
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), exif };
    i += 2 + len;
  }
  throw new Error("no frame header");
}

const publicSrcs = async (page: Page) => {
  await page.goto("/");
  return page.locator("#gallery img").evaluateAll((els) => els.map((e) => (e as HTMLImageElement).src));
};

test("owner uploads, describes, reorders and deletes photos; the public gallery follows", async ({ browser }) => {
  test.setTimeout(120_000);
  const owner = await signedIn(browser, "galowner", true);
  const actions: string[] = [];
  owner.on("request", (r) => {
    const a = r.headers()["next-action"];
    if (r.method() === "POST" && a && !actions.includes(a)) actions.push(a);
  });
  await owner.getByRole("link", { name: "Gallery" }).click();
  await expect(owner).toHaveURL(/\/admin\/gallery$/);
  await expect(owner.getByRole("heading", { name: "Gallery" })).toBeVisible();

  const big = await bigJpeg(owner, 4000, 3000);
  expect(big.length).toBeGreaterThan(8_000_000); // a ~10MB phone-sized original
  const portrait = withOrientation6(await bigJpeg(owner, 2000, 1000, 0.9)); // stored landscape, shown portrait
  const before = await listObjects();

  // a PDF renamed .jpg is refused on the phone and nothing is stored
  await owner.getByLabel("Add photos").setInputFiles({ name: "menu.jpg", mimeType: "image/jpeg", buffer: Buffer.from("%PDF-1.4 not a photo") });
  await expect(owner.getByRole("list", { name: "Uploads" })).toContainText("menu.jpg: That file is not a photo.");
  await owner.getByLabel("Add photos").setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(owner.getByRole("list", { name: "Uploads" })).toContainText("notes.pdf: That file is not a photo.");
  expect(await listObjects()).toEqual(before);

  await owner.getByLabel("Add photos").setInputFiles([
    { name: "fade.jpg", mimeType: "image/jpeg", buffer: big },
    { name: "beard.jpg", mimeType: "image/jpeg", buffer: portrait },
  ]);
  const uploads = owner.getByRole("list", { name: "Uploads" });
  await expect(uploads).toContainText("fade.jpg: Added", { timeout: 30_000 });
  await expect(uploads).toContainText("beard.jpg: Added", { timeout: 30_000 });
  await expect(owner.getByText("2 photos", { exact: true })).toBeVisible();

  const added = (await rows()).filter((r) => !seedRows.includes(r.id));
  expect(added).toHaveLength(2);
  for (const r of added) expect(r.storage_path).toMatch(/^gallery\/[0-9a-f-]{36}\.jpg$/);
  const [fade, beard] = added;

  // stored objects are small, at most 1600px, upright, and carry no EXIF
  const fetchObj = (p: string) => fetch(`${API}/storage/v1/object/public/gallery/${p}`);
  const fadeBuf = Buffer.from(await (await fetchObj(fade.storage_path)).arrayBuffer());
  expect(fadeBuf.length).toBeLessThanOrEqual(500 * 1024);
  expect(jpegInfo(fadeBuf)).toEqual({ width: 1600, height: 1200, exif: false });
  const beardBuf = Buffer.from(await (await fetchObj(beard.storage_path)).arrayBuffer());
  expect(jpegInfo(beardBuf)).toEqual({ width: 800, height: 1600, exif: false });

  // public home gallery shows both, in order, straight away
  const visitor = await browser.newPage({ baseURL: "http://localhost:3107" });
  const srcs = await publicSrcs(visitor);
  expect(srcs.slice(-2).map((s) => s.split("/").pop())).toEqual([fade.storage_path, beard.storage_path].map((p) => p.split("/").pop()));

  // describe a photo: alt text reaches the public page
  const list = owner.getByRole("list", { name: "Photos" });
  const fadeItem = list.getByRole("listitem").filter({ has: owner.locator(`img[src$="${fade.storage_path}"]`) });
  await fadeItem.getByText("Describe this photo").click();
  await fadeItem.getByLabel("Description").fill("Skin fade with a sharp line-up");
  await fadeItem.getByRole("button", { name: "Save description" }).click();
  await expect(fadeItem.getByText("Saved.", { exact: true })).toBeVisible();
  await visitor.goto("/");
  await expect(visitor.getByRole("img", { name: "Skin fade with a sharp line-up" })).toBeVisible();

  // reorder: move the last photo up; the public order follows
  const n = (await rows()).length;
  await owner.getByRole("button", { name: `Move photo ${n} up` }).click();
  await expect.poll(async () => (await rows()).slice(-2).map((r) => r.id)).toEqual([beard.id, fade.id]);
  expect((await rows()).map((r) => r.sort)).toEqual([...Array(n).keys()].map((k) => k + 1));
  const after = await publicSrcs(visitor);
  expect(after.slice(-2).map((s) => s.split("/").pop())).toEqual([beard.storage_path, fade.storage_path].map((p) => p.split("/").pop()));

  // a non-owner and a signed-out visitor replaying the actions get nothing
  const [createTarget, , , move] = actions; // createUploadTarget, registerPhoto, saveAlt, movePhoto
  expect(actions.length).toBeGreaterThanOrEqual(4);
  const headers = (a: string) => ({ "next-action": a, "content-type": "text/plain;charset=UTF-8", accept: "text/x-component" });
  const other = await signedIn(browser, "galother", false);
  const r1 = await other.context().request.post("/admin/gallery", { headers: headers(createTarget), data: "[]" });
  const t1 = await r1.text();
  expect(t1).toContain("forbidden");
  expect(t1).not.toContain("token");
  const r2 = await other.context().request.post("/admin/gallery", {
    headers: headers(move), data: JSON.stringify([{ id: fade.id, dir: -1 }]),
  });
  expect(await r2.text()).toContain("forbidden");
  const anon = await browser.newContext({ baseURL: "http://localhost:3107" });
  const r3 = await anon.request.post("/admin/gallery", { headers: headers(createTarget), data: "[]", maxRedirects: 0 });
  expect(await r3.text()).not.toContain("token");
  // and storage itself refuses a direct anon upload or delete
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const anonH = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
  const up = await fetch(`${API}/storage/v1/object/gallery/gallery/anon.jpg`, {
    method: "POST", headers: { ...anonH, "Content-Type": "image/jpeg" }, body: new Uint8Array(fadeBuf),
  });
  expect(up.ok).toBe(false);
  await fetch(`${API}/storage/v1/object/gallery/${fade.storage_path}`, { method: "DELETE", headers: anonH });
  expect((await fetchObj(fade.storage_path)).status).toBe(200);
  expect((await rows()).slice(-2).map((r) => r.id)).toEqual([beard.id, fade.id]);

  // delete with confirm removes the row and the object
  const pos = (await rows()).findIndex((r) => r.id === fade.id) + 1;
  await owner.getByRole("button", { name: `Delete photo ${pos}` }).click();
  await owner.getByRole("button", { name: "Yes, delete" }).click();
  await expect.poll(async () => (await rows()).some((r) => r.id === fade.id)).toBe(false);
  await expect.poll(async () => (await fetchObj(fade.storage_path)).status).not.toBe(200);
  expect(await listObjects()).not.toContain(fade.storage_path);
  expect(await publicSrcs(visitor)).not.toContainEqual(expect.stringContaining(fade.storage_path));

  await anon.close();
  await other.context().close();
  await visitor.close();
  await owner.context().close();
});
