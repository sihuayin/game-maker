import { randomUUID } from "node:crypto";
import type { RepairEngine } from "../runtime/ports.js";
import type { CreationEvaluationReport, RepairPlan, CreationRun } from "../contracts/index.js";

export class DefaultRepairEngine implements RepairEngine {
  async plan(report: CreationEvaluationReport): Promise<RepairPlan> {
    const actions = [];
    for (const blocker of report.gate.blockers) {
      if (blocker.toLowerCase().includes("asset")) actions.push({
        id:randomUUID(),type:"asset" as const,targetId:"asset-manifest",
        strategy:"ASSET_REGENERATION",reason:blocker
      });
      else if (blocker.toLowerCase().includes("visual")) actions.push({
        id:randomUUID(),type:"asset" as const,targetId:"visual-assets",
        strategy:"STYLE_REGENERATION",reason:blocker
      });
      else if (blocker.toLowerCase().includes("gameplay")) actions.push({
        id:randomUUID(),type:"code" as const,targetId:"gameplay",
        strategy:"CODE_FIX",reason:blocker
      });
      else actions.push({
        id:randomUUID(),type:"runtime" as const,targetId:"runtime",
        strategy:"RUNTIME_FIX",reason:blocker
      });
    }
    return {id:randomUUID(),runId:report.runId,actions,estimatedCost:actions.length};
  }

  async execute(_plan: RepairPlan, _run: CreationRun): Promise<void> {
    // Reference implementation: real adapters should patch/version artifacts here.
    // Never overwrite the previous artifact version.
  }
}
