// 03 历史语料只读估算（E3）：02 的同一批语料上，空间判据新版会新增/移除多少 error。
// 运行：node .scratch/level-playability-v1/research/03-corpus-spatial.mjs
// 只读：不写盘、不调上游、零模型调用。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  auditGameConfig, auditReachability, entityBox, jumpSpan, maxJumpHeight, parseAssetPack,
  parseGameConfig, playerMoveOf,
} from "../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SKIP = new Set(["node_modules", ".git", "dist", ".vite", "coverage"]);
const JSON_DIRS = ["out", "fixtures", ".scratch", "packages/demo/fixtures"];

function walk(dir, out) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const d of ents) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) { if (!SKIP.has(d.name)) walk(p, out); }
    else if (d.isFile() && d.name.endsWith(".json")) out.push(p);
  }
}
const files = [];
for (const d of JSON_DIRS) walk(path.join(ROOT, d), files);
const sha = (s) => "sha256:" + crypto.createHash("sha256").update(s).digest("hex");
const configs = [], manifests = [];
for (const f of files) {
  let raw; try { raw = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
  if (raw === null || typeof raw !== "object") continue;
  if (raw.format === "game-config/v1") configs.push({ file: f, raw, hash: sha(JSON.stringify(raw)) });
  if (raw.format === "assetpack/v1" || (Array.isArray(raw.assets) && raw.id !== undefined && raw.version !== undefined && raw.files !== undefined)) {
    const p = parseAssetPack(raw);
    const assets = raw.assets.filter((a) => a !== null && typeof a === "object" && typeof a.id === "string");
    manifests.push({ file: f, value: { ...raw, assets }, raw, parsedOk: p.ok });
  }
}
const refsOf = (c) => { const s = new Set([c.player.asset, c.scene.background.asset, c.hud.panel.asset, c.hud.pip.asset]); for (const e of c.entities) s.add(e.asset); return s; };
const covers = (m, ids) => { const have = new Set(m.assets.map((a) => a.id)); for (const id of ids) if (!have.has(id)) return false; return true; };
const versionOfFile = (p) => { const m = /\/v(\d+)\/manifest\.json$/.exec(p.split(path.sep).join("/")); return m ? Number(m[1]) : 0; };
function candidatesFor(file) {
  const dirs = []; let d = path.dirname(file);
  for (let i = 0; i < 4; i++) { dirs.push(d); d = path.dirname(d); }
  const packing = [];
  for (const root of dirs) {
    for (const rel of ["pack", "."]) {
      const packRoot = path.join(root, rel);
      let vs = []; try { vs = fs.readdirSync(packRoot); } catch {}
      for (const v of vs) {
        const mp = path.join(packRoot, v, "manifest.json");
        if (!fs.existsSync(mp)) continue;
        const hit = manifests.find((x) => x.file === mp); if (hit) packing.push(hit);
      }
    }
    const mp = path.join(root, "manifest.json");
    const hit = manifests.find((x) => x.file === mp); if (hit) packing.push(hit);
  }
  return packing.sort((a, b) => versionOfFile(b.file) - versionOfFile(a.file));
}
const common = (a, b) => { const aa = a.split(path.sep), bb = b.split(path.sep); let i = 0; while (i < aa.length && i < bb.length && aa[i] === bb[i]) i++; return i; };

const assetOf = (m, id) => m.assets.find((a) => a.id === id);
const anchorOf = (m, id) => assetOf(m, id)?.anchor ?? { x: 0.5, y: 1 };
const sizeOf = (m, id) => assetOf(m, id)?.size ?? null;

function spatial(config, manifest, opts = {}) {
  const { w: W, h: H } = config.world.size;
  const move = playerMoveOf(config);
  const pa = assetOf(manifest, config.player.asset);
  if (!pa) return { errors: [], gaps: ["player-asset-missing"] };
  const pSize = pa.size, pAnchor = pa.anchor;
  const walk = opts.walk ?? true, fall = opts.fall ?? true, chestTargets = opts.chest ?? true;
  const staticMotion = opts.staticMotion ?? true, runtimeBody = opts.runtimeBody ?? true;

  const solids = config.terrain.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
  for (const e of config.entities) {
    if (e.kind !== "solid") continue;
    const s = e.body ?? sizeOf(manifest, e.asset); if (!s) continue;
    const b = entityBox(e.at, s, anchorOf(manifest, e.asset));
    if (!e.motion || staticMotion) { solids.push(b); continue; }
    const d = e.motion.distance;
    solids.push(e.motion.axis === "x" ? { x: Math.min(b.x, b.x + d), y: b.y, w: b.w + Math.abs(d), h: b.h } : { x: b.x, y: Math.min(b.y, b.y + d), w: b.w, h: b.h + Math.abs(d) });
  }
  const stride = H + 1;
  const blocked = new Uint8Array((W + 1) * stride);
  for (const s of solids) {
    const x0 = Math.max(0, Math.floor(s.x - pSize.w / 2) + 1), x1 = Math.min(W, Math.ceil(s.x + s.w + pSize.w / 2) - 1);
    const y0 = Math.max(0, Math.floor(s.y) + 1), y1 = Math.min(H, Math.ceil(s.y + s.h + pSize.h) - 1);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) blocked[x * stride + y] = 1;
  }
  const cols = [];
  for (let x = 0; x <= W; x++) { const ys = []; for (let y = 0; y <= H; y++) if (blocked[x * stride + y] === 0 && y + 1 <= H && blocked[x * stride + y + 1] === 1) ys.push(y); cols.push(ys); }

  // chest / solid / danger 的运行时几何吃 e.body；pickup / hazard / goal 忽略它（scene.ts:149-198）。
  const boxOf = (e) => { const honorsBody = e.kind === "chest" || e.kind === "solid" || e.kind === "danger"; const s = runtimeBody && !honorsBody ? sizeOf(manifest, e.asset) : (e.body ?? sizeOf(manifest, e.asset)); return s ? entityBox(e.at, s, anchorOf(manifest, e.asset)) : null; };
  const expand = (b, r) => ({ x: b.x - r, y: b.y - r, w: b.w + 2 * r, h: b.h + 2 * r });
  const targets = [];
  for (const e of config.entities) {
    if (e.kind === "pickup") { const b = boxOf(e); if (b) targets.push({ id: e.id, kind: e.kind, rect: b }); }
    if (e.kind === "chest" && chestTargets) { const b = boxOf(e); if (b) targets.push({ id: e.id, kind: e.kind, rect: expand(b, e.range ?? 0) }); }
  }
  const gate = config.entities.find((e) => e.kind === "goal" && e.id === config.objective.gate);
  if (gate) { const b = boxOf(gate); if (b) targets.push({ id: gate.id, kind: "goal", rect: b }); }

  const pBox = (x, y) => ({ x: x - pSize.w / 2, y: y - pSize.h, w: pSize.w, h: pSize.h });
  const overlaps = (a, b) => a !== null && b !== null && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const covered = targets.map(() => false);
  const coverAt = (x, y) => { const pb = pBox(x, y); for (const [i, t] of targets.entries()) if (!covered[i] && overlaps(pb, t.rect)) covered[i] = true; };

  const foot = { x: config.player.at.x + (0.5 - pAnchor.x) * pSize.w, y: config.player.at.y + (1 - pAnchor.y) * pSize.h };
  const seen = new Uint8Array((W + 1) * stride), queue = [];
  const seedAt = (x, y) => { const i = x * stride + y; if (seen[i]) return; seen[i] = 1; queue.push({ x, y }); coverAt(x, y); };
  for (let x = Math.max(0, Math.round(foot.x - pSize.w)); x <= Math.min(W, Math.round(foot.x + pSize.w)); x++)
    for (const y of cols[x]) if (y >= foot.y - pSize.h) seedAt(x, y);
  const gaps = [];
  if (queue.length === 0) gaps.push("spawn-no-foothold");
  coverAt(Math.round(foot.x), Math.round(foot.y));

  const apex = maxJumpHeight(move), maxDx = Math.ceil(jumpSpan(move, H));
  const hop = (ax, ay, bx, by) => {
    const dh = ay - by; if (dh > apex || dh < -H) return false;
    const disc = move.jumpVelocity ** 2 - 2 * move.gravity * dh; if (disc < 0) return false;
    const t = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity;
    if (Math.abs(bx - ax) > move.speed * t) return false;
    const n = Math.max(6, Math.min(120, Math.ceil(t * 60)));
    for (let i = 0; i <= n; i++) {
      const f = i / n, tt = t * f;
      const x = Math.round(ax + (bx - ax) * f), y = Math.round(ay - (move.jumpVelocity * tt - (move.gravity * tt * tt) / 2));
      if (y < 0 || y > H || x < 0 || x > W) continue;
      if (blocked[x * stride + y] === 1) return false;
      coverAt(x, y);
    }
    return true;
  };
  const fallArc = (ax, ay, bx, by) => {
    const dy = by - ay; if (dy <= 0) return false;
    const t = Math.sqrt((2 * dy) / move.gravity);
    if (Math.abs(bx - ax) > move.speed * t) return false;
    const n = Math.max(4, Math.min(120, Math.ceil(t * 60)));
    for (let i = 0; i <= n; i++) {
      const f = i / n, tt = t * f;
      const x = Math.round(ax + (bx - ax) * f), y = Math.round(ay + (move.gravity * tt * tt) / 2);
      if (y < 0 || y > H || x < 0 || x > W) continue;
      if (blocked[x * stride + y] === 1) return false;
      coverAt(x, y);
    }
    return true;
  };
  for (let head = 0; head < queue.length; head++) {
    const { x: ax, y: ay } = queue[head];
    if (walk) for (const bx of [ax - 1, ax + 1]) {
      if (bx < 0 || bx > W || !(blocked[bx * stride + ay] === 0 && ay + 1 <= H && blocked[bx * stride + ay + 1] === 1)) continue;
      const i = bx * stride + ay; if (seen[i]) continue; seen[i] = 1; queue.push({ x: bx, y: ay }); coverAt(bx, ay);
    }
    for (let dx = -maxDx; dx <= maxDx; dx++) {
      const bx = ax + dx; if (bx < 0 || bx > W) continue;
      for (const by of cols[bx]) {
        const i = bx * stride + by; if (seen[i]) continue;
        if (hop(ax, ay, bx, by) || (fall && by > ay && fallArc(ax, ay, bx, by))) { seen[i] = 1; queue.push({ x: bx, y: by }); coverAt(bx, by); }
      }
    }
  }
  const errors = [];
  for (const [i, t] of targets.entries()) if (!covered[i]) errors.push({ id: t.id, kind: t.kind });
  return { errors, gaps, targets: targets.length };
}

