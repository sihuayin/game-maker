// LP-06：冻结历史语料全量回归（只读；零付费）。
// 运行：pnpm build && node .scratch/level-playability-v1-p1/acceptance-corpus.mjs
// 产出：.scratch/level-playability-v1-p1/evidence/06-corpus-regression.json
//
// 口径：06 inventory 的 usableForRejudgment 条目，按 (config contentHash, auditManifest path)
// 去重为 **96 唯一配对**；同一 (config contentHash, manifest contentHash) 只算一次。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { auditGameConfig, parseGameConfig } from "../../packages/contracts/dist/index.js";
import { auditSpatial } from "../../packages/contracts/dist/playability/spatial.js";
import { auditMechanic } from "../../packages/contracts/dist/playability/mechanic.js";
import { auditCompletion } from "../../packages/contracts/dist/playability/completion.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const HERE = import.meta.dirname;
const INV_PATH = path.join(ROOT, ".scratch/level-playability-v1/corpus/inventory.json");
const OUT = path.join(HERE, "evidence/06-corpus-regression.json");
const inv = JSON.parse(fs.readFileSync(INV_PATH, "utf8"));

const freeze = inv.freeze?.value;
const recompute = "sha256:" + crypto.createHash("sha256")
  .update(Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(inv).filter(([k]) => k !== "freeze")))))
  .digest("hex");
if (freeze !== recompute) throw new Error(`inventory freeze mismatch: ${freeze} != ${recompute}`);

const normalizeManifest = (raw) => ({
  ...raw,
  assets: Array.isArray(raw.assets)
    ? raw.assets.filter((a) => a !== null && typeof a === "object" && typeof a.id === "string")
    : [],
});
const sha = (v) => "sha256:" + crypto.createHash("sha256").update(Buffer.from(JSON.stringify(v))).digest("hex");
const manByPath = new Map(inv.manifests.map((m) => [m.path, m]));
const usable = inv.configs.filter((c) => c.usableForRejudgment && c.parseOk);

// 96 唯一配对：contentHash + auditManifest 路径
const pairs = new Map();
for (const c of usable) {
  const key = `${c.contentHash}|${c.auditManifest}`;
  if (!pairs.has(key)) pairs.set(key, c);
}
const uniqueConfigs = new Map();
for (const c of usable) if (!uniqueConfigs.has(c.contentHash)) uniqueConfigs.set(c.contentHash, c);

// 同一 (config contentHash, manifest contentHash) 只跑一次
const cache = new Map();
function runPair(entry) {
  const configRaw = JSON.parse(fs.readFileSync(path.join(ROOT, entry.path), "utf8"));
  const parsed = parseGameConfig(configRaw);
  if (!parsed.ok) return { error: "config-parse-failed" };
  const manifestRaw = JSON.parse(fs.readFileSync(path.join(ROOT, entry.auditManifest), "utf8"));
  const manifestHash = sha(manifestRaw);
  const key = `${entry.contentHash}|${manifestHash}`;
  if (cache.has(key)) return cache.get(key);

  const manifest = normalizeManifest(manifestRaw);
  const config = parsed.value;
  const existing = auditGameConfig(config, manifest).filter((i) => i.severity === "error");
  const spatial = auditSpatial(config, manifest);
  const mechanic = auditMechanic(config, manifest);
  const completion = auditCompletion(config, manifest, undefined, { spatial, mechanic });
  const layers = { spatial, mechanic, completion };
  const global = [spatial, mechanic, completion].some((l) => l.verdict === "PROVEN_UNPLAYABLE")
    ? "PROVEN_UNPLAYABLE"
    : [spatial, mechanic, completion].some((l) => l.verdict === "INSUFFICIENT_EVIDENCE")
      ? "INSUFFICIENT_EVIDENCE"
      : "NO_PROVEN_BLOCKER";
  const final = existing.length > 0 ? "PROVEN_UNPLAYABLE" : global;
  const blockers = [];
  for (const [layer, r] of Object.entries(layers))
    if (r.verdict === "PROVEN_UNPLAYABLE")
      for (const e of r.evidence) blockers.push({ layer, judgmentId: e.judgmentId, target: e.target });
  const gaps = {};
  for (const r of Object.values(layers)) for (const g of r.gaps) gaps[g.missing] = (gaps[g.missing] ?? 0) + 1;
  const result = {
    configHash: entry.contentHash, manifestHash,
    existingAudit: existing.map((i) => i.where),
    final, global,
    layers: Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, {
      verdict: v.verdict, coverage: v.coverage,
      evidence: v.evidence.map((e) => ({ id: e.judgmentId, target: e.target })),
      gaps: v.gaps,
    }])),
    blockers, gaps,
  };
  cache.set(key, result);
  return result;
}

