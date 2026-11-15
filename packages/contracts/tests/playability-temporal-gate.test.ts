// U3 / R3：门区半部的 API、输入契约（U3-01）与闭式几何（U3-02）。
//
// ⚠️ 本文件当前只覆盖 API 形状、失败原因闭集、依赖边界、确定性与 D4 §1.1 门区闭式；
//    全周期覆盖（U3-03）、判侧（U3-04）、forbiddenInjection（U3-05）与 D4 §11
//    反例（U3-06）在后续票补齐。
// ⚠️ 夹具全部内存构造（`playability-temporal-fixtures.ts`），不读文件系统、不新增
//    JSON fixture、不新增依赖。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { boxFromFoot, expandBox } from "../src/playability/geometry.js";
import type { Aabb } from "../src/playability/geometry.js";
import { buildMovementGraph } from "../src/playability/graph.js";
import { trianglePosition } from "../src/playability/temporal-motion.js";
import {
  computePermanentGate,
  type PermanentGateHalf,
  type PermanentGateInput,
} from "../src/playability/temporal-gate.js";
import type { DegradationReason, PermanentGateProof } from "../src/playability/temporal-result.js";
import { aabb, witnessWorld } from "./playability-temporal-fixtures.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const gateSource = (): string =>
  fs.readFileSync(path.join(ROOT, "packages/contracts/src/playability/temporal-gate.ts"), "utf8");

/** 默认输入：`at=(50,40)`、行程 10、周期 200ms、Hazard 20×20 底边中心锚点。 */
const input = (overrides: Partial<PermanentGateInput> = {}): PermanentGateInput => {
  const { config, manifest } = witnessWorld({ hazardW: 20, hazardH: 20 });
  const graph = buildMovementGraph(config, manifest);
  if (graph === null) throw new Error("fixture graph must build");
  return {
    buildGraph: (forbiddenBoxes) => buildMovementGraph(config, manifest, undefined, { forbiddenBoxes }),
    motion: { at: { x: 50, y: 40 }, distance: 10, periodMs: 200 },
    hazard: { size: { w: 20, h: 20 }, anchor: { x: 0.5, y: 1 } },
    playerSize: { w: 2, h: 20 },
    spawnBox: boxFromFoot({ x: 5, y: 40 }, { w: 2, h: 20 }),
    goalRect: aabb(87, 20, 6, 20),
    graph,
    ...overrides,
  };
};

const resultOf = (overrides: Partial<PermanentGateInput> = {}): PermanentGateHalf =>
  computePermanentGate(input(overrides));

const gateOf = (overrides: Partial<PermanentGateInput> = {}): PermanentGateProof["gate"] => {
  const result = resultOf(overrides);
  if (result.gate === null) throw new Error(`expected gate, got ${result.reason}`);
  return result.gate;
};

const withMotion = (
  motion: Partial<PermanentGateInput["motion"]>,
  hazard: Partial<PermanentGateInput["hazard"]> = {},
): Partial<PermanentGateInput> => {
  const base = input();
  return {
    motion: { ...base.motion, ...motion },
    hazard: { ...base.hazard, ...hazard },
  };
};

/** U3 允许的失败原因：D9 闭集的子集，不得新增原因码。 */
const U3_REASONS: readonly DegradationReason[] = ["no-permanent-gate", "geometry-untrusted"];

