// 04 语料重判：静态 hazard 当**不可站立禁区**（而不是 solid）时，新增多少 reachability error。
// 运行：node .scratch/level-playability-v1/research/04-hazard-mask-corpus.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { entityBox, FALLBACK_ANCHOR, jumpSpan, maxJumpHeight, parseAssetPack, parseGameConfig, playerMoveOf } from "../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SKIP = new Set(["node_modules", ".git", "dist", ".vite", "coverage"]);
const JSON_DIRS = ["out", "fixtures", ".scratch", "packages/demo/fixtures"];
function walk(dir, out) { let es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; } for (const d of es) { const p = path.join(dir, d.name); if (d.isDirectory()) { if (!SKIP.has(d.name)) walk(p, out); } else if (d.isFile() && d.name.endsWith(".json")) out.push(p); } }
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const files = []; for (const d of JSON_DIRS) walk(path.join(ROOT, d), files);
const configs = [], manifests = [];
for (const f of files) { let raw; try { raw = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; } if (!raw || typeof raw !== "object") continue;
  if (raw.format === "game-config/v1") configs.push({ file: f, raw, hash: sha(JSON.stringify(raw)) });
  if (raw.format === "assetpack/v1" || (Array.isArray(raw.assets) && raw.id !== undefined && raw.version !== undefined && raw.files !== undefined)) manifests.push({ file: f, value: { ...raw, assets: raw.assets.filter((a) => a && typeof a === "object" && typeof a.id === "string") } }); }
const refsOf = (c) => { const ids = new Set([c.player.asset, c.scene.background.asset, c.hud.panel.asset, c.hud.pip.asset]); for (const e of c.entities) ids.add(e.asset); return ids; };
const covers = (m, ids) => { const h = new Set(m.assets.map((a) => a.id)); for (const id of ids) if (!h.has(id)) return false; return true; };
const ver = (p) => { const m = /\/v(\d+)\/manifest\.json$/.exec(p.split(path.sep).join("/")); return m ? Number(m[1]) : 0; };
function candidatesFor(file) { const dirs = []; let d = path.dirname(file); for (let i = 0; i < 4; i++) { dirs.push(d); d = path.dirname(d); } const out = [];
  for (const root of dirs) { const pr = path.join(root, "pack"); let vs = []; try { vs = fs.readdirSync(pr); } catch {}
    for (const v of vs) { const mp = path.join(pr, v, "manifest.json"); if (fs.existsSync(mp)) { const hit = manifests.find((x) => x.file === mp); if (hit) out.push(hit); } }
    for (const rel of ["manifest.json", "pack/manifest.json"]) { const mp = path.join(root, rel); const hit = manifests.find((x) => x.file === mp); if (hit) out.push(hit); } }
  return out.sort((a, b) => ver(b.file) - ver(a.file)); }
const common = (a, b) => { const aa = a.split(path.sep), bb = b.split(path.sep); let i = 0; while (i < aa.length && i < bb.length && aa[i] === bb[i]) i++; return i; };
const unique = new Map(); for (const c of configs) unique.set(c.hash, c);

