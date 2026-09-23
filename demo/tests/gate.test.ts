import { describe, expect, it } from "vitest";
import { calculateGate } from "../src/qa/gate.js";

describe("creation gate", () => {
  it("passes when hard gates and quality threshold are met", () => {
    const r = calculateGate({
      runId:"r",
      requirement:{total:1,implemented:1,tested:1,passed:1,coverage:1,missing:[]},
      assets:{totalRequired:1,generatedRequired:1,completeness:1,criticalMissing:[],broken:[]},
      visual:{score:1,styleConsistency:1,novelAssetStyleConsistency:1,issues:[]},
      gameplay:{passed:10,total:10,passRate:1,criticalPassed:1,criticalTotal:1,failures:[]},
      runtime:{boot:true,sceneLoad:true,crashes:0,runtimeErrors:0,assetLoadErrors:0,missingResources:0,memoryWarnings:0},
      interaction:{score:1,issues:[]}, evidence:[]
    });
    expect(r.status).toBe("pass");
    expect(r.hardGate.passed).toBe(true);
  });
});
