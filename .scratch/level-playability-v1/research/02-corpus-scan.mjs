// 02 能力审计的一次性只读语料扫描（E3）。不写生产代码、不调上游。
// 运行：node .scratch/level-playability-v1/research/02-corpus-scan.mjs
// 输出：stdout 的 JSON 摘要（本脚本不落盘任何产物）。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  auditGameConfig, auditReachability, auditLayerCoverage, backgroundLayerEntries,
  auditScreenSpace, gameHudScreenItems, auditEntityIdentity,
  parseAssetPack, parseGameConfig,
} from "../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const EXCLUDE_FIXTURES = path.join(ROOT, ".scratch/level-playability-v1/fixtures/07-matrix");
const SKIP = new Set(["node_modules", ".git", "dist", ".vite", "coverage"]);
const JSON_DIRS = ["out", "fixtures", ".scratch", "packages/demo/fixtures"];
const VIEWPORT = { w: 480, h: 270 };

function walk(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const d of ents) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (SKIP.has(d.name) || p.startsWith(EXCLUDE_FIXTURES)) continue;
      walk(p, out);
    } else if (d.isFile() && d.name.endsWith(".json")) {
      out.push(p);
    }
  }
}

const files = [];
for (const d of JSON_DIRS) walk(path.join(ROOT, d), files);

const sha = (s) => "sha256:" + crypto.createHash("sha256").update(s).digest("hex");
const configs = [];
const manifests = [];
let jsonParsed = 0;
for (const f of files) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
  if (raw === null || typeof raw !== "object") continue;
  jsonParsed++;
  if (raw.format === "game-config/v1") configs.push({ file: f, raw, hash: sha(JSON.stringify(raw)) });
  if (raw.format === "assetpack/v1" || (Array.isArray(raw.assets) && raw.id !== undefined && raw.version !== undefined && raw.files !== undefined)) {
    // ⚠️ 历史包多为 assetpack/v1·v2，当前 parseAssetPack 只收 v4；审计只需要 assets 的
    // id/kind/size/anchor/animations 结构，所以这里做**只读归一化**（不改盘上文件）。
    const p = parseAssetPack(raw);
    const normalized = {
      ...raw,
      assets: raw.assets.filter((a) => a !== null && typeof a === "object" && typeof a.id === "string"),
    };
    if (Array.isArray(normalized.assets)) manifests.push({ file: f, value: normalized, raw, parsedOk: p.ok });
  }
}

const refsOf = (c) => {
  const ids = new Set([c.player.asset, c.scene.background.asset, c.hud.panel.asset, c.hud.pip.asset]);
  for (const e of c.entities) ids.add(e.asset);
  return ids;
};
const manifestCovers = (m, ids) => {
  const have = new Set(m.assets.map((a) => a.id));
  for (const id of ids) if (!have.has(id)) return false;
  return true;
};
const versionOfFile = (p) => {
  const m = /\/v(\d+)\/manifest\.json$/.exec(p.split(path.sep).join("/"));
  return m ? Number(m[1]) : 0;
};

/** 最近的 pack：从 config 目录向上找 <root>/pack/<v>/manifest.json（版本高者优先）。 */
function candidatesFor(file) {
  const dirs = [];
  let d = path.dirname(file);
  for (let i = 0; i < 4; i++) { dirs.push(d); d = path.dirname(d); }
  const packing = [];
  for (const root of dirs) {
    const packRoot = path.join(root, "pack");
    let vs = [];
    try { vs = fs.readdirSync(packRoot); } catch {}
    for (const v of vs) {
      const mp = path.join(packRoot, v, "manifest.json");
      if (fs.existsSync(mp)) {
        const hit = manifests.find((x) => x.file === mp);
        if (hit) packing.push(hit);
      }
    }
    for (const rel of ["manifest.json", "pack/manifest.json"]) {
      const mp = path.join(root, rel);
      const hit = manifests.find((x) => x.file === mp);
      if (hit) packing.push(hit);
    }
  }
  return packing.sort((a, b) => versionOfFile(b.file) - versionOfFile(a.file));
}

const unique = new Map();
for (const c of configs) unique.set(c.hash, c);

