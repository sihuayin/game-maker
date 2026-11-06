// LP-06：39 例合成矩阵全量执行（只读生产夹具；零付费）。
// 运行：pnpm build && node .scratch/level-playability-v1-p1/acceptance-matrix.mjs
// 产出：.scratch/level-playability-v1-p1/evidence/06-matrix-acceptance.json
import fs from "node:fs";
import path from "node:path";
import { auditGameConfig, parseAssetPack, parseGameConfig } from "../../packages/contracts/dist/index.js";
import { auditSpatial } from "../../packages/contracts/dist/playability/spatial.js";
import { auditMechanic } from "../../packages/contracts/dist/playability/mechanic.js";
import { auditCompletion } from "../../packages/contracts/dist/playability/completion.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const HERE = import.meta.dirname;
const FIXTURES = path.join(ROOT, "packages/contracts/tests/fixtures");
const OUT = path.join(HERE, "evidence/06-matrix-acceptance.json");

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));
const docs = {
  spatial: readJson("playability-matrix.json"),
  mechanic: readJson("playability-mechanic-matrix.json"),
  completion: readJson("playability-completion-matrix.json"),
};
const manifestParsed = parseAssetPack(docs.spatial.manifest);
if (!manifestParsed.ok) throw new Error("manifest parse: " + manifestParsed.errors.join(";"));
const MANIFEST = manifestParsed.value;

const all = [
  ...docs.spatial.cases.map((c) => ({ ...c, group: "spatial" })),
  ...docs.mechanic.cases.map((c) => ({ ...c, group: "mechanic" })),
  ...docs.completion.cases.map((c) => ({ ...c, group: "completion" })),
];
const byId = new Map(all.map((c) => [c.caseId, c]));

const parse = (raw) => {
  const p = parseGameConfig(raw);
  if (!p.ok) throw new Error("config parse: " + p.errors.join(";"));
  return p.value;
};

function runCase(caseId) {
  const c = byId.get(caseId);
  if (!c) throw new Error(`missing case ${caseId}`);
  const config = parse(c.config);
  const existing = auditGameConfig(config, MANIFEST).filter((i) => i.severity === "error");
  const spatial = auditSpatial(config, MANIFEST);
  const mechanic = auditMechanic(config, MANIFEST);
  const completion = auditCompletion(config, MANIFEST, undefined, { spatial, mechanic });
  const layers = { spatial, mechanic, completion };
  const global = [spatial, mechanic, completion].some((l) => l.verdict === "PROVEN_UNPLAYABLE")
    ? "PROVEN_UNPLAYABLE"
    : [spatial, mechanic, completion].some((l) => l.verdict === "INSUFFICIENT_EVIDENCE")
      ? "INSUFFICIENT_EVIDENCE"
      : "NO_PROVEN_BLOCKER";
  const final = existing.length > 0 ? "PROVEN_UNPLAYABLE" : global;
  const attribution = existing.length > 0 ? "existing-audit"
    : spatial.verdict === "PROVEN_UNPLAYABLE" ? "spatial"
      : mechanic.verdict === "PROVEN_UNPLAYABLE" ? "mechanic"
        : completion.verdict === "PROVEN_UNPLAYABLE" ? "completion"
          : final === "INSUFFICIENT_EVIDENCE" ? "none-insufficient" : "none";
  return {
    caseId, group: c.group,
    expectedVerdict: c.expectedVerdict,
    expectedJudgmentId: c.expectedJudgmentId ?? null,
    final, attribution,
    existingAudit: existing.map((i) => i.where),
    layers: Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, {
      verdict: v.verdict, coverage: v.coverage,
      evidence: v.evidence.map((e) => ({ id: e.judgmentId, target: e.target })),
      gaps: v.gaps,
    }])),
    completionSuppressed: completion.gaps.some((g) => g.missing === "suppressed-by-spatial-or-mechanic"),
  };
}

const results = all.map((c) => runCase(c.caseId));
const count = (key) => results.reduce((m, r) => { m[r[key]] = (m[r[key]] ?? 0) + 1; return m; }, {});

// 合法边界配对：必须不是 PROVEN。
const legal = [];
for (const c of all) {
  if (!c.legalPair) continue;
  const r = runCase(c.legalPair);
  legal.push({ caseId: c.caseId, legalPair: c.legalPair, verdict: r.final, attribution: r.attribution });
}

const expectedMismatch = results.filter((r) => r.expectedVerdict !== r.final);
const layerExpectedMismatch = results.filter((r) => r.expectedVerdict !== r.layers[r.group === "mechanic" ? "mechanic" : r.group === "completion" ? "completion" : "spatial"].verdict);

const doc = {
  version: "level-playability-v1-p1/lp06-matrix-acceptance/v1",
  generatedAt: new Date().toISOString(),
  matrixSource: "level-playability-test-matrix/v1 → production fixtures (spatial/mechanic/completion)",
  counts: {
    cases: results.length,
    spatial: results.filter((r) => r.group === "spatial").length,
    mechanic: results.filter((r) => r.group === "mechanic").length,
    completion: results.filter((r) => r.group === "completion").length,
  },
  finalDistribution: count("final"),
  attributionDistribution: count("attribution"),
  expectedFinalDistribution: count("expectedVerdict"),
  legalPairs: legal,
  expectedMismatch,
  layerExpectedMismatch,
  results,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");

console.log(JSON.stringify({
  out: path.relative(ROOT, OUT),
  counts: doc.counts,
  finalDistribution: doc.finalDistribution,
  attributionDistribution: doc.attributionDistribution,
  expectedFinalDistribution: doc.expectedFinalDistribution,
  legalPairs: legal,
  expectedMismatch: expectedMismatch.map((r) => ({ caseId: r.caseId, expected: r.expectedVerdict, final: r.final, attribution: r.attribution, layers: Object.fromEntries(Object.entries(r.layers).map(([k, v]) => [k, v.verdict])) })),
}, null, 2));
