// LP-03：冻结历史语料的**机制类**重判（只读；零付费）。
// 运行：pnpm build && node .scratch/level-playability-v1-p1/rejudge-mechanic.mjs
// 产出：.scratch/level-playability-v1-p1/evidence/05-lp03-mechanic.json
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { auditReachability, parseGameConfig } from "../../packages/contracts/dist/index.js";
import { auditMechanic } from "../../packages/contracts/dist/playability/mechanic.js";
import { auditSpatial } from "../../packages/contracts/dist/playability/spatial.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const HERE = import.meta.dirname;
const INV_PATH = path.join(ROOT, ".scratch/level-playability-v1/corpus/inventory.json");
const OUT = path.join(HERE, "evidence/05-lp03-mechanic.json");
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

const uniqueByConfig = new Map();
for (const entry of inv.configs) {
  if (!entry.usableForRejudgment || !entry.parseOk) continue;
  if (!uniqueByConfig.has(entry.contentHash)) uniqueByConfig.set(entry.contentHash, entry);
}
const configs = [...uniqueByConfig.values()];
if (configs.length < 20) throw new Error(`唯一 config 少于 20：${configs.length}`);

const details = [];
const verdicts = { PROVEN_UNPLAYABLE: 0, INSUFFICIENT_EVIDENCE: 0, NO_PROVEN_BLOCKER: 0 };
const coverage = { checked: 0, partial: 0, "not-checked": 0 };
const gapCounts = {};
const blockers = [];
const diffs = { newErrors: [], pairsWithBlockers: 0 };

for (const entry of configs) {
  const parsed = parseGameConfig(JSON.parse(fs.readFileSync(path.join(ROOT, entry.path), "utf8")));
  if (!parsed.ok) { details.push({ path: entry.path, error: "config-parse-failed" }); continue; }
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(ROOT, entry.auditManifest), "utf8")));
  const config = parsed.value;

  const mechanic = auditMechanic(config, manifest);
  const spatial = auditSpatial(config, manifest);
  const current = auditReachability(config, manifest).map((i) => i.where);
  const next = mechanic.evidence.map((e) => e.target);
  const newErrors = next.filter((x) => !current.includes(x));
  if (newErrors.length) { diffs.pairsWithBlockers += 1; diffs.newErrors.push({ path: entry.path, newErrors }); }

  verdicts[mechanic.verdict] += 1;
  coverage[mechanic.coverage] += 1;
  for (const gap of mechanic.gaps) gapCounts[gap.missing] = (gapCounts[gap.missing] ?? 0) + 1;
  for (const e of mechanic.evidence)
    blockers.push({ path: entry.path, target: e.target, judgmentId: e.judgmentId });

  details.push({
    path: entry.path,
    contentHash: entry.contentHash,
    manifest: entry.auditManifest,
    manifestSchema: entry.auditManifestSchema,
    requiresNormalization: entry.requiresNormalization,
    verdict: mechanic.verdict,
    coverage: mechanic.coverage,
    gaps: mechanic.gaps,
    evidence: mechanic.evidence.map((e) => ({
      judgmentId: e.judgmentId, target: e.target, witness: e.witness.kind,
    })),
    spatialVerdict: spatial.verdict,
    spatialErrors: spatial.evidence.map((e) => e.target),
    currentReachability: current,
    newErrors,
  });
}

const doc = {
  version: "level-playability-v1-p1/lp03-mechanic-corpus/v1",
  generatedAt: new Date().toISOString(),
  baseline: inv.baseline,
  inventory: { version: inv.version, freeze, verified: true },
  counts: {
    uniqueConfigs: configs.length,
    evaluated: details.filter((d) => !d.error).length,
    configsWithBlockingEvidence: new Set(blockers.map((b) => b.path)).size,
    blockingEvidence: blockers.length,
  },
  verdicts,
  coverage,
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
  verdicts,
  coverage,
  gaps: gapCounts,
  blockingEvidence: doc.counts.blockingEvidence,
  configsWithBlockingEvidence: doc.counts.configsWithBlockingEvidence,
  blockers,
  vsAuditReachability: { new: diffs.newErrors.length, pairsWithBlockers: diffs.pairsWithBlockers },
}, null, 2));