function spawnMetrics(config, manifest) {
  const pa = assetOf(manifest, config.player.asset);
  if (!pa) return { boxDepth: 0, footDepth: 0, anchorOffset: 0, burial: 0, footInside: false, lateralOnly: false };
  const pb = entityBox(config.player.at, pa.size, pa.anchor);
  const foot = { x: pb.x + pb.w / 2, y: pb.y + pb.h };
  const anchorOffset = (1 - pa.anchor.y) * pa.size.h;
  let boxDepth = 0, footDepth = 0, footInside = false, lateralOnly = false;
  for (const t of config.terrain) {
    if (Math.min(pb.x + pb.w, t.x + t.w) - Math.max(pb.x, t.x) <= 0) continue;
    const pen = Math.min(pb.y + pb.h, t.y + t.h) - Math.max(pb.y, t.y);
    if (pen > boxDepth) boxDepth = pen;
    const inX = foot.x > t.x && foot.x < t.x + t.w;
    const inY = foot.y > t.y && foot.y < t.y + t.h;
    if (inX && inY) { footInside = true; footDepth = Math.max(footDepth, foot.y - t.y); }
    else if (pen > 0) lateralOnly = true;
  }
  return { boxDepth, footDepth, anchorOffset, burial: footDepth - anchorOffset, footInside, lateralOnly };
}

