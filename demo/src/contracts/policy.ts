import type { RepairBudget } from "./index.js";

export const DEFAULT_GATE_POLICY = {
  hard: {
    requirementCoverage: 0.95,
    assetCompleteness: 0.95,
    visualStyle: 0.80,
    gameplayPassRate: 0.90,
    runtimeErrors: 0
  },
  quality: {
    minimumOverall: 0.85,
    weights: {
      requirement: 0.15, asset: 0.10, visual: 0.20, gameplay: 0.25,
      interaction: 0.15, runtime: 0.10, polish: 0.05
    }
  }
} as const;

export const DEFAULT_BUDGET: RepairBudget = {
  maxIterations: 5,
  maxAssetRegenerations: 10,
  maxCodeRepairs: 10,
  maxDurationMs: 15 * 60 * 1000
};
