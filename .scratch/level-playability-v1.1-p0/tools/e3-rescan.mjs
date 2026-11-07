#!/usr/bin/env node
// P0-03a：P0-01 E3 语料扫描的**可重复只读**版本（P0-01R 裁定要求）。
//
//   node .scratch/level-playability-v1.1-p0/tools/e3-rescan.mjs [--out <json>] [--json]
//
// 扫描范围：`.scratch/level-playability-v1/corpus/inventory.json` 中
//   parseOk ∧ format=game-config/v1 ∧ 按 contentHash 去重的横向 config。
// 只读：不写任何被扫描文件；--out 只写本 effort 的证据 JSON。
// 复算 P0-01 §0.2 命令 5/6/7 的数字，并在不一致时要求解释（不静默覆盖旧报告）。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_VERSION = "p0-03a-e3-rescan/1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EFFORT = path.resolve(HERE, "..");
const ROOT = path.resolve(EFFORT, "../..");
const INVENTORY = path.join(ROOT, ".scratch/level-playability-v1/corpus/inventory.json");
const OUT = (() => {
  const i = process.argv.indexOf("--out");
  return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null;
})();
const JSON_OUT = process.argv.includes("--json");

const sha256 = (buf) => `sha256:${crypto.createHash("sha256").update(buf).digest("hex")}`;
const fileSha = (p) => sha256(fs.readFileSync(p));
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

function framesOf(atlas) {
  if (Array.isArray(atlas.frames)) return atlas.frames;
  if (atlas.frames && typeof atlas.frames === "object")
    return Object.entries(atlas.frames).map(([name, v]) => ({ name, ...v }));
  return [];
}

