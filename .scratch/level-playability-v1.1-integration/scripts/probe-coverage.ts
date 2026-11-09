// I00-01 只读探针：枚举现有 playability fixtures，打印整关 / 分层 verdict 与 coverage。
// 用法：node <bundle> <repoRoot>
// 不写产品目录；输出到 stdout，由调用方重定向到 evidence 日志。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAssetPack, parseGameConfig } from "../../../packages/contracts/src/index.js";
import { auditPlayability } from "../../../packages/contracts/src/playability/api.js";
import { auditSpatial } from "../../../packages/contracts/src/playability/spatial.js";
import { auditMechanic } from "../../../packages/contracts/src/playability/mechanic.js";
import { auditCompletion } from "../../../packages/contracts/src/playability/completion.js";
import { aggregateLayer } from "../../../packages/contracts/src/playability/verdict.js";

const root = process.argv[2];
if (root === undefined) throw new Error("usage: probe-coverage <repoRoot>");
const fixtures = join(root, "packages/contracts/tests/fixtures");
const docs = [
  "playability-matrix.json",
  "playability-mechanic-matrix.json",
  "playability-completion-matrix.json",
] as const;

const out: unknown[] = [];
for (const docName of docs) {
  const doc = JSON.parse(readFileSync(join(fixtures, docName), "utf8")) as {
    manifest: unknown;
    cases: { caseId: string; expectedVerdict?: string; config: unknown }[];
  };
  const mp = parseAssetPack(doc.manifest);
  if (!mp.ok) throw new Error(`${docName} manifest: ${mp.errors.join(";")}`);
  const manifest = mp.value;
  for (const c of doc.cases) {
    const cp = parseGameConfig(c.config);
    if (!cp.ok) throw new Error(`${docName}/${c.caseId}: ${cp.errors.join(";")}`);
    const config = cp.value;
    const spatial = auditSpatial(config, manifest);
    const mechanic = auditMechanic(config, manifest);
    const completion = auditCompletion(config, manifest, undefined, { spatial, mechanic });
    const top = auditPlayability(config, manifest);
    out.push({
      doc: docName.replace("playability-", "").replace("-matrix.json", "").replace(".json", ""),
      caseId: c.caseId,
      fixtureExpected: c.expectedVerdict ?? null,
      top: {
        verdict: top.verdict,
        coverage: top.coverage,
        evidence: top.evidence.map((e) => e.judgmentId),
      },
      layers: {
        spatial: { verdict: spatial.verdict, coverage: spatial.coverage, gaps: spatial.gaps.map((g) => g.missing) },
        mechanic: { verdict: mechanic.verdict, coverage: mechanic.coverage, gaps: mechanic.gaps.map((g) => g.missing) },
        completion: { verdict: completion.verdict, coverage: completion.coverage, gaps: completion.gaps.map((g) => g.missing) },
      },
    });
  }
}

const agg = aggregateLayer({ coverage: "partial", evidence: [] });
console.log(JSON.stringify({ aggregateLayer_partial_empty: agg, cases: out }, null, 2));
