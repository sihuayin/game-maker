/** I02-D5B · 生成 inputs/cases.json（确定性）。 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../../../..");
const INVENTORY = join(ROOT, ".scratch/level-playability-v1/corpus/inventory.json");
const invSha = "sha256:" + createHash("sha256").update(readFileSync(INVENTORY)).digest("hex");

const cases = {
  meta: {
    effort: "level-playability-v1.1-i02",
    ticket: "I02-D5B",
    note: "scratch-only; D3/D10-shaped proxy, not the I-02 implementation. Cuts = interior turnaround points; segments = cuts + 1 analytic pieces.",
    inventory: ".scratch/level-playability-v1/corpus/inventory.json",
    inventorySha256: invSha,
    equation: {
      xStep: 1,
      N_max: "floor(maxSpeed * periodMs / xStep)",
      N: "min(N_max, floor(maxStates / xPositions))",
      dtMs: "periodMs / N",
      maxStepPx: "maxSpeed * dtMs",
    },
  },
  lagsMs: [16.67, 200],
  corpus: {
    // 两档限值：推荐预算下测「状态预算先触发时 cut 总量」；硬上限下测完整搜索。
    limits: {
      recommended: { maxStates: 500_000, timeBudgetMs: 60_000 },
      hard: { maxStates: 1_000_000, timeBudgetMs: 60_000 },
    },
    speedBands: ["config", 0.16],
  },
  synthetic: [
    { id: "E1440", visualWidth: 1440 },
    { id: "E5760", visualWidth: 5760 },
  ].map((s) => ({ ...s, distance: 20, periodMs: 4000, maxSpeed: 0.16, playerWidth: 20, playerHeight: 48, limits: { maxStates: 1_500_000, timeBudgetMs: 60_000 } })),
  candidateCuts: [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000],
};
writeFileSync(join(here, "inputs", "cases.json"), JSON.stringify(cases, null, 2) + "\n");
console.log("wrote inputs/cases.json", invSha);
