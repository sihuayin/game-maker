import { DEFAULT_GATE_POLICY } from "../contracts/policy.js";
import type { CreationEvaluationReport, CreationGateResult, GateCheck, QualityDimension } from "../contracts/index.js";

export function calculateGate(input: Omit<CreationEvaluationReport,"gate"|"quality">): CreationGateResult {
  const checks: GateCheck[] = [
    {id:"req",category:"requirement",name:"Requirement coverage",required:true,
      status:input.requirement.coverage >= DEFAULT_GATE_POLICY.hard.requirementCoverage ? "pass":"fail",
      score:input.requirement.coverage,evidenceIds:[]},
    {id:"asset",category:"asset",name:"Required asset completeness",required:true,
      status:input.assets.completeness >= DEFAULT_GATE_POLICY.hard.assetCompleteness ? "pass":"fail",
      score:input.assets.completeness,evidenceIds:[]},
    {id:"visual",category:"visual",name:"Visual style consistency",required:true,
      status:input.visual.styleConsistency >= DEFAULT_GATE_POLICY.hard.visualStyle ? "pass":"fail",
      score:input.visual.styleConsistency,evidenceIds:[]},
    {id:"gameplay",category:"gameplay",name:"Gameplay pass rate",required:true,
      status:input.gameplay.passRate >= DEFAULT_GATE_POLICY.hard.gameplayPassRate ? "pass":"fail",
      score:input.gameplay.passRate,evidenceIds:[]},
    {id:"runtime",category:"runtime",name:"Runtime errors",required:true,
      status:input.runtime.runtimeErrors <= DEFAULT_GATE_POLICY.hard.runtimeErrors ? "pass":"fail",
      evidenceIds:[]}
  ];
  const dims: QualityDimension[] = [
    {name:"requirement",score:input.requirement.coverage,weight:.15},
    {name:"asset",score:input.assets.completeness,weight:.10},
    {name:"visual",score:input.visual.score,weight:.20},
    {name:"gameplay",score:input.gameplay.passRate,weight:.25},
    {name:"interaction",score:input.interaction.score,weight:.15},
    {name:"runtime",score:input.runtime.runtimeErrors === 0 ? 1 : 0,weight:.10},
    {name:"polish",score:input.visual.novelAssetStyleConsistency,weight:.05}
  ];
  const weightSum = dims.reduce((s,d)=>s+d.weight,0);
  const score = dims.reduce((s,d)=>s+d.score*d.weight,0)/weightSum;
  const hardPassed = checks.every(c=>c.status==="pass");
  return {
    status: hardPassed && score >= DEFAULT_GATE_POLICY.quality.minimumOverall ? "pass" : "fail",
    hardGate:{passed:hardPassed,checks},
    quality:{score,dimensions:dims},
    blockers:checks.filter(c=>c.status==="fail").map(c=>c.name),
    recommendations:[...input.visual.issues.filter(i=>i.severity!=="minor").map(i=>i.message),...input.gameplay.failures.map(f=>f.message)]
  };
}
