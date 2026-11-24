// Idre Julen 2026 – gemensamma listor (inköp, kom ihåg m.m.) lagrade i Netlify Blobs.
// GET  /api/notes            -> hela tillståndet
// POST /api/notes {ops:[…]}  -> applicerar ändringar och returnerar nytt tillstånd
import { getStore } from "@netlify/blobs";

const KEY = "state";
const LIM = { lists: 40, items: 400, text: 300, title: 60, ops: 50 };
const KINDS = ["inkop", "komihag", "pack", "annat"];
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const okId = (s) => typeof s === "string" && /^[a-z0-9]{6,24}$/i.test(s);

// Samma logik körs i appen (för direkt respons) och här (sanningen).
export function apply(st, op) {
  if (!op || typeof op !== "object") return false;
  const L = st.lists;
  const list = (id) => L.find((l) => l.id === id);
  const item = (l, id) => l && l.items.find((x) => x.id === id);
  switch (op.t) {
    case "addList": {
      if (!okId(op.id) || list(op.id) || L.length >= LIM.lists) return false;
      L.unshift({ id: op.id, title: clean(op.title, LIM.title) || "Ny lista", kind: KINDS.includes(op.kind) ? op.kind : "annat", items: [] });
      return true;
    }
    case "renameList": {
      const l = list(op.id), t = clean(op.title, LIM.title);
      if (!l || !t || t === l.title) return false;
      l.title = t; return true;
    }
    case "deleteList": {
      const i = L.findIndex((l) => l.id === op.id);
      if (i < 0) return false;
      L.splice(i, 1); return true;
    }
    case "addItem": {
      const l = list(op.list), tx = clean(op.text, LIM.text);
      if (!l || !okId(op.id) || !tx || item(l, op.id) || l.items.length >= LIM.items) return false;
      l.items.push({ id: op.id, text: tx, done: false }); return true;
    }
    case "editItem": {
      const it = item(list(op.list), op.id), tx = clean(op.text, LIM.text);
      if (!it || !tx || it.text === tx) return false;
      it.text = tx; return true;
    }
    case "toggleItem": {
      const it = item(list(op.list), op.id), d = !!op.done;
      if (!it || it.done === d) return false;
      it.done = d; return true;
    }
    case "deleteItem": {
      const l = list(op.list); if (!l) return false;
      const n = l.items.length; l.items = l.items.filter((x) => x.id !== op.id);
      return l.items.length !== n;
    }
    case "clearDone": {
      const l = list(op.list); if (!l) return false;
      const n = l.items.length; l.items = l.items.filter((x) => !x.done);
      return l.items.length !== n;
    }
    case "fav": { // gemensamma favoriter bland events
      if (typeof op.k !== "string" || !op.k || op.k.length > 200) return false;
      st.favs = st.favs || {};
      if (op.on) {
        if (st.favs[op.k] || Object.keys(st.favs).length >= 500) return false;
        st.favs[op.k] = { by: clean(op.by, 40), ts: Date.now() };
        return true;
      }
      if (!st.favs[op.k]) return false;
      delete st.favs[op.k]; return true;
    }
  }
  return false;
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (req) => {
  const store = getStore({ name: "idre-listor", consistency: "strong" });
  if (req.method === "GET") {
    const cur = await store.getWithMetadata(KEY, { type: "json" });
    return json(cur?.data || { lists: [], rev: 0 });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "json" }, 400); }
  const ops = Array.isArray(body?.ops) ? body.ops.slice(0, LIM.ops) : [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const cur = await store.getWithMetadata(KEY, { type: "json" });
    const st = cur?.data || { lists: [], rev: 0 };
    let changed = false;
    for (const op of ops) changed = apply(st, op) || changed;
    if (!changed) return json(st);
    st.rev = (st.rev || 0) + 1;
    st.updated = Date.now();
    const res = cur ? await store.setJSON(KEY, st, { onlyIfMatch: cur.etag }) : await store.setJSON(KEY, st, { onlyIfNew: true });
    if (res.modified) return json(st);
    await sleep(40 + Math.random() * 160); // någon annan hann före – läs om och försök igen
  }
  return json({ error: "busy" }, 409);
};

export const config = { path: "/api/notes" };
