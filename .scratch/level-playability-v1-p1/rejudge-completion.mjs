// LP-04：冻结历史语料的**完成性**重判（只读；零付费）。
// 运行：pnpm build && node .scratch/level-playability-v1-p1/rejudge-completion.mjs
// 产出：.scratch/level-playability-v1-p1/evidence/06-lp04-completion.json
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseGameConfig, pickupCount } from "../../packages/contracts/dist/index.js";
import { auditSpatial } from "../../packages/contracts/dist/playability/spatial.js";
import { auditMechanic } from "../../packages/contracts/dist/playability/mechanic.js";
import { auditCompletion } from "../../packages/contracts/dist/playability/completion.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const HERE = import.meta.dirname;
const INV_PATH = path.join(ROOT, ".scratch/level-playability-v1/corpus/inventory.json");
const OUT = path.join(HERE, "evidence/06-lp04-completion.json");
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
let kMax = 0;

for (const entry of configs) {
  const parsed = parseGameConfig(JSON.parse(fs.readFileSync(path.join(ROOT, entry.path), "utf8")));
  if (!parsed.ok) { details.push({ path: entry.path, error: "config-parse-failed" }); continue; }
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(ROOT, entry.auditManifest), "utf8")));
  const config = parsed.value;
  const k = pickupCount(config);
  kMax = Math.max(kMax, k);

  const spatial = auditSpatial(config, manifest);
  const mechanic = auditMechanic(config, manifest);
  const completion = auditCompletion(config, manifest, undefined, { spatial, mechanic });

  verdicts[completion.verdict] += 1;
  coverage[completion.coverage] += 1;
  for (const gap of completion.gaps) gapCounts[gap.missing] = (gapCounts[gap.missing] ?? 0) + 1;
  for (const e of completion.evidence)
    blockers.push({ path: entry.path, target: e.target, judgmentId: e.judgmentId });

  details.push({
    path: entry.path,
    contentHash: entry.contentHash,
    requiresNormalization: entry.requiresNormalization,
    k,
    verdict: completion.verdict,
    coverage: completion.coverage,
    gaps: completion.gaps,
    evidence: completion.evidence.map((e) => ({ judgmentId: e.judgmentId, target: e.target, witness: e.witness.kind })),
    spatialVerdict: spatial.verdict,
    mechanicVerdict: mechanic.verdict,
  });
}

const doc = {
  version: "level-playability-v1-p1/lp04-completion-corpus/v1",
  generatedAt: new Date().toISOString(),
  baseline: inv.baseline,
  inventory: { version: inv.version, freeze, verified: true },
  counts: {
    uniqueConfigs: configs.length,
    evaluated: details.filter((d) => !d.error).length,
    kMax,
    completionBlockers: blockers.length,
  },
  verdicts,
  coverage,
  gaps: gapCounts,
  blockers,
  details,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");

console.log(JSON.stringify({
  out: path.relative(ROOT, OUT),
  uniqueConfigs: doc.counts.uniqueConfigs,
  evaluated: doc.counts.evaluated,
  kMax,
  verdicts,
  coverage,
  gaps: gapCounts,
  blockers,
}, null, 2));