function scanCorpus() {
  const inv = readJson(INVENTORY);
  const unique = new Map();
  let skipped = { notParseOk: 0, notHorizontal: 0, unreadable: 0 };
  for (const entry of inv.configs) {
    if (!entry.parseOk) { skipped.notParseOk += 1; continue; }
    let cfg;
    try { cfg = readJson(path.join(ROOT, entry.path)); } catch { skipped.unreadable += 1; continue; }
    if (cfg.format !== "game-config/v1") { skipped.notHorizontal += 1; continue; }
    if (!unique.has(entry.contentHash)) unique.set(entry.contentHash, { entry, cfg });
  }

  const hazards = [];
  const hazardsByKind = {};
  const anchors = {};
  const motionAxes = {};
  for (const { entry, cfg } of unique.values()) {
    for (const e of cfg.entities ?? []) {
      if (e.kind !== "hazard") continue;
      const m = e.motion;
      const speed = m && m.distance > 0 && m.periodMs > 0 ? (2 * m.distance) / m.periodMs : null;
      hazards.push({
        config: entry.path, configContentHash: entry.contentHash, id: e.id, asset: e.asset,
        hasMotion: !!m, hasBody: !!e.body, hasAnim: !!e.anim,
        motion: m ? { kind: m.kind, axis: m.axis, distance: m.distance, periodMs: m.periodMs } : null,
        speedPxPerMs: speed,
        manifest: entry.auditManifest ?? null,
      });
      hazardsByKind[e.kind] = (hazardsByKind[e.kind] ?? 0) + 1;
      if (m) {
        motionAxes[m.axis] = (motionAxes[m.axis] ?? 0) + 1;
        const key = `${m.kind}/${m.axis}`;
        anchors[key] = anchors[key] ?? {};
      }
    }
  }

  // 移动 hazard 资源 → 图集帧 vs manifest（与 P0-01 同口径：每个唯一 config 的每个移动 hazard 解析一次）
  const assetRows = [];
  const anchorDist = {};
  let framesChecked = 0, badSize = 0, badAnchor = 0, missingAtlas = 0, missingFrame = 0, missingAsset = 0;
  const issues = [];
  const manifestCache = new Map();
  for (const h of hazards) {
    if (!h.hasMotion) continue;
    if (!h.manifest) { missingAsset += 1; issues.push({ config: h.config, id: h.id, asset: h.asset, reason: "no-audit-manifest" }); continue; }
    const mp = path.join(ROOT, h.manifest);
    if (!manifestCache.has(mp)) manifestCache.set(mp, readJson(mp));
    const manifest = manifestCache.get(mp);
    const asset = (manifest.assets ?? []).find((a) => a.id === h.asset);
    if (!asset) { missingAsset += 1; issues.push({ config: h.config, id: h.id, asset: h.asset, reason: "asset-not-in-manifest", manifest: h.manifest }); continue; }
    const anchorKey = `${asset.anchor?.x},${asset.anchor?.y}`;
    anchorDist[anchorKey] = (anchorDist[anchorKey] ?? 0) + 1;
    const atlasPath = path.join(path.dirname(mp), "delivery", `atlas.${asset.atlasId}.json`);
    let frames = 0;
    if (!fs.existsSync(atlasPath)) {
      missingAtlas += 1;
      issues.push({ config: h.config, id: h.id, asset: h.asset, reason: "missing-atlas", atlas: rel(atlasPath) });
    } else {
      const atlas = readJson(atlasPath);
      const afs = framesOf(atlas);
      for (const f of asset.frames ?? []) {
        const af = afs.find((x) => x.name === f.name);
        if (!af) { missingFrame += 1; issues.push({ config: h.config, id: h.id, asset: h.asset, frame: f.name, reason: "missing-frame" }); continue; }
        frames += 1; framesChecked += 1;
        if (af.sourceSize?.w !== asset.size?.w || af.sourceSize?.h !== asset.size?.h) {
          badSize += 1;
          issues.push({ config: h.config, id: h.id, asset: h.asset, frame: f.name, reason: "bad-size", frameSize: af.sourceSize, manifestSize: asset.size });
        }
        if (Math.abs(af.anchor?.x - asset.anchor?.x) > 1e-9 || Math.abs(af.anchor?.y - asset.anchor?.y) > 1e-9) {
          badAnchor += 1;
          issues.push({ config: h.config, id: h.id, asset: h.asset, frame: f.name, reason: "bad-anchor", frameAnchor: af.anchor, manifestAnchor: asset.anchor });
        }
      }
    }
    assetRows.push({
      config: h.config, id: h.id, asset: h.asset, manifest: h.manifest,
      manifestSha256: fileSha(mp), atlas: fs.existsSync(atlasPath) ? rel(atlasPath) : null,
      atlasSha256: fs.existsSync(atlasPath) ? fileSha(atlasPath) : null,
      frames,
    });
  }

  const speeds = hazards.filter((h) => h.speedPxPerMs !== null).map((h) => h.speedPxPerMs);
  const round = (x) => Math.round(x * 100000) / 100000;
  return {
    scope: {
      inventory: rel(INVENTORY), inventorySha256: fileSha(INVENTORY),
      inventoryBaseline: inv.baseline, inventoryGeneratedAt: inv.generatedAt,
      roots: inv.roots,
      filter: "parseOk ∧ format=game-config/v1 ∧ unique by contentHash",
      skipped,
    },
    results: {
      configs: unique.size,
      hazards: hazards.length,
      withMotion: hazards.filter((h) => h.hasMotion).length,
      withBody: hazards.filter((h) => h.hasBody).length,
      anims: hazards.filter((h) => h.hasAnim).length,
      movingHazardAssets: assetRows.length,
      framesChecked, badSize, badAnchor, missingAtlas, missingFrame, missingAsset,
      speedMin: speeds.length ? round(Math.min(...speeds)) : null,
      speedMax: speeds.length ? round(Math.max(...speeds)) : null,
      motionAxes,
      anchorsByMotion: anchorDist,
      hazardsByKind,
    },
    assets: assetRows,
    issues,
  };
}