const unique = new Map();
for (const c of configs) unique.set(c.hash, c);

const result = { totalConfigs: configs.length, uniqueConfigs: unique.size, paired: 0, unpaired: [], spawnEmbed: {}, embedded: {}, chestErrors: {}, diffs: {}, gaps: {}, features: {} };
const feat = { movingSolids: 0, bodyIgnored: 0, chests: 0, targets: 0 };
const details = { newErrors: [], fixedErrors: [], spawn: [], embedded: [], noSeed: [], chest: [] };

for (const c of unique.values()) {
  const parsed = parseGameConfig(c.raw); if (!parsed.ok) continue;
  const config = parsed.value;
  const ids = refsOf(config);
  let manifest = candidatesFor(c.file).find((m) => covers(m.value, ids));
  if (!manifest) manifest = manifests.filter((m) => covers(m.value, ids)).sort((a, b) => common(b.file, c.file) - common(a.file, c.file))[0];
  if (!manifest) { result.unpaired.push(path.relative(ROOT, c.file)); continue; }
  result.paired++;
  const m = manifest.value;
  const cur = auditReachability(config, m).map((i) => i.where);
  const next = spatial(config, m).errors.map((e) => `entity "${e.id}"`);
  const newErr = next.filter((x) => !cur.includes(x));
  const fixed = cur.filter((x) => !next.includes(x));
  result.diffs[path.relative(ROOT, c.file)] = { current: cur.length, next: next.length, new: newErr, fixed };
  if (newErr.length) details.newErrors.push({ file: path.relative(ROOT, c.file), newErr });
  if (fixed.length) details.fixedErrors.push({ file: path.relative(ROOT, c.file), fixed });

  const sm = spawnMetrics(config, m);
  if (sm.boxDepth > 0) result.spawnEmbed.boxOverlap = (result.spawnEmbed.boxOverlap ?? 0) + 1;
  if (sm.footInside) result.spawnEmbed.footInside = (result.spawnEmbed.footInside ?? 0) + 1;
  if (sm.burial > 1) result.spawnEmbed.burialGt1 = (result.spawnEmbed.burialGt1 ?? 0) + 1;
  if (sm.boxDepth > 0) details.spawn.push({ file: path.relative(ROOT, c.file), ...sm });

  const sp = spatial(config, m);
  if (sp.gaps.includes("spawn-no-foothold")) { result.gaps.noFoothold = (result.gaps.noFoothold ?? 0) + 1; details.noSeed.push(path.relative(ROOT, c.file)); }

  feat.chests += config.entities.filter((e) => e.kind === "chest").length;
  feat.movingSolids += config.entities.filter((e) => e.kind === "solid" && e.motion).length;
  feat.bodyIgnored += config.entities.filter((e) => ["pickup", "hazard", "goal"].includes(e.kind) && e.body !== undefined).length;
  feat.targets += sp.targets;
  const chestErr = sp.errors.filter((e) => e.kind === "chest" && !cur.some((w) => w === `entity "${e.id}"`));
  if (chestErr.length) { result.chestErrors[path.relative(ROOT, c.file)] = chestErr.map((e) => e.id); details.chest.push({ file: path.relative(ROOT, c.file), ids: chestErr.map((e) => e.id) }); }
}
result.features = feat;
console.log(JSON.stringify({ result, details }, null, 2));
