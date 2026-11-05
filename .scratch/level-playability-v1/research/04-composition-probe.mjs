// 04 机制组合候选判据的只读语料探针（E3）。不写生产代码、不调上游、不改盘上产物。
// 运行：node .scratch/level-playability-v1/research/04-composition-probe.mjs
// 输出：stdout 的 JSON 摘要（不落盘）。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  auditReachability, parseAssetPack, parseGameConfig, entityBox, playerMoveOf,
} from "../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SKIP = new Set(["node_modules", ".git", "dist", ".vite", "coverage"]);
const JSON_DIRS = ["out", "fixtures", ".scratch", "packages/demo/fixtures"];

function walk(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const d of ents) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) { if (!SKIP.has(d.name)) walk(p, out); }
    else if (d.isFile() && d.name.endsWith(".json")) out.push(p);
  }
}
const sha = (s) => "sha256:" + crypto.createHash("sha256").update(s).digest("hex");
const files = [];
for (const d of JSON_DIRS) walk(path.join(ROOT, d), files);

const configs = [], manifests = [];
for (const f of files) {
  let raw; try { raw = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
  if (raw === null || typeof raw !== "object") continue;
  if (raw.format === "game-config/v1") configs.push({ file: f, raw, hash: sha(JSON.stringify(raw)) });
  if (raw.format === "assetpack/v1" || (Array.isArray(raw.assets) && raw.id !== undefined && raw.version !== undefined && raw.files !== undefined))
    manifests.push({ file: f, value: { ...raw, assets: raw.assets.filter((a) => a && typeof a === "object" && typeof a.id === "string") } });
}
const refsOf = (c) => {
  const ids = new Set([c.player.asset, c.scene.background.asset, c.hud.panel.asset, c.hud.pip.asset]);
  for (const e of c.entities) ids.add(e.asset);
  return ids;
};
const covers = (m, ids) => { const h = new Set(m.assets.map((a) => a.id)); for (const id of ids) if (!h.has(id)) return false; return true; };
const versionOf = (p) => { const m = /\/v(\d+)\/manifest\.json$/.exec(p.split(path.sep).join("/")); return m ? Number(m[1]) : 0; };
function candidatesFor(file) {
  const dirs = []; let d = path.dirname(file);
  for (let i = 0; i < 4; i++) { dirs.push(d); d = path.dirname(d); }
  const packing = [];
  for (const root of dirs) {
    const packRoot = path.join(root, "pack");
    let vs = []; try { vs = fs.readdirSync(packRoot); } catch {}
    for (const v of vs) { const mp = path.join(packRoot, v, "manifest.json"); if (fs.existsSync(mp)) { const hit = manifests.find((x) => x.file === mp); if (hit) packing.push(hit); } }
    for (const rel of ["manifest.json", "pack/manifest.json"]) { const mp = path.join(root, rel); const hit = manifests.find((x) => x.file === mp); if (hit) packing.push(hit); }
  }
  return packing.sort((a, b) => versionOf(b.file) - versionOf(a.file));
}
const commonPrefix = (a, b) => { const aa = a.split(path.sep), bb = b.split(path.sep); let i = 0; while (i < aa.length && i < bb.length && aa[i] === bb[i]) i++; return i; };

const unique = new Map();
for (const c of configs) unique.set(c.hash, c);

const sizeOf = (m, id) => m.assets.find((a) => a.id === id)?.size ?? null;
const anchorOf = (m, id) => m.assets.find((a) => a.id === id)?.anchor ?? { x: 0.5, y: 1 };

const out = { uniqueConfigs: unique.size, paired: 0, unpaired: [], stats: {}, details: [] };
const bump = (k, n = 1) => { out.stats[k] = (out.stats[k] ?? 0) + n; };

for (const c of unique.values()) {
  const p = parseGameConfig(c.raw);
  if (!p.ok) continue;
  const cfg = p.value;
  const ids = refsOf(cfg);
  let man = candidatesFor(c.file).find((m) => covers(m.value, ids));
  if (!man) man = manifests.filter((m) => covers(m.value, ids)).sort((a, b) => commonPrefix(b.file, c.file) - commonPrefix(a.file, c.file))[0];
  if (!man) { out.unpaired.push(path.relative(ROOT, c.file)); continue; }
  out.paired++;
  const m = man.value;
  const pSize = sizeOf(m, cfg.player.asset);
  const pAnchor = anchorOf(m, cfg.player.asset);
  if (!pSize) continue;

  const boxOf = (e) => {
    const s = e.body ?? sizeOf(m, e.asset); if (!s) return null;
    return entityBox(e.at, s, anchorOf(m, e.asset));
  };
  const inter = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const contains = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

  const hazards = cfg.entities.filter((e) => e.kind === "hazard");
  const dangers = cfg.entities.filter((e) => e.kind === "danger");
  const pickups = cfg.entities.filter((e) => e.kind === "pickup");
  const chests = cfg.entities.filter((e) => e.kind === "chest");
  if (hazards.length) bump("configsWithHazard");
  if (dangers.length) bump("configsWithDanger");
  for (const h of hazards) {
    bump("hazardEntities");
    if (h.motion) bump("hazardWithMotion"); else bump("hazardStatic");
    if (h.body) bump("hazardWithBodyOverride");
  }
  for (const d of dangers) {
    bump("dangerEntities");
    if (!d.strike) bump("dangerMissingStrike");
    if (d.body) bump("dangerWithBodyOverride");
  }
  // 目标与危险物/危险区的几何关系（原始盒子；不是运行时 overlap 的完整模型）
  for (const t of [...pickups, ...chests]) {
    const tb = boxOf(t); if (!tb) continue;
    for (const h of hazards) { const hb = boxOf(h); if (hb && inter(tb, hb)) { bump("targetIntersectsHazard"); if (contains(hb, tb)) bump("targetContainedInHazard"); } }
    for (const d of dangers) { const db = boxOf(d); if (db && inter(tb, db)) { bump("targetIntersectsDanger"); if (contains(db, tb)) bump("targetContainedInDanger"); } }
  }

  // 静态 hazard 当 solid：看是否新增 reachability error（只对无 motion 的 hazard）
  const staticHazards = hazards.filter((h) => !h.motion);
  let hazardBlocked = null;
  if (staticHazards.length) {
    const base = auditReachability(cfg, m).map((i) => i.where);
    const clone = JSON.parse(JSON.stringify(cfg));
    for (const e of clone.entities) if (e.kind === "hazard" && !e.motion) { e.kind = "solid"; delete e.motion; }
    const withHaz = auditReachability(clone, m).map((i) => i.where);
    const added = withHaz.filter((w) => !base.includes(w));
    if (added.length) { bump("configsStaticHazardAddsReachError"); hazardBlocked = { file: path.relative(ROOT, c.file), base, withHaz, added }; }
  }

  // danger 的「整列切面 + 穿越时长 > idle 窗口」退化判据（只做几何估算，不落地判据）
  const mv = playerMoveOf(cfg);
  const fullCutDanger = [];
  for (const d of dangers) {
    const db = boxOf(d); if (!db || !d.strike) continue;
    // 列切面：danger 盒子的 x 区间必须从 y=0 覆盖到世界底（保守近似）
    if (db.y > 0 || db.y + db.h < cfg.world.size.h) continue;
    const requiredMs = ((db.w + pSize.w) / mv.speed) * 1000;
    if (requiredMs > d.strike.periodMs) fullCutDanger.push({ id: d.id, box: db, requiredMs: Math.round(requiredMs), idleMs: d.strike.periodMs });
  }
  if (fullCutDanger.length) bump("configsFullCutDangerNoWindow");

  const baseErr = auditReachability(cfg, m).length;
  const interesting = hazards.length || dangers.length;
  if (interesting) out.details.push({
    file: path.relative(ROOT, c.file),
    hazards: hazards.map((h) => ({ id: h.id, at: h.at, motion: h.motion ?? null, body: h.body ?? null, box: boxOf(h) })),
    dangers: dangers.map((d) => ({ id: d.id, at: d.at, body: d.body ?? null, box: boxOf(d), strike: d.strike ?? null })),
    baseReachErrors: baseErr,
    staticHazardAdded: hazardBlocked?.added ?? [],
    fullCutDangerNoWindow: fullCutDanger,
    pickups: pickups.length, chests: chests.length,
  });
}
console.log(JSON.stringify(out, null, 2));
