// LP-03：把研究矩阵里 group=mechanic 的用例转成生产 fixture（只读源，写一个生产 fixture）。
// 运行：node .scratch/level-playability-v1-p1/build-mechanic-fixtures.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SRC = path.join(ROOT, ".scratch/level-playability-v1/fixtures/07-matrix");
const OUT = path.join(ROOT, "packages/contracts/tests/fixtures/playability-mechanic-matrix.json");

const matrix = JSON.parse(fs.readFileSync(path.join(SRC, "matrix.json"), "utf8"));
const cases = matrix.cases.filter((c) => c.group === "mechanic");
if (cases.length === 0) throw new Error("矩阵里没有 mechanic 用例");

const readCase = (caseId) => {
  const dir = path.join(SRC, caseId);
  return {
    config: JSON.parse(fs.readFileSync(path.join(dir, "game-config.json"), "utf8")),
    manifest: JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")),
  };
};

const first = readCase(cases[0].caseId).manifest;
const manifestHash = crypto.createHash("sha256").update(JSON.stringify(first)).digest("hex");

// matrix 只写了 `coverage.mechanic` 作为证据不足的定位；生产层用具体 gap 名。
const GAPS = {
  "wide-patrol": "moving-hazard-phase",
  "pickup-in-static-hazard": "target-inside-hazard",
  "moving-platform": "moving-platform-unsupported",
};

const OVERRIDES = {
  "pickup-in-static-hazard": {
    expectedVerdict: "PROVEN_UNPLAYABLE",
    expectedJudgmentId: "PLAYABILITY_MECHANIC_PATH_BLOCKED",
    failureLocation: "entity \"suitcase-3\"",
    note: "矩阵只检查被包住的 pickup；同一 hazard（64×48）也封死其后的 suitcase-3 / gate，与 static-hazard-seals-path 同几何。被包住的 suitcase-2 仍是 gap，不硬拒。",
  },
};

const records = cases.map((c) => {
  const { config, manifest } = readCase(c.caseId);
  const hash = crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  if (hash !== manifestHash) throw new Error(`用例 ${c.caseId} 的 manifest 与基准不一致`);
  const override = OVERRIDES[c.caseId] ?? {};
  return {
    caseId: c.caseId,
    expectedVerdict: override.expectedVerdict ?? c.expectedVerdict,
    expectedJudgmentId: override.expectedJudgmentId ?? c.expectedJudgmentId,
    expectedGap: GAPS[c.caseId] ?? null,
    failureLocation: override.failureLocation ?? c.failureLocation,
    legalPair: c.legalPair,
    evidence: c.evidence,
    note: override.note ?? c.note ?? null,
    config,
  };
});

const doc = {
  version: "level-playability-mechanic-matrix/v1",
  source: `${matrix.version} @ ${matrix.generatedAt}`,
  generatedAt: "2026-11-06",
  note: "由研究矩阵中 group=mechanic 的用例转成生产测试夹具；manifest 全用例共用，只存一份。" +
    "expectedVerdict 是**层内**预期（plan R21(a)）。",
  manifest: first,
  cases: records,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
console.log(`wrote ${path.relative(ROOT, OUT)}: ${records.length} cases, manifest sha256:${manifestHash.slice(0, 12)}…`);
