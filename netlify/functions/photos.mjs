// Idre Julen 2026 – gemensamt bildalbum lagrat i Netlify Blobs.
// GET    /api/photos              -> lista med alla bilder (nyast först)
// POST   /api/photos              -> ladda upp (multipart: full, thumb, w, h, by, key)
// GET    /api/photos/img/:id      -> bilden (th/:id ger miniatyren)
// DELETE /api/photos/img/:id      -> ta bort (kräver samma enhetsnyckel som laddade upp, header x-owner-key)
import { getStore } from "@netlify/blobs";
import { createHash, randomBytes } from "node:crypto";

const MAX_PHOTOS = 600, MAX_FULL = 4.5 * 1024 * 1024, MAX_THUMB = 600 * 1024;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const hash = (k) => createHash("sha256").update(String(k)).digest("hex");

async function updateIndex(store, fn) {
  for (let i = 0; i < 10; i++) {
    const cur = await store.getWithMetadata("index", { type: "json" });
    const list = cur?.data || [];
    const next = fn(list);
    if (next === null) return list;
    const res = cur ? await store.setJSON("index", next, { onlyIfMatch: cur.etag }) : await store.setJSON("index", next, { onlyIfNew: true });
    if (res.modified) return next;
    await sleep(40 + Math.random() * 200);
  }
  throw new Error("busy");
}

export default async (req, context) => {
  const store = getStore({ name: "idre-bilder", consistency: "strong" });
  const { kind, id } = context.params || {};

  if (kind) {
    if (!["img", "th"].includes(kind) || !/^[a-z0-9]{8,32}$/.test(id || "")) return json({ error: "not found" }, 404);
    if (req.method === "GET") {
      const buf = await store.get(`${kind}/${id}`, { type: "arrayBuffer" });
      if (!buf) return new Response("Not found", { status: 404 });
      return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } });
    }
    if (req.method === "DELETE") {
      const key = req.headers.get("x-owner-key") || "";
      let allowed = false;
      try {
        await updateIndex(store, (list) => {
          const e = list.find((x) => x.id === id);
          if (!e) return null;
          if (!key || e.o !== hash(key)) return null;
          allowed = true;
          return list.filter((x) => x.id !== id);
        });
      } catch { return json({ error: "busy" }, 409); }
      if (!allowed) return json({ error: "forbidden" }, 403);
      await Promise.all([store.delete(`img/${id}`), store.delete(`th/${id}`)]);
      return json({ ok: true });
    }
    return json({ error: "method" }, 405);
  }

  if (req.method === "GET") {
    const list = (await store.get("index", { type: "json" })) || [];
    return json(list);
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let form;
  try { form = await req.formData(); } catch { return json({ error: "Kunde inte läsa uppladdningen." }, 400); }
  const full = form.get("full"), thumb = form.get("thumb");
  if (!full || !thumb || typeof full.arrayBuffer !== "function") return json({ error: "Bild saknas." }, 400);
  const fb = new Uint8Array(await full.arrayBuffer()), tb = new Uint8Array(await thumb.arrayBuffer());
  if (!isJpeg(fb) || !isJpeg(tb)) return json({ error: "Bara bilder (JPEG) kan laddas upp." }, 400);
  if (fb.length > MAX_FULL || tb.length > MAX_THUMB) return json({ error: "Bilden är för stor." }, 413);
  const key = String(form.get("key") || "");
  if (key.length < 16) return json({ error: "Nyckel saknas." }, 400);
  const entry = {
    id: randomBytes(9).toString("hex").slice(0, 16),
    w: Math.max(1, Math.min(10000, parseInt(form.get("w")) || 1)),
    h: Math.max(1, Math.min(10000, parseInt(form.get("h")) || 1)),
    by: clean(form.get("by"), 40),
    ts: Date.now(),
    o: hash(key),
  };
  const cnt = ((await store.get("index", { type: "json" })) || []).length;
  if (cnt >= MAX_PHOTOS) return json({ error: "Albumet är fullt." }, 507);
  await store.set(`img/${entry.id}`, fb);
  await store.set(`th/${entry.id}`, tb);
  try { await updateIndex(store, (list) => [entry, ...list]); }
  catch { return json({ error: "Försök igen om en stund." }, 409); }
  return json(entry);
};

export const config = { path: ["/api/photos", "/api/photos/:kind/:id"] };
