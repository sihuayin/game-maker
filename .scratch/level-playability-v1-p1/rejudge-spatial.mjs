// LP-02：冻结历史语料的**空间类**重判（只读；零付费）。
// 运行：pnpm build && node .scratch/level-playability-v1-p1/rejudge-spatial.mjs
// 产出：.scratch/level-playability-v1-p1/evidence/04-lp02-spatial.json
//
// 口径：06 inventory 的 usableForRejudgment 条目，按 contentHash 去重为**唯一 config**
//（与 08 的重判口径一致；重复副本不重复计数）。每份唯一 config 取它的 auditManifest。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  auditReachability, parseGameConfig,
} from "../../packages/contracts/dist/index.js";
import {
  auditSpatial, SPATIAL_NON_BLOCKING,
} from "../../packages/contracts/dist/playability/spatial.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const HERE = import.meta.dirname;
const INV_PATH = path.join(ROOT, ".scratch/level-playability-v1/corpus/inventory.json");
const OUT = path.join(HERE, "evidence/04-lp02-spatial.json");
const inv = JSON.parse(fs.readFileSync(INV_PATH, "utf8"));

// ── 冻结校验（与 08 同一算法）──────────────────────────────────────────────
const freeze = inv.freeze?.value;
const recompute = "sha256:" + crypto.createHash("sha256")
  .update(Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(inv).filter(([k]) => k !== "freeze")))))
  .digest("hex");
if (freeze !== recompute) throw new Error(`inventory freeze mismatch: ${freeze} != ${recompute}`);

const sha = (v) => "sha256:" + crypto.createHash("sha256").update(Buffer.from(JSON.stringify(v))).digest("hex");

// 旧 schema 的 manifest 只读归一化（不写回、不进生产包）。
const normalizeManifest = (raw) => ({
  ...raw,
  assets: Array.isArray(raw.assets)
    ? raw.assets.filter((a) => a !== null && typeof a === "object" && typeof a.id === "string")
    : [],
});

const uniqueByConfig = new Map();
for (const entry of inv.configs) {
  if (!entry.usableForRejudgment || !entry.parseOk) continue;
  if (!uniqueByConfig.has(entry.contentHash)) uniqueByConfig.set(entry.contentHash, entry);
}
const configs = [...uniqueByConfig.values()];
if (configs.length < 20) throw new Error(`唯一 config 少于 20：${configs.length}`);

const details = [];
const verdictCounts = { PROVEN_UNPLAYABLE: 0, INSUFFICIENT_EVIDENCE: 0, NO_PROVEN_BLOCKER: 0 };
const coverageCounts = { checked: 0, partial: 0, "not-checked": 0 };
const gapCounts = {};
const blockers = [];
const diffs = { newErrors: [], fixedErrors: [], sameTargets: 0, pairsWithDiff: 0 };

for (const entry of configs) {
  const configRaw = JSON.parse(fs.readFileSync(path.join(ROOT, entry.path), "utf8"));
  const parsed = parseGameConfig(configRaw);
  if (!parsed.ok) {
    details.push({ path: entry.path, error: "config-parse-failed" });
    continue;
  }
  const manifestRaw = JSON.parse(fs.readFileSync(path.join(ROOT, entry.auditManifest), "utf8"));
  const manifest = normalizeManifest(manifestRaw);
  const config = parsed.value;

  const spatial = auditSpatial(config, manifest);
  const current = auditReachability(config, manifest).map((i) => i.where);
  const next = spatial.evidence
    .filter((e) => !SPATIAL_NON_BLOCKING.has(e.judgmentId))
    .map((e) => e.target);

  const newErrors = next.filter((x) => !current.includes(x));
  const fixedErrors = current.filter((x) => !next.includes(x));
  if (newErrors.length || fixedErrors.length) {
    diffs.pairsWithDiff += 1;
    if (newErrors.length) diffs.newErrors.push({ path: entry.path, newErrors });
    if (fixedErrors.length) diffs.fixedErrors.push({ path: entry.path, fixedErrors });
  }
  diffs.sameTargets += next.filter((x) => current.includes(x)).length;

  verdictCounts[spatial.verdict] += 1;
  coverageCounts[spatial.coverage] += 1;
  for (const gap of spatial.gaps) gapCounts[gap.missing] = (gapCounts[gap.missing] ?? 0) + 1;
  for (const e of spatial.evidence) {
    if (SPATIAL_NON_BLOCKING.has(e.judgmentId)) continue;
    blockers.push({ path: entry.path, target: e.target, judgmentId: e.judgmentId });
  }

  details.push({
    path: entry.path,
    contentHash: entry.contentHash,
    manifest: entry.auditManifest,
    manifestSchema: entry.auditManifestSchema,
    requiresNormalization: entry.requiresNormalization,
    verdict: spatial.verdict,
    coverage: spatial.coverage,
    gaps: spatial.gaps,
    evidence: spatial.evidence.map((e) => ({
      judgmentId: e.judgmentId,
      target: e.target,
      witness: e.witness.kind,
    })),
    currentReachability: current,
    spatialTargets: next,
    newErrors,
    fixedErrors,
  });
}

const doc = {
  version: "level-playability-v1-p1/lp02-spatial-corpus/v1",
  generatedAt: new Date().toISOString(),
  baseline: inv.baseline,
  inventory: { version: inv.version, freeze, verified: true },
  counts: {
    uniqueConfigs: configs.length,
    evaluated: details.filter((d) => !d.error).length,
    configsWithBlockingEvidence: new Set(blockers.map((b) => b.path)).size,
    blockingEvidence: blockers.length,
  },
  verdicts: verdictCounts,
  coverage: coverageCounts,
  gaps: gapCounts,
  blockers,
  vsAuditReachability: diffs,
  details,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");

console.log(JSON.stringify({
  out: path.relative(ROOT, OUT),
  uniqueConfigs: doc.counts.uniqueConfigs,
  evaluated: doc.counts.evaluated,
  verdicts: verdictCounts,
  coverage: coverageCounts,
  gaps: gapCounts,
  blockingEvidence: doc.counts.blockingEvidence,
  vsAuditReachability: {
    new: diffs.newErrors.length, fixed: diffs.fixedErrors.length, pairsWithDiff: diffs.pairsWithDiff,
  },
  blockers: blockers.slice(0, 20),
}, null, 2));
