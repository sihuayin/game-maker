/** I02-05 · 生成 inputs/cases.json（确定性）。 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const synthetic = (visualWidth, id) => ({
  id,
  visualWidth,
  distance: 20,
  periodMs: 4000,
  phaseSteps: 200,
  xStep: 2,
  maxSpeed: 0.16,
  maxStates: 1_500_000,
  timeBudgetMs: 60_000,
});

const cases = {
  meta: {
    effort: "level-playability-v1.1-i02",
    ticket: "I02-05",
    note: "scratch-only; model under test is the P0 proxy, not the I-02 implementation",
  },
  budgets: {
    recommended: { maxStates: 500_000, timeBudgetMs: 2_000 },
    hard: { maxStates: 1_000_000, timeBudgetMs: 10_000 },
  },
  corpus: {
    limits: { maxStates: 200_000, timeBudgetMs: 5_000 },
    // 与 I-00 perf-probe 同口径：配置速度与 P0 解析上界 0.16 px/ms 两档。
    speedBands: ["config", 0.16],
  },
  synthetic: [synthetic(1440, "E1440"), synthetic(5760, "E5760")],
  boundary: [
    { id: "state500k", visualWidth: 5760, limits: { maxStates: 500_000, timeBudgetMs: 60_000 } },
    { id: "wall5ms", visualWidth: 5760, limits: { maxStates: 1_500_000, timeBudgetMs: 5 } },
  ],
  repeats: { count: 5, targets: ["E1440", "E5760"] },
};

writeFileSync(join(here, "inputs", "cases.json"), JSON.stringify(cases, null, 2) + "\n");
console.log("wrote inputs/cases.json");