function caseHitboxProvenance() {
  const out = [];
  for (const c of ["a", "b"]) {
    const configPath = path.join(EFFORT, "cases", c, "game-config.json");
    if (!fs.existsSync(configPath)) continue;
    const cfg = readJson(configPath);
    const siteOut = path.join(EFFORT, "cases", c, "site-out");
    const gameDir = fs.existsSync(siteOut) ? fs.readdirSync(siteOut).find((d) => d.startsWith("p0-03a-case-")) : null;
    const packDir = gameDir ? path.join(siteOut, gameDir, "pack", "v2") : null;
    const manifestPath = packDir ? path.join(packDir, "manifest.json") : null;
    const manifest = manifestPath && fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
    for (const e of cfg.entities ?? []) {
      if (e.kind !== "hazard" || !e.motion) continue;
      const row = {
        case: c, hazardId: e.id, asset: e.asset, motion: e.motion,
        config: rel(configPath), configSha256: fileSha(configPath),
        siteDir: null, packManifest: null, packManifestSha256: null,
        size: null, anchor: null, atlas: null, atlasSha256: null,
        frames: [], framesMatchManifest: null, issues: [],
      };
      if (!manifest) { row.issues.push("site-out 或复制包不存在：先运行 tools/build-cases.mjs"); out.push(row); continue; }
      const siteDir = path.join(siteOut, gameDir, "site", "v1");
      row.siteDir = rel(siteDir);
      row.packManifest = rel(manifestPath);
      row.packManifestSha256 = fileSha(manifestPath);
      const asset = (manifest.assets ?? []).find((a) => a.id === e.asset);
      if (!asset) { row.issues.push("asset-not-in-copied-pack-manifest"); out.push(row); continue; }
      row.size = asset.size; row.anchor = asset.anchor;
      const atlasPath = path.join(packDir, "delivery", `atlas.${asset.atlasId}.json`);
      if (!fs.existsSync(atlasPath)) { row.issues.push("missing-atlas"); out.push(row); continue; }
      row.atlas = rel(atlasPath); row.atlasSha256 = fileSha(atlasPath);
      const afs = framesOf(readJson(atlasPath));
      for (const f of asset.frames ?? []) {
        const af = afs.find((x) => x.name === f.name);
        if (!af) { row.issues.push(`missing-frame:${f.name}`); continue; }
        const sizeOk = af.sourceSize?.w === asset.size?.w && af.sourceSize?.h === asset.size?.h;
        const anchorOk = Math.abs(af.anchor?.x - asset.anchor?.x) <= 1e-9 && Math.abs(af.anchor?.y - asset.anchor?.y) <= 1e-9;
        row.frames.push({ name: f.name, sourceSize: af.sourceSize, anchor: af.anchor, sizeOk, anchorOk });
        if (!sizeOk || !anchorOk) row.issues.push(`frame-mismatch:${f.name}`);
      }
      row.framesMatchManifest = row.frames.length > 0 && row.frames.every((f) => f.sizeOk && f.anchorOk);
      out.push(row);
    }
  }
  return out;
}

const corpus = scanCorpus();
const cases = caseHitboxProvenance();
const expected = {
  configs: 21, hazards: 31, withMotion: 19, withBody: 0, anims: 18,
  movingHazardAssets: 19, framesChecked: 121, badSize: 0, badAnchor: 0,
  missingAtlas: 0, missingFrame: 0, speedMin: 0.02667, speedMax: 0.13846,
  source: "evidence/01-moving-hazard-semantics.md §0.2 命令 5/6/7",
};
const observed = corpus.results;
const keys = Object.keys(expected).filter((k) => k !== "source");
const discrepancies = keys.filter((k) => observed[k] !== expected[k]).map((k) => ({
  key: k, expected: expected[k], observed: observed[k],
  explanation: "必须在此解释差异；不得静默覆盖 P0-01 报告",
}));

const report = {
  script: "tools/e3-rescan.mjs",
  scriptVersion: SCRIPT_VERSION,
  at: new Date().toISOString(),
  command: "node .scratch/level-playability-v1.1-p0/tools/e3-rescan.mjs --out .scratch/level-playability-v1.1-p0/evidence/03a-e3-rescan.json --json",
  node: process.version,
  repoHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
  readOnly: true,
  corpus,
  caseHitboxProvenance: cases,
  comparison: { expected, observed, discrepancies, matches: discrepancies.length === 0 },
};
const serialized = JSON.stringify(report, null, 2) + "\n";
if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, serialized); }
if (JSON_OUT || !OUT) process.stdout.write(serialized);
else console.log(`wrote ${rel(OUT)} · matches=${report.comparison.matches} · discrepancies=${discrepancies.length}`);
if (discrepancies.length || cases.some((c) => c.issues.length || c.framesMatchManifest === false)) process.exitCode = 1;