describe("U3-01 门区半部 API 契约", () => {
  it("输出形状固定为门区半部六字段", () => {
    expect(Object.keys(resultOf()).sort()).toEqual([
      "forbiddenInjection",
      "gate",
      "gateStatus",
      "periodCoverage",
      "reason",
      "sideRule",
    ]);
  });

  it("有效几何返回 COMPLETE，四段半部全填，不生成 U4 字段", () => {
    const result = resultOf();
    expect(result.gateStatus).toBe("COMPLETE");
    expect(result.reason).toBeNull();
    expect(result.gate).not.toBeNull();
    expect(result.periodCoverage).not.toBeNull();
    expect(result.sideRule).not.toBeNull();
    expect(result.forbiddenInjection).not.toBeNull();
    const keys = Object.keys(result);
    for (const forbidden of ["graphCut", "hopDoubling", "hopSamplingCoverage", "movementModelClosure"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("失败原因只取 D9 闭集的 U3 两项", () => {
    const failures: readonly Partial<PermanentGateInput>[] = [
      withMotion({ periodMs: 0 }),
      withMotion({ distance: -1 }),
      withMotion({ distance: 1000 }),
      withMotion({ distance: 20 }),
      { spawnBox: aabb(10, 100, 2, 20) },
    ];
    for (const overrides of failures) {
      const result = resultOf(overrides);
      expect(result.gateStatus).toBe("INCOMPLETE");
      expect(result.reason).not.toBeNull();
      expect(U3_REASONS).toContain(result.reason);
      expect(result.gate).toBeNull();
      expect(result.periodCoverage).toBeNull();
      expect(result.sideRule).toBeNull();
      expect(result.forbiddenInjection).toBeNull();
    }
  });

  it("门区半部可无损耗嵌入 D9 PermanentGateProof", () => {
    const result = resultOf();
    const gate: PermanentGateProof["gate"] | null = result.gate;
    const period: PermanentGateProof["periodCoverage"] | null = result.periodCoverage;
    const side: PermanentGateProof["sideRule"] | null = result.sideRule;
    const injection: PermanentGateProof["forbiddenInjection"] | null = result.forbiddenInjection;
    expect(gate).toEqual(result.gate);
    expect(period).toEqual(result.periodCoverage);
    expect(side).toEqual(result.sideRule);
    expect(injection).toEqual(result.forbiddenInjection);
  });

  it("相同输入重复运行结果规范化相等（无随机 / 时间依赖）", () => {
    expect(JSON.stringify(resultOf())).toBe(JSON.stringify(resultOf()));
  });
});

describe("U3-02 门区闭式几何", () => {
  it("L/R/width 按 D4 §1.1 闭式：L = at+d−anchorX·w、R = at+(1−anchorX)·w、width = w−d", () => {
    const gate = gateOf();
    expect(gate.L).toBe(50); // 50 + 10 − 0.5·20
    expect(gate.R).toBe(60); // 50 + 0.5·20
    expect(gate.width).toBe(10); // 20 − 10
    expect(gate.y).toBe(20); // at.y − anchorY·h
    expect(gate.height).toBe(20);
  });

  it("锚点非中心时 L/R 不对称，width 仍为 w−d", () => {
    const gate = gateOf(withMotion({}, { anchor: { x: 0.25, y: 1 } }));
    expect(gate.L).toBe(55); // 50 + 10 − 0.25·20
    expect(gate.R).toBe(65); // 50 + 0.75·20
    expect(gate.width).toBe(10);
  });

  it("门区是恒覆盖核心，不是整段扫掠区，也不带 lag pad", () => {
    const gate = gateOf();
    // 扫掠带 = [at − anchorX·w, at + d + (1−anchorX)·w] = [40, 70]。
    expect(gate.L).toBeGreaterThan(40);
    expect(gate.R).toBeLessThan(70);
    expect(gate.L).toBe(50);
    expect(gate.R).toBe(60);
  });

  it("epsilon 只作门宽阈值且不进入几何：width > ε 两侧", () => {
    const tiny = (w: number): PermanentGateHalf =>
      resultOf(withMotion({ distance: 0 }, { size: { w, h: 20 } }));
    // distance = 0 ⇒ ε = 1e-9（x 域退化）；width = w。
    expect(tiny(1e-9).gateStatus).toBe("INCOMPLETE"); // 恰好等于 ε
    expect(tiny(1e-9).reason).toBe("no-permanent-gate");
    expect(tiny(5e-10).gateStatus).toBe("INCOMPLETE"); // 略小
    expect(tiny(2e-9).gateStatus).toBe("COMPLETE"); // 略大
    expect(tiny(2e-9).gate?.width).toBe(2e-9);
  });

  it("y 区间严格重叠才有效：相切与不重叠都不可构成门区", () => {
    const tangent = resultOf(withMotion({ at: { x: 50, y: 60 } })); // [40,60] 与玩家 [20,40] 相切
    expect(tangent.gateStatus).toBe("INCOMPLETE");
    expect(tangent.reason).toBe("no-permanent-gate");

    const disjoint = resultOf(withMotion({ at: { x: 50, y: 70 } })); // [50,70] 与玩家 [20,40] 不重叠
    expect(disjoint.gateStatus).toBe("INCOMPLETE");
    expect(disjoint.reason).toBe("no-permanent-gate");

    const overlapping = resultOf(withMotion({ at: { x: 50, y: 30 } })); // [10,30] 与玩家 [20,40] 重叠
    expect(overlapping.gateStatus).toBe("COMPLETE");
    expect(overlapping.gate?.y).toBe(10);
  });

  it("门宽 ≤ 0 时不构成门区", () => {
    const equal = resultOf(withMotion({ distance: 20 }));
    expect(equal.gateStatus).toBe("INCOMPLETE");
    expect(equal.reason).toBe("no-permanent-gate");
    const negative = resultOf(withMotion({ distance: 30 }));
    expect(negative.gateStatus).toBe("INCOMPLETE");
    expect(negative.reason).toBe("no-permanent-gate");
  });

  it("非法周期 / 非有限数值 / 非法几何 ⇒ geometry-untrusted，不静默修复", () => {
    const cases: readonly Partial<PermanentGateInput>[] = [
      withMotion({ periodMs: 0 }),
      withMotion({ periodMs: -200 }),
      withMotion({ periodMs: Number.NaN }),
      withMotion({ at: { x: Number.POSITIVE_INFINITY, y: 40 } }),
      withMotion({ distance: -1 }),
      withMotion({}, { size: { w: 0, h: 20 } }),
      withMotion({}, { size: { w: 20, h: 0 } }),
      withMotion({}, { anchor: { x: 1.5, y: 1 } }),
      withMotion({}, { anchor: { x: 0.5, y: -0.1 } }),
      { spawnBox: aabb(0, 0, 0, 20) },
    ];
    for (const overrides of cases) {
      const result = resultOf(overrides);
      expect(result.gateStatus).toBe("INCOMPLETE");
      expect(result.reason).toBe("geometry-untrusted");
    }
  });
});

describe("U3-03 全周期覆盖", () => {
  it("记录 periodMs 与闭式全周期区间（两个解析半周期，不合并）", () => {
    const result = resultOf();
    const coverage = result.periodCoverage;
    if (coverage === null) throw new Error("expected period coverage");
    expect(coverage.periodMs).toBe(200);
    expect(coverage.complete).toBe(true);
    expect(coverage.intervals).toEqual([[0, 100], [100, 200]]);
  });

  it("极值只在 t = 0 / P/2 / P 取得（含负时间与多周期）", () => {
    const motion = input().motion;
    const { at, distance, periodMs } = motion;
    expect(trianglePosition(motion, 0)).toBe(at.x);
    expect(trianglePosition(motion, periodMs / 2)).toBe(at.x + distance);
    expect(trianglePosition(motion, periodMs)).toBe(at.x);
    expect(trianglePosition(motion, -periodMs)).toBe(at.x);
    expect(trianglePosition(motion, -periodMs / 2)).toBe(at.x + distance);
    expect(trianglePosition(motion, 5 * periodMs)).toBe(at.x);
    expect(trianglePosition(motion, periodMs + periodMs / 2)).toBe(at.x + distance);
  });

  it("区间相邻且合起来恰好是一个周期（无 pad、无缺口）", () => {
    const coverage = resultOf().periodCoverage;
    if (coverage === null) throw new Error("expected period coverage");
    const first = coverage.intervals[0];
    const second = coverage.intervals[1];
    if (first === undefined || second === undefined) throw new Error("expected two intervals");
    const [firstStart, firstEnd] = first;
    const [secondStart, secondEnd] = second;
    expect(firstStart).toBe(0);
    expect(firstEnd).toBe(secondStart);
    expect(secondEnd).toBe(coverage.periodMs);
    expect(firstEnd - firstStart + (secondEnd - secondStart)).toBe(coverage.periodMs);
  });

  it("周期起终点一致：P 与 0 是同一相位，不产生第二段覆盖", () => {
    const coverage = resultOf().periodCoverage;
    if (coverage === null) throw new Error("expected period coverage");
    expect(coverage.intervals).toHaveLength(2);
    expect(coverage.intervals[0]?.[0]).toBe(0);
    expect(coverage.intervals[1]?.[1]).toBe(coverage.periodMs);
  });

  it("非法周期不产生 complete: true，而是 geometry-untrusted", () => {
    for (const periodMs of [0, -200, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = resultOf(withMotion({ periodMs }));
      expect(result.gateStatus).toBe("INCOMPLETE");
      expect(result.reason).toBe("geometry-untrusted");
      expect(result.periodCoverage).toBeNull();
    }
  });
});

describe("U3-04 判侧规则", () => {
  it("左→右：spawnRight ≤ L 且 goalRegion.x ≥ R", () => {
    const result = resultOf();
    const side = result.sideRule;
    if (side === null) throw new Error("expected side rule");
    expect(side.direction).toBe("left->right");
    expect(side.spawnBox).toEqual(input().spawnBox);
    expect(side.goalRegion).toEqual({ x: 86.5, y: 19.5, w: 7, h: 21 });
  });

  it("右→左：spawnBox.x ≥ R 且 goalRegion 右缘 ≤ L", () => {
    const result = resultOf({
      spawnBox: boxFromFoot({ x: 95, y: 40 }, { w: 2, h: 20 }),
      goalRect: aabb(2, 20, 6, 20),
    });
    const side = result.sideRule;
    if (side === null) throw new Error("expected side rule");
    expect(side.direction).toBe("right->left");
    expect(side.goalRegion).toEqual({ x: 1.5, y: 19.5, w: 7, h: 21 });
  });

  it("goalRegion 四边各外扩 0.5px，spawnBox 保持精确盒（不外扩）", () => {
    const goalRect = aabb(87, 20, 6, 20);
    const spawnBox = input().spawnBox;
    const side = resultOf({ goalRect, spawnBox }).sideRule;
    if (side === null) throw new Error("expected side rule");
    expect(side.goalRegion).toEqual({ x: 86.5, y: 19.5, w: 7, h: 21 });
    expect(side.spawnBox).toEqual(spawnBox);
    expect(side.goalRegion).not.toEqual(goalRect);
  });

  it("同侧 / 目标跨门 / 起点跨门 ⇒ INCOMPLETE + no-permanent-gate", () => {
    const cases: readonly Partial<PermanentGateInput>[] = [
      { goalRect: aabb(2, 20, 6, 20) }, // 起点与目标同侧
      { goalRect: aabb(45, 20, 20, 20) }, // 目标跨门
      { spawnBox: boxFromFoot({ x: 51, y: 40 }, { w: 2, h: 20 }) }, // 起点跨门
    ];
    for (const overrides of cases) {
      const result = resultOf(overrides);
      expect(result.gateStatus).toBe("INCOMPLETE");
      expect(result.reason).toBe("no-permanent-gate");
      expect(result.sideRule).toBeNull();
    }
  });

  it("边界相切按 ≤ / ≥ 闭合成立（左→右 / 右→左各一例）", () => {
    const leftToRight = resultOf({
      spawnBox: aabb(48, 20, 2, 20), // spawnRight = 50 = L
      goalRect: aabb(60.5, 20, 6, 20), // goalRegion.x = 60 = R
    });
    expect(leftToRight.gateStatus).toBe("COMPLETE");
    expect(leftToRight.sideRule?.direction).toBe("left->right");

    const rightToLeft = resultOf({
      spawnBox: aabb(60, 20, 2, 20), // spawnBox.x = 60 = R
      goalRect: aabb(43.5, 20, 6, 20), // goalRegion 右缘 = 50 = L
    });
    expect(rightToLeft.gateStatus).toBe("COMPLETE");
    expect(rightToLeft.sideRule?.direction).toBe("right->left");
  });

  it("不得直接用未外扩 Goal Rect：外扩后才成立的分离不算判侧", () => {
    // 未外扩时 x = 60 = R 成立，外扩后 goalRegion.x = 59.5 < R ⇒ 必须 INCOMPLETE。
    const leftToRight = resultOf({ goalRect: aabb(60, 20, 6, 20) });
    expect(leftToRight.gateStatus).toBe("INCOMPLETE");
    expect(leftToRight.reason).toBe("no-permanent-gate");

    // 未外扩时右缘 = 50 = L 成立，外扩后 50.5 > L ⇒ 必须 INCOMPLETE。
    const rightToLeft = resultOf({ goalRect: aabb(44, 20, 6, 20) });
    expect(rightToLeft.gateStatus).toBe("INCOMPLETE");
    expect(rightToLeft.reason).toBe("no-permanent-gate");
  });

  it("spawn 用精确盒，不做 0.5px 外扩", () => {
    // spawnRight = 50.5 略超 L = 50；若对 spawn 做外扩/内缩就会被误判为分离。
    const result = resultOf({ spawnBox: aabb(48.5, 20, 2, 20) });
    expect(result.gateStatus).toBe("INCOMPLETE");
    expect(result.reason).toBe("no-permanent-gate");
  });

  it("非法 goalRect ⇒ geometry-untrusted", () => {
    for (const goalRect of [
      aabb(87, 20, 0, 20),
      aabb(87, 20, 6, 0),
      aabb(Number.NaN, 20, 6, 20),
      aabb(87, 20, Number.POSITIVE_INFINITY, 20),
    ]) {
      const result = resultOf({ goalRect });
      expect(result.gateStatus).toBe("INCOMPLETE");
      expect(result.reason).toBe("geometry-untrusted");
      expect(result.sideRule).toBeNull();
    }
  });
});

describe("U3-05 forbiddenInjection", () => {
  const world = (options: Parameters<typeof witnessWorld>[0] = { hazardW: 20, hazardH: 20 }) => {
    const { config, manifest } = witnessWorld(options);
    return {
      config,
      manifest,
      build: (forbiddenBoxes: readonly Aabb[]) =>
        buildMovementGraph(config, manifest, undefined, { forbiddenBoxes }),
    };
  };

  it("原始 gateRect 原样注入，记录 source = forbiddenBoxes", () => {
    const result = resultOf();
    const injection = result.forbiddenInjection;
    if (injection === null) throw new Error("expected injection");
    expect(injection.source).toBe("forbiddenBoxes");
    expect(injection.gateRect).toEqual({ x: 50, y: 20, w: 10, h: 20 });
  });

  it("expandedRect 只扩张一次（按玩家半宽 / 全高）", () => {
    const injection = resultOf().forbiddenInjection;
    if (injection === null) throw new Error("expected injection");
    expect(injection.expandedRect).toEqual({
      x: 49, // gate.x − playerHalfW
      y: 20, // 脚点在盒底边，y 不下移
      w: 12, // gate.w + playerW
      h: 40, // gate.h + playerH
    });
  });

  it("建图入口先收到基线 []、再收到原始 gateRect（不预扩张）", () => {
    const { build } = world();
    const seen: (readonly Aabb[])[] = [];
    const result = computePermanentGate({
      ...input(),
      buildGraph: (forbiddenBoxes) => {
        seen.push(forbiddenBoxes);
        return build(forbiddenBoxes);
      },
    });
    expect(result.gateStatus).toBe("COMPLETE");
    expect(seen).toHaveLength(2);
    expect(seen[0]).toEqual([]);
    expect(seen[1]).toEqual([{ x: 50, y: 20, w: 10, h: 20 }]);
  });

  it("禁区不可穿越，且不写入 blocked", () => {
    const { build } = world();
    const base = build([]);
    const injection = resultOf().forbiddenInjection;
    if (base === null || injection === null) throw new Error("expected graph and injection");
    const injected = build([injection.gateRect]);
    if (injected === null) throw new Error("expected injected graph");

    // 脚点 (55, 39) 的玩家盒在门区内：基线可走，注入后不可穿越。
    expect(base.freeAt(55, 39)).toBe(true);
    expect(injected.freeAt(55, 39)).toBe(false);

    // blocked 是实心体掩码：注入只改 forbidden，不得改 blocked。
    expect(Array.from(injected.blocked)).toEqual(Array.from(base.blocked));
  });

  it("门顶不是地板：注入不产生任何新站位", () => {
    const { build } = world();
    const base = build([]);
    const injection = resultOf().forbiddenInjection;
    if (base === null || injection === null) throw new Error("expected graph and injection");
    const injected = build([injection.gateRect]);
    if (injected === null) throw new Error("expected injected graph");

    for (let index = 0; index < injected.standable.length; index++) {
      if (injected.standable[index] === 1) expect(base.standable[index], `cell ${index}`).toBe(1);
    }
    // 门顶所在脚点格（y = gate.y + height = 40）不是地板。
    expect(injected.standableAt(55, 40)).toBe(false);
  });

  it("门悬空时，门顶格不是可站立面（standable 只看 blocked）", () => {
    const floating = world();
    const result = computePermanentGate({
      ...input({ motion: { at: { x: 50, y: 30 }, distance: 10, periodMs: 200 } }),
      buildGraph: floating.build,
    });
    const injection = result.forbiddenInjection;
    if (injection === null) throw new Error("expected injection");
    const base = floating.build([]);
    const injected = floating.build([injection.gateRect]);
    if (base === null || injected === null) throw new Error("expected graph");

    expect(injection.gateRect).toEqual({ x: 50, y: 10, w: 10, h: 20 });
    // 门顶（脚点 y = 30）在基线里也不是站位；注入后更不可能变成站位。
    expect(base.standableAt(55, 30)).toBe(false);
    expect(injected.standableAt(55, 30)).toBe(false);
  });

  it("预扩张 / 重复扩张 ⇒ 不得产生 COMPLETE", () => {
    const { build } = world();
    const preExpanded = (forbiddenBoxes: readonly Aabb[]): ReturnType<typeof build> =>
      build(forbiddenBoxes.map((box) => expandBox(box, 20)));
    const result = computePermanentGate({ ...input(), buildGraph: preExpanded });
    expect(result.gateStatus).toBe("INCOMPLETE");
    expect(result.reason).toBe("geometry-untrusted");
    expect(result.forbiddenInjection).toBeNull();
  });

  it("图与空间层不同源 ⇒ geometry-untrusted", () => {
    const otherWorld = witnessWorld({ hazardW: 20, hazardH: 20, worldW: 120 });
    const otherGraph = buildMovementGraph(otherWorld.config, otherWorld.manifest);
    if (otherGraph === null) throw new Error("expected other graph");
    const mismatchedGraph = resultOf({ graph: otherGraph });
    expect(mismatchedGraph.gateStatus).toBe("INCOMPLETE");
    expect(mismatchedGraph.reason).toBe("geometry-untrusted");

    const mismatchedPlayer = resultOf({ playerSize: { w: 4, h: 20 } });
    expect(mismatchedPlayer.gateStatus).toBe("INCOMPLETE");
    expect(mismatchedPlayer.reason).toBe("geometry-untrusted");

    const mismatchedBuilder = resultOf({
      buildGraph: (forbiddenBoxes) =>
        buildMovementGraph(otherWorld.config, otherWorld.manifest, undefined, { forbiddenBoxes }),
    });
    expect(mismatchedBuilder.gateStatus).toBe("INCOMPLETE");
    expect(mismatchedBuilder.reason).toBe("geometry-untrusted");
  });
});

describe("U3-06 D4 §11 反例（R3 范围：1–4、6、13）", () => {
  const gateWorld = () => {
    const { config, manifest } = witnessWorld({ hazardW: 20, hazardH: 20 });
    return {
      build: (forbiddenBoxes: readonly Aabb[]) =>
        buildMovementGraph(config, manifest, undefined, { forbiddenBoxes }),
    };
  };

  it("反例 1：门宽用 pad 或扫掠并集 ⇒ 必须只取闭式 w−d 核心", () => {
    const gate = gateOf();
    const sweptLeft = 50 - 0.5 * 20; // at − anchorX·w
    const sweptWidth = 20 + 10; // w + d
    const pad = ((2 * 10) / 200) * 16.67; // Witness 方向的假设 pad
    expect(gate.width).toBe(10);
    expect(gate.width).not.toBe(sweptWidth);
    expect(gate.L).toBeGreaterThan(sweptLeft);
    expect(gate.width).not.toBe(10 + 2 * pad);
    expect(gate.L).not.toBe(50 - pad);
  });

  it("反例 2：只取上升段或按相位格采样 ⇒ 不能声称全周期", () => {
    const coverage = resultOf().periodCoverage;
    if (coverage === null) throw new Error("expected coverage");
    expect(coverage.intervals).toHaveLength(2); // 上升段 + 下降段
    expect(coverage.intervals[1]).toEqual([100, 200]);
    const total = coverage.intervals.reduce((sum, [start, end]) => sum + (end - start), 0);
    expect(total).toBe(coverage.periodMs);
  });

  it("反例 3：把整段扫掠区注入 forbiddenBoxes ⇒ 必须拒绝", () => {
    const { build } = gateWorld();
    const sweptRect: Aabb = { x: 40, y: 20, w: 30, h: 20 };
    const result = computePermanentGate({
      ...input(),
      buildGraph: (forbiddenBoxes) => build(forbiddenBoxes.map(() => sweptRect)),
    });
    expect(result.gateStatus).toBe("INCOMPLETE");
    expect(result.reason).toBe("geometry-untrusted");
    expect(result.forbiddenInjection).toBeNull();
  });

  it("反例 4：手工预扩张门、再经 forbiddenBoxes 扩张 ⇒ 必须拒绝", () => {
    const { build } = gateWorld();
    const result = computePermanentGate({
      ...input(),
      buildGraph: (forbiddenBoxes) =>
        build(forbiddenBoxes.map((box) => ({ x: box.x - 1, y: box.y, w: box.w + 2, h: box.h + 20 }))),
    });
    expect(result.gateStatus).toBe("INCOMPLETE");
    expect(result.reason).toBe("geometry-untrusted");
  });

  it("反例 6：同侧 / 目标跨门 / 起点不在严格一侧 ⇒ 必须拒绝", () => {
    const cases: readonly Partial<PermanentGateInput>[] = [
      { goalRect: aabb(2, 20, 6, 20) }, // 同侧
      { goalRect: aabb(45, 20, 20, 20) }, // 目标跨门
      { spawnBox: boxFromFoot({ x: 51, y: 40 }, { w: 2, h: 20 }) }, // 起点跨门
      { spawnBox: aabb(48.5, 20, 2, 20) }, // 起点右缘略超 L
    ];
    for (const overrides of cases) {
      const result = resultOf(overrides);
      expect(result.gateStatus).toBe("INCOMPLETE");
      expect(result.reason).toBe("no-permanent-gate");
      expect(result.sideRule).toBeNull();
      expect(result.forbiddenInjection).toBeNull();
    }
  });

  it("反例 13：把 Witness 的 lag pad 用到门区 ⇒ 门区不带 pad", () => {
    const gate = gateOf();
    const pad = ((2 * 10) / 200) * 16.67;
    expect(gate.L).toBe(50);
    expect(gate.R).toBe(60);
    expect(gate.width).toBe(10);
    expect(gate.L).not.toBe(50 - pad);
    expect(gate.R).not.toBe(60 + pad);
    expect(gateSource()).not.toContain("lagPad");
  });

  it("ε 不进碰撞谓词：同一门宽在不同 ε 下几何不变", () => {
    const small = gateOf();
    const scaled = gateOf({
      ...withMotion({ distance: 100 }, { size: { w: 110, h: 20 } }),
      goalRect: aabb(110, 20, 6, 20),
    });
    expect(scaled.epsilon).toBeGreaterThan(small.epsilon);
    expect(scaled.width).toBe(small.width);
    expect(scaled.L).toBe(95); // 50 + 100 − 0.5·110
    expect(scaled.R).toBe(105); // 50 + 0.5·110
    expect(gateSource()).not.toContain("overlapsStrict");
  });

  it("确定性与公共面：无随机 / 时间依赖、无新依赖、无 barrel 导出", () => {
    const source = gateSource();
    expect(source).not.toMatch(/Math\.random|Date\.now|performance\.now/);
    expect(JSON.stringify(resultOf())).toBe(JSON.stringify(resultOf()));
    for (const barrel of [
      "packages/contracts/src/playability/index.ts",
      "packages/contracts/src/index.ts",
    ]) {
      expect(fs.readFileSync(path.join(ROOT, barrel), "utf8"), barrel).not.toContain("temporal-gate");
    }
  });
});

describe("U3 依赖与公共面边界", () => {
  it("temporal-gate.ts 不 import temporal.ts / temporal-witness.ts", () => {
    const source = gateSource();
    expect(source).not.toMatch(/from\s+["']\.\/temporal\.js["']/);
    expect(source).not.toMatch(/from\s+["']\.\/temporal-witness\.js["']/);
  });

  it("只 import D6 DAG 允许的下层模块", () => {
    const allowed = new Set([
      "./geometry.js",
      "./graph.js",
      "./temporal-motion.js",
      "./temporal-budget.js",
      "./temporal-result.js",
    ]);
    const specifiers = [...gateSource().matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(allowed.has(specifier as string), specifier).toBe(true);
  });

  it("不新增公共 barrel 导出", () => {
    for (const barrel of [
      "packages/contracts/src/playability/index.ts",
      "packages/contracts/src/index.ts",
    ]) {
      expect(fs.readFileSync(path.join(ROOT, barrel), "utf8"), barrel).not.toContain("temporal-gate");
    }
  });

  it("不新增 TEMPORAL_LAG_* 常量、不出现 Symbol(、无 analyze: 属性标签", () => {
    const source = gateSource();
    expect(source).not.toMatch(/TEMPORAL_LAG_/);
    expect(source).not.toContain("Symbol(");
    expect(source).not.toMatch(/analyze\s*:/);
  });

  it("不做图割：无 assessReachability、无 graphCut 字段", () => {
    const source = gateSource();
    expect(source).not.toMatch(/\bassessReachability\s*\(/);
    expect(source).not.toMatch(/graphCut\s*:/);
  });

  it("全周期覆盖函数内不含采样循环（complete 只能来自闭式）", () => {
    const source = gateSource();
    const start = source.indexOf("const periodCoverageOf = (");
    if (start < 0) throw new Error("missing periodCoverageOf");
    const open = source.indexOf("{", start);
    let depth = 0;
    let end = -1;
    for (let index = open; index < source.length; index++) {
      const char = source[index];
      if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) { end = index; break; }
      }
    }
    expect(end).toBeGreaterThan(open);
    expect(source.slice(start, end + 1)).not.toMatch(/\b(?:for|while)\s*\(/);
  });

  it("导出符号全部标 @internal", () => {
    const lines = gateSource().split("\n");
    const exported = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => /^export (?:type|const|function) [A-Za-z_$]/.test(line))
      .map(({ line, index }) => ({ name: line.split(/\s+/)[2], index }));
    expect(exported.length).toBeGreaterThan(0);
    for (const { name, index } of exported) {
      const window = lines.slice(Math.max(0, index - 20), index).join("\n");
      expect(window, name).toContain("@internal");
    }
  });
});