const stats = {
  scannedJsonFiles: files.length,
  parsedJsonObjects: jsonParsed,
  configFiles: configs.length,
  uniqueConfigs: unique.size,
  manifestFiles: manifests.length,
  manifestsParsedByCurrentSchema: manifests.filter((m) => m.parsedOk).length,
  manifestsNormalizedFromOlderSchema: manifests.filter((m) => !m.parsedOk).length,
  manifestFormats: manifests.reduce((acc, m) => {
    const f = String(m.raw.format ?? "(none)");
    acc[f] = (acc[f] ?? 0) + 1;
    return acc;
  }, {}),
  parseFailConfigs: [],
  unpaired: [],
  paired: [],
};

const counts = {
  auditGameConfig: { error: 0, warning: 0 },
  reachability: { error: 0, warning: 0 },
  layerCoverage: { error: 0, warning: 0 },
  screenSpace: { error: 0, warning: 0 },
  entityIdentity: { error: 0, warning: 0 },
};
const issueTexts = new Map();
const feature = {
  configsWithChest: 0,
  chestCount: 0,
  chestAsTargetUnreachable: 0,
  configsWithChestTargetUnreachable: 0,
  configsWithMotionOnNonHazard: 0,
  motionOnNonHazardEntities: 0,
  configsWithMovingSolid: 0,
  movingSolidEntities: 0,
  configsWithBodyOverrideOnRuntimeIgnoredKind: 0,
  bodyOverrideOnRuntimeIgnoredKindEntities: 0,
  configsWithDanger: 0,
  dangerCount: 0,
  configsWithHazardMotion: 0,
  hazardMotionEntities: 0,
  configsWithGoal: 0,
  configsWithNoSolid: 0,
  configsWithNonHazardMotionTravelWarning: 0,
};
const chestProbeDetails = [];
const reachDetails = [];
const pairedKeys = new Set();
const uniqPairedHashes = new Set();
const uniqChestHashes = new Set();

function addIssue(bucket, issue, file) {
  counts[bucket][issue.severity] += 1;
  const key = `${bucket}|${issue.severity}|${issue.where}|${issue.message.slice(0, 80)}`;
  const prev = issueTexts.get(key);
  if (prev === undefined) issueTexts.set(key, { bucket, severity: issue.severity, where: issue.where, message: issue.message.slice(0, 160), count: 0, files: [] });
  const rec = issueTexts.get(key);
  rec.count += 1;
  if (rec.files.length < 5) rec.files.push(path.relative(ROOT, file));
}