function reachMask(config, M) {
  const sizeOf = (id) => (id ? M.assets.find((a) => a.id === id)?.size : undefined) ?? null;
  const anchorOf = (id) => (id ? M.assets.find((a) => a.id === id)?.anchor : undefined) ?? FALLBACK_ANCHOR;
  const pSize = sizeOf(config.player.asset), pAnchor = anchorOf(config.player.asset);
  if (!pSize) return { errs: [], targets: [] };
  const move = playerMoveOf(config);
  const { w: W, h: H } = config.world.size;
  const solids = config.terrain.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
  const hazardRects = [];
  for (const e of config.entities) {
    if (e.kind === "solid") { const s = e.body ?? sizeOf(e.asset); if (!s) continue; const b = entityBox(e.at, s, anchorOf(e.asset));
      if (!e.motion) solids.push(b); else { const d = e.motion.distance; solids.push(e.motion.axis === "x" ? { x: Math.min(b.x, b.x + d), y: b.y, w: b.w + Math.abs(d), h: b.h } : { x: b.x, y: Math.min(b.y, b.y + d), w: b.w, h: b.h + Math.abs(d) }); } }
    // ⚠️ hazard 的运行时碰撞体来自精灵帧尺寸；body 覆盖被忽略（S7）。这里用 asset size。
    if (e.kind === "hazard" && !e.motion) { const s = sizeOf(e.asset); if (s) hazardRects.push(entityBox(e.at, s, anchorOf(e.asset))); }
  }
  const stride = H + 1;
  const blocked = new Uint8Array((W + 1) * stride), hazard = new Uint8Array((W + 1) * stride);
  const fill = (arr, s) => { const x0 = Math.max(0, Math.floor(s.x - pSize.w / 2) + 1), x1 = Math.min(W, Math.ceil(s.x + s.w + pSize.w / 2) - 1);
    const y0 = Math.max(0, Math.floor(s.y) + 1), y1 = Math.min(H, Math.ceil(s.y + s.h + pSize.h) - 1);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) arr[x * stride + y] = 1; };
  for (const s of solids) fill(blocked, s); for (const s of hazardRects) fill(hazard, s);
  const freeAt = new Uint8Array((W + 1) * stride);
  for (let x = 0; x <= W; x++) for (let y = 0; y <= H; y++) { const i = x * stride + y; freeAt[i] = blocked[i] === 0 && hazard[i] === 0 && y + 1 <= H && blocked[i + 1] === 1 ? 1 : 0; }
  const cols = []; for (let x = 0; x <= W; x++) { const ys = []; for (let y = 0; y <= H; y++) if (freeAt[x * stride + y] === 1) ys.push(y); cols.push(ys); }
  const gate = config.entities.find((e) => e.kind === "goal" && e.id === config.objective.gate);
  const targets = [...config.entities.filter((e) => e.kind === "pickup").map((e) => ({ id: e.id, at: e.at })),
    ...config.entities.filter((e) => e.kind === "chest").map((e) => ({ id: e.id, at: e.at })),
    ...(gate ? [{ id: gate.id, at: gate.at }] : [])];
  const covered = targets.map(() => false);
  const covers = (x, y) => { for (const [i, t] of targets.entries()) if (!covered[i] && Math.abs(x - t.at.x) <= pSize.w && Math.abs(y - t.at.y) <= pSize.h) covered[i] = true; };
  const apex = maxJumpHeight(move), maxDx = Math.ceil(jumpSpan(move, H));
  const hop = (ax, ay, bx, by) => { const dh = ay - by; if (dh > apex || dh < -H) return false;
    const disc = move.jumpVelocity ** 2 - 2 * move.gravity * dh; if (disc < 0) return false;
    const t = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity; if (Math.abs(bx - ax) > move.speed * t) return false;
    const n = Math.max(6, Math.min(120, Math.ceil(t * 60)));
    for (let i = 0; i <= n; i++) { const f = i / n, tt = t * f; const x = Math.round(ax + (bx - ax) * f);
      const y = Math.round(ay - (move.jumpVelocity * tt - (move.gravity * tt * tt) / 2));
      if (y < 0 || y > H || x < 0 || x > W) continue; if (blocked[x * stride + y] === 1 || hazard[x * stride + y] === 1) return false; covers(x, y); }
    return true; };
  const spawn = { x: config.player.at.x + (0.5 - pAnchor.x) * pSize.w, y: config.player.at.y + (1 - pAnchor.y) * pSize.h };
  const seen = new Uint8Array((W + 1) * stride), queue = [];
  const seedAt = (x, y) => { const i = x * stride + y; if (seen[i]) return; seen[i] = 1; queue.push({ x, y }); covers(x, y); };
  for (let x = Math.max(0, Math.round(spawn.x - pSize.w)); x <= Math.min(W, Math.round(spawn.x + pSize.w)); x++) for (const y of cols[x]) if (y >= spawn.y - pSize.h) seedAt(x, y);
  if (queue.length === 0) return { errs: [], targets };
  covers(Math.round(spawn.x), Math.round(spawn.y));
  for (let head = 0; head < queue.length; head++) { const { x: ax, y: ay } = queue[head];
    for (let dx = -maxDx; dx <= maxDx; dx++) { const bx = ax + dx; if (bx < 0 || bx > W) continue;
      for (const by of cols[bx]) { if (seen[bx * stride + by]) continue; if (!hop(ax, ay, bx, by)) continue; seen[bx * stride + by] = 1; queue.push({ x: bx, y: by }); } } }
  const errs = targets.filter((_, i) => !covered[i]).map((t) => `entity "${t.id}"`);
  return { errs, targets };
}

const res = { paired: 0, configsWithStaticHazard: 0, maskAddsError: 0, cases: [] };
for (const c of unique.values()) {
  const p = parseGameConfig(c.raw); if (!p.ok) continue; const cfg = p.value;
  const ids = refsOf(cfg);
  let man = candidatesFor(c.file).find((m) => covers(m.value, ids));
  if (!man) man = manifests.filter((m) => covers(m.value, ids)).sort((a, b) => common(b.file, c.file) - common(a.file, c.file))[0];
  if (!man) continue; res.paired++;
  if (!cfg.entities.some((e) => e.kind === "hazard" && !e.motion)) continue; res.configsWithStaticHazard++;
  const r = reachMask(cfg, man.value);
  if (r.errs.length) { res.maskAddsError++; res.cases.push({ file: path.relative(ROOT, c.file), errs: r.errs }); }
}
console.log(JSON.stringify(res, null, 2));
