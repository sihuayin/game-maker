// 票 07 的机制覆盖报告：三层矩阵（设计 / 运行时 / QA）+ 门禁。
//
// ⚠️ 判的是**机制级**的端到端齐不齐，不是 `qa.ts` 那六条产物级判据（票 06 裁定：不做第 7 判据）。
import { describe, expect, it } from "vitest";
import {
  buildMechanicCoverage, mechanicCoverageProblem,
  MECHANIC_COVERAGE_STATUSES, MechanicCoverageReportSchema,
  type GameDesignSpec, type ProbeResult,
} from "../src/index.js";

/** `buildMechanicCoverage` 只读 `design.mechanics` —— 造一个只带 mechanics 的最小设计。 */
const design = (mechanics: { id: string; mechanic: string }[]): GameDesignSpec =>
  ({ mechanics }) as GameDesignSpec;

const report = (mechanics: string[], probeResults: ProbeResult[] = []) =>
  buildMechanicCoverage(design(mechanics.map((m, i) => ({ id: `m-${i}`, mechanic: m }))), probeResults);

describe("三层矩阵：设计 / 运行时 / QA 各自成格（票 07）", () => {
  it("open-chest / avoid-danger：三条全 satisfied（词表里 supported + 有 probe）⇒ verdict satisfied", () => {
    const r = report(["open-chest", "avoid-danger"]);
    expect(r.verdict).toBe("satisfied");
    for (const m of r.mechanics) {
      expect(m.design).toBe("satisfied");
      expect(m.runtime).toBe("satisfied");
      expect(m.qa).toBe("satisfied");
    }
    expect(mechanicCoverageProblem(r)).toBeUndefined();
  });

  it("`moving-platform`（experimental + 无 probe）⇒ 设计/运行时两层不齐，verdict failed，门禁逐格点名", () => {
    const r = report(["moving-platform"]);
    expect(r.verdict).toBe("failed");
    const m = r.mechanics[0]!;
    expect(m.design).toBe("unsupported");   // deriveMechanicStatus = experimental
    expect(m.runtime).toBe("unsupported");  // 不在 RUNTIME_IMPLEMENTED_MECHANICS
    expect(m.qa).toBe("not-tested");        // 不在 QA_PROBED_MECHANICS（not-tested 本身不阻断）
    const problem = mechanicCoverageProblem(r)!;
    expect(problem).toContain("moving-platform");
    expect(problem).toContain("设计层 unsupported");
    expect(problem).toContain("运行时层 unsupported");
    expect(problem).not.toContain("QA 层 not-tested");   // not-tested 不进门禁失败名单
  });

  it("一条 supported 但**没有 probe** 的机制 ⇒ qa = not-tested，但**不阻断门禁**（基线机制靠 witness 盖住）", () => {
    // `run` 有运行时实现（supported）但没有 probe（不在 QA_PROBED_MECHANICS）。
    const r = report(["run"]);
    expect(r.mechanics[0]!.design).toBe("satisfied");
    expect(r.mechanics[0]!.runtime).toBe("satisfied");
    expect(r.mechanics[0]!.qa).toBe("not-tested");
    expect(r.verdict).toBe("satisfied");          // not-tested 不是门禁失败
    expect(mechanicCoverageProblem(r)).toBeUndefined();
  });

  it("调用方传进 `probeResults` 能分出 `failed`（probe 那一发真跑红了）", () => {
    const r = report(["open-chest"], [{ mechanic: "open-chest", passed: false }]);
    expect(r.mechanics[0]!.qa).toBe("failed");
    expect(r.verdict).toBe("failed");
  });
});

describe("形状：报告过自己的契约", () => {
  it("状态枚举是封闭的（五态）；报告过 `mechanic-coverage/v1`", () => {
    expect(MECHANIC_COVERAGE_STATUSES).toEqual(["satisfied", "missing", "unsupported", "not-tested", "failed"]);
    const r = report(["open-chest"]);
    expect(MechanicCoverageReportSchema.safeParse(r).success).toBe(true);
    expect(r.format).toBe("mechanic-coverage/v1");
  });

  it("单条机制**门禁失败**不被总体通过掩盖 —— `verdict` 是「无阻断」，不是「大多数」", () => {
    const r = report(["open-chest", "moving-platform"]);   // open-chest 全绿，moving-platform unsupported
    expect(r.mechanics.map((m) => m.design)).toEqual(["satisfied", "unsupported"]);
    expect(r.verdict).toBe("failed");
    expect(mechanicCoverageProblem(r)).toContain("moving-platform");
  });
});