for (const c of configs) {
  const parsed = parseGameConfig(c.raw);
  if (!parsed.ok) {
    stats.parseFailConfigs.push({ file: path.relative(ROOT, c.file), errors: parsed.errors.slice(0, 3) });
    continue;
  }
  const config = parsed.value;
  const ids = refsOf(config);
  const candidates = candidatesFor(c.file);
  let manifest = candidates.find((m) => manifestCovers(m.value, ids));
  if (manifest === undefined) {
    // 兜底：全仓找一份覆盖全部引用的包，优先与 config 共享最长路径前缀的那份。
    const common = (a, b) => {
      const aa = a.split(path.sep), bb = b.split(path.sep);
      let i = 0; while (i < aa.length && i < bb.length && aa[i] === bb[i]) i += 1;
      return i;
    };
    const fallback = manifests.filter((m) => manifestCovers(m.value, ids))
      .sort((a, b) => common(b.file, c.file) - common(a.file, c.file))[0];
    manifest = fallback;
  }
  if (manifest === undefined) {
    stats.unpaired.push(path.relative(ROOT, c.file));
    continue;
  }
  const key = c.hash + "|" + manifest.file;
  if (pairedKeys.has(key)) continue;
  pairedKeys.add(key);
  uniqPairedHashes.add(c.hash);
  const m = manifest.value;
  stats.paired.push({ file: path.relative(ROOT, c.file), manifest: path.relative(ROOT, manifest.file) });

  const g = auditGameConfig(config, m);
  for (const i of g) addIssue("auditGameConfig", i, c.file);
  const r = auditReachability(config, m);
  for (const i of r) addIssue("reachability", i, c.file);
  if (r.length > 0) reachDetails.push({ file: path.relative(ROOT, c.file), issues: r.map((i) => ({ where: i.where, message: i.message.slice(0, 120) })) });

  const entries = backgroundLayerEntries(config.scene.background.asset, config.world.size, m.assets);
  for (const i of auditLayerCoverage(VIEWPORT, config.world.size, entries)) addIssue("layerCoverage", i, c.file);
  for (const i of auditScreenSpace(VIEWPORT, gameHudScreenItems(config, m, { lineHeight: 10 }))) addIssue("screenSpace", i, c.file);

  // 身份审计只在能就近找到同一 run 的设计时跑（否则 skip，不制造假缺口）。
  const designCandidates = [
    path.join(path.dirname(c.file), "game-design.json"),
    path.join(path.dirname(c.file), "..", "game-design.json"),
    path.join(path.dirname(c.file), "..", "..", "game-design.json"),
  ];
  for (const dp of designCandidates) {
    if (!fs.existsSync(dp)) continue;
    try {
      const design = JSON.parse(fs.readFileSync(dp, "utf8"));
      if (design.format !== "game-design/v1") continue;
      const levelId = design.levels?.length === 1 ? design.levels[0].id : undefined;
      for (const i of auditEntityIdentity(design, config, levelId)) addIssue("entityIdentity", i, c.file);
    } catch {}
    break;
  }

  const chests = config.entities.filter((e) => e.kind === "chest");
  if (chests.length > 0) { feature.configsWithChest += 1; uniqChestHashes.add(c.hash); }
  feature.chestCount += chests.length;
  if (chests.length > 0) {
    const clone = structuredClone(config);
    for (const ch of chests) {
      clone.entities.push({
        id: `__probe_chest_${ch.id}`,
        kind: "pickup",
        at: ch.at,
        asset: ch.asset,
        ...(ch.anim === undefined ? {} : { anim: ch.anim }),
        ...(ch.body === undefined ? {} : { body: ch.body }),
      });
    }
    const cr = auditReachability(clone, m);
    const missed = cr.filter((i) => i.where.startsWith('entity "__probe_chest_'));
    if (missed.length > 0) {
      feature.configsWithChestTargetUnreachable += 1;
      feature.chestAsTargetUnreachable += missed.length;
      chestProbeDetails.push({ file: path.relative(ROOT, c.file), chests: missed.map((i) => i.where) });
    }
  }

  const hazardsWithMotion = config.entities.filter((e) => e.kind === "hazard" && e.motion);
  if (hazardsWithMotion.length > 0) { feature.configsWithHazardMotion += 1; feature.hazardMotionEntities += hazardsWithMotion.length; }
  const movingSolids = config.entities.filter((e) => e.kind === "solid" && e.motion);
  if (movingSolids.length > 0) { feature.configsWithMovingSolid += 1; feature.movingSolidEntities += movingSolids.length; }
  const motionNonHazard = config.entities.filter((e) => e.kind !== "hazard" && e.motion);
  if (motionNonHazard.length > 0) { feature.configsWithMotionOnNonHazard += 1; feature.motionOnNonHazardEntities += motionNonHazard.length; }
  const bodyIgnored = config.entities.filter((e) => ["pickup", "hazard", "goal"].includes(e.kind) && e.body !== undefined);
  if (bodyIgnored.length > 0) { feature.configsWithBodyOverrideOnRuntimeIgnoredKind += 1; feature.bodyOverrideOnRuntimeIgnoredKindEntities += bodyIgnored.length; }
  const dangers = config.entities.filter((e) => e.kind === "danger");
  if (dangers.length > 0) { feature.configsWithDanger += 1; feature.dangerCount += dangers.length; }
  if (config.entities.some((e) => e.kind === "goal")) feature.configsWithGoal += 1;
  if (config.entities.every((e) => e.kind !== "solid")) feature.configsWithNoSolid += 1;
  if (g.some((i) => i.severity === "warning" && i.message.includes("周期运动的行程"))) feature.configsWithNonHazardMotionTravelWarning += 1;
}

feature.uniquePairedConfigs = uniqPairedHashes.size;
feature.uniqueConfigsWithChest = uniqChestHashes.size;
const top = [...issueTexts.values()].sort((a, b) => b.count - a.count).slice(0, 40);
console.log(JSON.stringify({
  root: ROOT,
  stats: { ...stats, paired: stats.paired.length, unpaired: stats.unpaired.length, parseFailConfigs: stats.parseFailConfigs.length },
  counts,
  feature,
  topIssues: top,
  reachDetails: reachDetails.slice(0, 30),
  chestProbeDetails: chestProbeDetails.slice(0, 30),
  unpairedSample: stats.unpaired.slice(0, 30),
  parseFailSample: stats.parseFailConfigs.slice(0, 10),
}, null, 2));