// 已知历史缺陷 / probe 的 contentHash
const HISTORICAL = [
  ".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1/game-config.json",
  ".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/site/v1/game-config.json",
  ".scratch/visual-design-impl-v1/runs/2026-10-25-e2e-v4pro-promptfix/wasteland-scavenger/run/v1/game-config.json",
];
const historicalHashes = new Set(
  HISTORICAL.map((p) => inv.configs.find((c) => c.path === p)?.contentHash).filter(Boolean),
);

const pairResults = [];
for (const [key, entry] of pairs) {
  const r = runPair(entry);
  pairResults.push({
    pair: key, path: entry.path, manifest: entry.auditManifest, contentHash: entry.contentHash,
    historical: historicalHashes.has(entry.contentHash),
    probe: /probe/i.test(entry.path),
    ...r,
  });
}

// 唯一 config：取每个 contentHash 的代表 pair；若同 content 结果不一致，列出。
const configResults = [];
for (const [contentHash, entry] of uniqueConfigs) {
  const reps = pairResults.filter((p) => p.contentHash === contentHash);
  const finals = [...new Set(reps.map((p) => p.final))];
  const rep = reps[0];
  configResults.push({
    contentHash,
    paths: [...new Set(reps.map((p) => p.path))],
    historical: historicalHashes.has(contentHash),
    probe: reps.every((p) => p.probe),
    final: finals.length === 1 ? finals[0] : "CONFLICTING",
    finals,
    playabilityVerdict: rep.global ?? "UNKNOWN",
    existingAudit: rep.existingAudit ?? [],
    blockers: reps.flatMap((p) => p.blockers ?? []),
    gaps: reps[0].gaps ?? {},
    layers: rep.layers ?? {},
  });
}

const count = (rows, key) => rows.reduce((m, r) => { m[r[key]] = (m[r[key]] ?? 0) + 1; return m; }, {});
const levelConfigs = configResults.filter((c) => !c.probe);
const historical = levelConfigs.filter((c) => c.historical);
const falsePositives = levelConfigs.filter((c) => c.blockers.length > 0 && !c.historical);
const existingAuditConfigs = levelConfigs.filter((c) => c.existingAudit.length > 0 && c.blockers.length === 0);
const probeConfigs = configResults.filter((c) => c.probe);
const insufficient = levelConfigs.filter((c) => c.final === "INSUFFICIENT_EVIDENCE");

const doc = {
  version: "level-playability-v1-p1/lp06-corpus-regression/v1",
  generatedAt: new Date().toISOString(),
  inventory: { version: inv.version, freeze, verified: true },
  counts: {
    usableConfigs: usable.length,
    uniquePairs: pairs.size,
    uniqueConfigs: uniqueConfigs.size,
    evaluatedPairs: pairResults.filter((p) => !p.error).length,
    evaluatedConfigs: configResults.length,
    uniqueContentPairs: cache.size,
  },
  pairVerdicts: count(pairResults.filter((p) => !p.error), "final"),
  configVerdicts: count(levelConfigs, "final"),
  playabilityConfigVerdicts: count(levelConfigs, "playabilityVerdict"),
  allConfigVerdicts: count(configResults, "final"),
  historicalDefects: historical.map((c) => ({
    contentHash: c.contentHash, paths: c.paths, final: c.final,
    blockers: c.blockers.map((b) => b.target),
  })),
  probeExcluded: probeConfigs.map((c) => ({ contentHash: c.contentHash, paths: c.paths, final: c.final })),
  falsePositives: falsePositives.map((c) => ({
    contentHash: c.contentHash, paths: c.paths, final: c.final, blockers: c.blockers,
  })),
  existingAuditConfigs: existingAuditConfigs.map((c) => ({
    contentHash: c.contentHash, paths: c.paths, existingAudit: c.existingAudit, playabilityVerdict: c.playabilityVerdict,
  })),
  insufficient: insufficient.map((c) => ({ contentHash: c.contentHash, paths: c.paths, gaps: c.gaps })),
  configs: configResults,
  pairs: pairResults.map((p) => ({
    path: p.path, manifest: p.manifest, contentHash: p.contentHash,
    historical: p.historical, probe: p.probe, final: p.final, global: p.global,
    blockers: p.blockers, gaps: p.gaps,
  })),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");

console.log(JSON.stringify({
  out: path.relative(ROOT, OUT),
  counts: doc.counts,
  pairVerdicts: doc.pairVerdicts,
  configVerdicts: doc.configVerdicts,
  playabilityConfigVerdicts: doc.playabilityConfigVerdicts,
  allConfigVerdicts: doc.allConfigVerdicts,
  historicalDefects: doc.historicalDefects,
  probeExcluded: doc.probeExcluded,
  falsePositives: doc.falsePositives,
  existingAuditConfigs: doc.existingAuditConfigs,
  insufficientCount: doc.insufficient.length,
}, null, 2));
