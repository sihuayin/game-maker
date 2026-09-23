import { calculateGate } from "./gate.js";
import type { CreationEvaluator } from "../runtime/ports.js";
import type {
  CreationEvaluationReport, RuntimeObservation, GameSpec, StyleSpec, AssetManifest,
  GameplayTestPlan, CreationRun
} from "../contracts/index.js";

export class MockEvaluator implements CreationEvaluator {
  async evaluate(input: {
    run: CreationRun; game: GameSpec; style: StyleSpec; manifest: AssetManifest;
    gameplayPlan: GameplayTestPlan; observations: RuntimeObservation[];
  }): Promise<CreationEvaluationReport> {
    const iteration = input.run.iteration;
    const improvement = Math.min(iteration * 0.08, 0.16);
    const base = 0.84 + improvement;
    const gameplayRate = Math.min(1, 0.86 + iteration * 0.05);
    const visualConsistency = Math.min(1, 0.78 + iteration * 0.07);
    const raw = {
      runId: input.run.id,
      requirement:{total:input.game.requirements.length,implemented:input.game.requirements.length,
        tested:input.game.requirements.length,passed:input.game.requirements.length,
        coverage:1,missing:[]},
      assets:{totalRequired:input.manifest.assets.filter(a=>a.required).length,
        generatedRequired:input.manifest.generated,completeness:Math.min(1,input.manifest.generated / Math.max(1,input.manifest.assets.filter(a=>a.required).length)),
        criticalMissing:[],broken:[]},
      visual:{score:Math.min(1,base),styleConsistency,novelAssetStyleConsistency:visualConsistency,issues:[]},
      gameplay:{passed:Math.round(input.gameplayPlan.tests.length*gameplayRate),total:input.gameplayPlan.tests.length,
        passRate:gameplayRate,criticalPassed:input.gameplayPlan.criticalTests.length,
        criticalTotal:input.gameplayPlan.criticalTests.length,failures:gameplayRate>=.9?[]:[{testId:"mock-critical",message:"Mock gameplay failure; repair expected"}]},
      runtime:{boot:true,sceneLoad:true,crashes:0,runtimeErrors:0,assetLoadErrors:0,missingResources:0,memoryWarnings:0},
      interaction:{score:Math.min(1,.82+iteration*.06),issues:[]},
      quality:{score:0,dimensions:[]},
      evidence:[]
    };
    const gate = calculateGate(raw);
    return {...raw, quality:gate.quality, gate};
  }
}
