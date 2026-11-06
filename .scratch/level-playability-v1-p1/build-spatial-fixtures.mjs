// LP-02：把研究阶段的 39 例矩阵里**空间类**用例转成生产 fixture（只读源，写一个生产 fixture）。
// 运行：node .scratch/level-playability-v1-p1/build-spatial-fixtures.mjs
// 源：.scratch/level-playability-v1/fixtures/07-matrix/**（非生产 scratch）
// 产出：packages/contracts/tests/fixtures/playability-matrix.json（生产测试读它，不依赖 scratch 路径）
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SRC = path.join(ROOT, ".scratch/level-playability-v1/fixtures/07-matrix");
const OUT = path.join(ROOT, "packages/contracts/tests/fixtures/playability-matrix.json");

const matrix = JSON.parse(fs.readFileSync(path.join(SRC, "matrix.json"), "utf8"));
const spatial = matrix.cases.filter((c) => c.group === "spatial");
if (spatial.length === 0) throw new Error("矩阵里没有 spatial 用例");

const readCase = (caseId) => {
  const dir = path.join(SRC, caseId);
  return {
    config: JSON.parse(fs.readFileSync(path.join(dir, "game-config.json"), "utf8")),
    manifest: JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")),
  };
};

// 矩阵所有用例共用同一份 last-train 包；生产 fixture 只存一份，避免 39 份重复。
const first = readCase(spatial[0].caseId).manifest;
const manifestHash = crypto.createHash("sha256").update(JSON.stringify(first)).digest("hex");

// 既有审计族（`auditGameConfig`）拥有这三例；本 fixture 保留它们作为**层间边界锚点**。
const AUDIT_OWNED = new Set(["spawn-in-solid", "target-out-of-world", "target-at-edge"]);

// LP-00 复核（2026-11-05）推翻了 P4：`SPAWN_IN_TERRAIN` 不得作为确定性阻断。
// 研究矩阵把它记为 PROVEN_UNPLAYABLE；生产预期按已批准复核改为 INSUFFICIENT_EVIDENCE。
const OVERRIDES = {
  "spawn-deep-terrain": {
    expectedVerdict: "INSUFFICIENT_EVIDENCE",
    note: "LP-00 复核裁定 P4：Runtime 无出生点专用分离 ⇒ SPAWN_IN_TERRAIN 只观察，不硬拒（研究矩阵的 PROVEN_UNPLAYABLE 被复核覆盖）。",
  },
  "wall-100": {
    expectedJudgmentId: "PLAYABILITY_SPATIAL_GATE_UNREACHABLE",
    note: "研究矩阵把 signal 记成 PICKUP；按 framework §5.1，goal 的 SUBJECT 是 GATE。墙同时封死 suitcase-2 / suitcase-3，生产层内 verdict 仍为 PROVEN_UNPLAYABLE。",
  },
  "chest-range-rescues": {
    expectedVerdict: "PROVEN_UNPLAYABLE",
    expectedJudgmentId: "PLAYABILITY_SPATIAL_GATE_UNREACHABLE",
    failureLocation: "entity \"gate\"",
    note: "矩阵只检查了「range 救回 chest」；这一关的 gate 在 100px 沟对面（同高跳跃上界 66px），本来就到不了。chest 确实被 range 救回 —— 生产测试单独断言 chest 无判据。",
  },
};

const cases = spatial.map((c) => {
  const { config, manifest } = readCase(c.caseId);
  const hash = crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  if (hash !== manifestHash) throw new Error(`用例 ${c.caseId} 的 manifest 与基准不一致`);
  const override = OVERRIDES[c.caseId] ?? {};
  return {
    caseId: c.caseId,
    owner: AUDIT_OWNED.has(c.caseId) ? "auditGameConfig" : "playability",
    expectedVerdict: override.expectedVerdict ?? c.expectedVerdict,
    expectedJudgmentId: override.expectedJudgmentId ?? c.expectedJudgmentId,
    expectedGap: c.caseId === "spawn-no-foothold" ? "spawn-no-foothold" : null,
    failureLocation: override.failureLocation ?? c.failureLocation,
    legalPair: c.legalPair,
    evidence: c.evidence,
    note: override.note ?? c.note ?? null,
    config,
  };
});

const doc = {
  version: "level-playability-matrix/v1",
  source: `${matrix.version} @ ${matrix.generatedAt}`,
  generatedAt: "2026-11-05",
  note: "由研究矩阵中 group=spatial 的用例转成生产测试夹具；manifest 全用例共用，只存一份。" +
    "expectedVerdict 是**层内**预期（plan R21(a)），整关 aggregate 另测。",
  manifest: first,
  cases,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
console.log(`wrote ${path.relative(ROOT, OUT)}: ${cases.length} cases, manifest sha256:${manifestHash.slice(0, 12)}…`);
