// LP-04：把研究矩阵里 group=completion 的用例转成生产 fixture（只读源，写一个生产 fixture）。
// 运行：node .scratch/level-playability-v1-p1/build-completion-fixtures.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SRC = path.join(ROOT, ".scratch/level-playability-v1/fixtures/07-matrix");
const OUT = path.join(ROOT, "packages/contracts/tests/fixtures/playability-completion-matrix.json");

const matrix = JSON.parse(fs.readFileSync(path.join(SRC, "matrix.json"), "utf8"));
const cases = matrix.cases.filter((c) => c.group === "completion");
if (cases.length === 0) throw new Error("矩阵里没有 completion 用例");

const readCase = (caseId) => {
  const dir = path.join(SRC, caseId);
  return {
    config: JSON.parse(fs.readFileSync(path.join(dir, "game-config.json"), "utf8")),
    manifest: JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")),
  };
};

const first = readCase(cases[0].caseId).manifest;
const manifestHash = crypto.createHash("sha256").update(JSON.stringify(first)).digest("hex");

const OVERRIDES = {
  "two-one-way-branches": {
    expectedVerdict: "INSUFFICIENT_EVIDENCE",
    expectedJudgmentId: null,
    failureLocation: null,
    expectedGap: "suppressed-by-spatial-or-mechanic",
    note: "空间层已报 gate 不可达（x=180..200 的全高墙），完成性抑制、不重复报；整关 PROVEN 归空间层。",
  },
  "chest-overlapping-hazard": {
    expectedVerdict: "INSUFFICIENT_EVIDENCE",
    expectedJudgmentId: null,
    failureLocation: null,
    expectedGap: "suppressed-by-spatial-or-mechanic",
    note: "同一 64×48 hazard 也封死 gate（机制 A），完成性抑制；整关 PROVEN 归机制层。39 例整关分布因此为 19/16/4。",
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
    expectedJudgmentId: "expectedJudgmentId" in override ? override.expectedJudgmentId : c.expectedJudgmentId,
    failureLocation: "failureLocation" in override ? override.failureLocation : c.failureLocation,
    expectedGap: override.expectedGap ?? null,
    legalPair: c.legalPair,
    evidence: c.evidence,
    note: override.note ?? c.note ?? null,
    config,
  };
});

const doc = {
  version: "level-playability-completion-matrix/v1",
  source: `${matrix.version} @ ${matrix.generatedAt}`,
  generatedAt: "2026-11-06",
  note: "由研究矩阵中 group=completion 的用例转成生产测试夹具；manifest 全用例共用，只存一份。" +
    "expectedVerdict 是**层内**预期（plan R21(a)）。",
  manifest: first,
  cases: records,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
console.log(`wrote ${path.relative(ROOT, OUT)}: ${records.length} cases, manifest sha256:${manifestHash.slice(0, 12)}…`);
