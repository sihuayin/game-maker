// U2 / R2：Witness 状态格、静态走廊、wait / move、S1–S4、残差等待、U9、W、
// Witness 编码与 D3 §11 十三条反例。
//
// ⚠️ 只覆盖 U2（I02-02）；不写 A–J 矩阵（U5），不覆盖 U3–U5 的门区 / 图割 / 硬化。
// ⚠️ 全部使用**内存世界**夹具（`playability-temporal-fixtures.ts`），不读文件系统、
//    不新增 JSON fixture。真实 `last-train/v2` 在 U2 模型下是 IE（luggage solid
//    截断走廊），不能作为正样本。
// ⚠️ 预算耗尽只产生 IE；测试不把「验证过一段前缀」当成 NB。
import { describe, expect, it } from "vitest";
import { boxFromFoot, overlapsStrict } from "../src/playability/geometry.js";
import { buildMovementGraph } from "../src/playability/graph.js";
import { intersectContinuous, triangleMaxRate } from "../src/playability/temporal-motion.js";
import type { BudgetProfile } from "../src/playability/temporal-result.js";
import {
  createWitnessWorkBudget,
  encodeWitness,
  inStaticCorridor,
  isValidWaitingCell,
  resolveWitnessSpace,
  searchU9WaitingCell,
  searchWinningSet,
  verifyResidualWait,
  verifyTransition,
  verifyTransitionChain,
  witnessArrives,
  witnessPhaseCellBounds,
  witnessPlayerBox,
  type TransitionCheck,
  type U9Result,
  type WinningSetPolicyEntry,
  type WinningSetResult,
  type WitnessHazard,
  type WitnessSpace,
  type WitnessSpaceFailure,
  type WitnessState,
} from "../src/playability/temporal-witness.js";
import {
  budgetProfileFixture,
  canonicalJson,
  hazardSpec,
  triangleMotion,
  witnessConfig,
  witnessHazard,
  witnessManifest,
  witnessWorld,
  witnessWorldGeometry,
  type WitnessWorldOptions,
} from "./playability-temporal-fixtures.js";

// ── 辅助 ────────────────────────────────────────────────────────────────────

const budget = (overrides: Partial<BudgetProfile> = {}): BudgetProfile =>
  budgetProfileFixture(overrides);

const workBudget = (overrides: Partial<BudgetProfile> = {}) =>
  createWitnessWorkBudget({ profile: budget(overrides) });

const spaceOf = (
  options: WitnessWorldOptions = {},
  profile: BudgetProfile = budget(),
  periodMs = 200,
): WitnessSpace => {
  const { config, manifest } = witnessWorld(options);
  const result = resolveWitnessSpace({ config, manifest, budget: profile, periodMs });
  if (!result.ok) throw new Error(`expected space, got ${result.reason}/${result.gap}`);
  return result;
};

const spaceFailure = (
  options: WitnessWorldOptions = {},
  profile: BudgetProfile = budget(),
  periodMs = 200,
): WitnessSpaceFailure => {
  const { config, manifest } = witnessWorld(options);
  const result = resolveWitnessSpace({ config, manifest, budget: profile, periodMs });
  if (result.ok) throw new Error("expected a spatial failure");
  return result;
};

const runW = (
  space: WitnessSpace,
  hazard: WitnessHazard,
  lagMs = 0,
  overrides: Partial<BudgetProfile> = {},
): WinningSetResult =>
  searchWinningSet({ space, hazard, lagMs, budget: workBudget(overrides) });

const runU9 = (
  space: WitnessSpace,
  hazard: WitnessHazard,
  lagMs = 0,
  overrides: Partial<BudgetProfile> = {},
  preconditions: { temporalCoverage: "checked" | "partial" | "unknown"; playerGeometryTrusted: boolean } =
    { temporalCoverage: "checked", playerGeometryTrusted: true },
): U9Result =>
  searchU9WaitingCell({ space, hazard, lagMs, budget: workBudget(overrides), preconditions });

const safeWorld = (): { space: WitnessSpace; hazard: WitnessHazard } => ({
  space: spaceOf({ hazardY: 20 }),
  hazard: witnessHazard({ hazardY: 20 }),
});

const transition = (
  space: WitnessSpace,
  hazard: WitnessHazard,
  from: WitnessState,
  to: WitnessState,
  lagMs = 0,
  overrides: Partial<BudgetProfile> = {},
): TransitionCheck =>
  verifyTransition({ space, hazard, lagMs, from, to, budget: workBudget(overrides) });

const customHazard = (args: {
  atX: number;
  atY?: number;
  distance?: number;
  periodMs?: number;
  w?: number;
  h?: number;
}): WitnessHazard => ({
  motion: triangleMotion({
    atX: args.atX,
    atY: args.atY ?? 40,
    distance: args.distance ?? 10,
    periodMs: args.periodMs ?? 200,
  }),
  box: hazardSpec({ w: args.w ?? 4, h: args.h ?? 12 }),
});

const nth = <T,>(items: readonly T[], index: number): T => {
  const value = items[index];
  if (value === undefined) throw new Error(`missing index ${index}`);
  return value;
};

const policyEntry = (
  policy: readonly WinningSetPolicyEntry[],
  footX: number,
  k: number,
): WinningSetPolicyEntry | undefined =>
  policy.find((entry) => entry.state.footX === footX && entry.state.k === k);

const aligned = (footX: number, k: number, phaseSteps: number): WitnessState => ({
  footX,
  k: (k + 1) % phaseSteps,
});

// ── 1. 网格 ─────────────────────────────────────────────────────────────────

describe("U2 状态格与相位网格", () => {
  it("[I02-02][AC-03][grid] N≥2、N_max、dt、maxStep、容量按 §3.5 派生", () => {
    const space = spaceOf();
    expect(space.grid.xStep).toBe(1);
    expect(space.grid.maxSpeedPxPerMs).toBeCloseTo(0.02, 12);
    expect(space.grid.N_max).toBe(4);
    expect(space.grid.phaseSteps).toBe(4);
    expect(space.grid.phaseSteps).toBeGreaterThanOrEqual(2);
    expect(space.grid.dtMs).toBe(50);
    expect(space.grid.maxStep).toBeCloseTo(1, 12);
    expect(space.grid.xPositions).toBe(99);
    expect(space.grid.stateCapacity).toBe(99 * 4);
    expect(space.grid.phaseGridCapped).toBe(false);
    expect(space.grid.phaseCapReason).toBeNull();
  });

  it("[I02-02][AC-03][grid] 状态容量把 N 压到 N_max 以下 ⇒ phaseGridCapped + state-capacity", () => {
    const space = spaceOf({}, budget({ maxStates: 250 }));
    expect(space.grid.N_max).toBe(4);
    expect(space.grid.phaseSteps).toBe(2);
    expect(space.grid.phaseGridCapped).toBe(true);
    expect(space.grid.phaseCapReason).toBe("state-capacity");
    expect(space.grid.dtMs).toBe(100);
    // 容量粗化后 maxStep 可以超过 1px —— 这正是 S1 / 残差等待必须做连续检查的原因。
    expect(space.grid.maxStep).toBeCloseTo(2, 12);
    expect(space.grid.stateCapacity).toBe(99 * 2);
  });

  it("[I02-02][AC-03][grid] 容量恰好容纳 N_max ⇒ 不算 capped（边界）", () => {
    const space = spaceOf({}, budget({ maxStates: 396 }));
    expect(space.grid.phaseSteps).toBe(space.grid.N_max);
    expect(space.grid.phaseGridCapped).toBe(false);
    expect(space.grid.stateCapacity).toBe(396);
  });

  it("[I02-02][AC-03][grid] N<2 ⇒ IE grid-resolution-infeasible / phase-grid-infeasible", () => {
    const failure = spaceFailure({}, budget({ maxStates: 150 }));
    expect(failure.reason).toBe("grid-resolution-infeasible");
    expect(failure.gap).toBe("phase-grid-infeasible");
  });

  it("[I02-02][AC-03][grid] 非法周期 ⇒ IE grid-resolution-infeasible / period-invalid", () => {
    for (const periodMs of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const failure = spaceFailure({}, budget(), periodMs);
      expect(failure.reason).toBe("grid-resolution-infeasible");
      expect(failure.gap).toBe("period-invalid");
    }
  });

  it("[I02-02][AC-03][grid] 相位格边界逐位连续（k=N−1 折到下一个周期）", () => {
    const space = spaceOf();
    const grid = space.grid;
    for (let k = 0; k < grid.phaseSteps - 1; k++) {
      expect(witnessPhaseCellBounds(grid, k).t1).toBe(witnessPhaseCellBounds(grid, k + 1).t0);
    }
    expect(witnessPhaseCellBounds(grid, grid.phaseSteps - 1)).toEqual({ t0: 150, t1: 200 });
    expect(witnessPhaseCellBounds(grid, 0, 1)).toEqual({ t0: 200, t1: 250 });
  });
});

// ── 2. 走廊与 spawn ─────────────────────────────────────────────────────────

describe("U2 静态走廊与精确 spawn", () => {
  it("[I02-02][AC-03][corridor] 走廊 = spawn 脚点 y 上的 standable 连通段（含 spawn）", () => {
    const space = spaceOf();
    expect(space.corridor).toEqual({ footY: 40, xLo: 1, xHi: 99, source: "standable-run" });
    expect(inStaticCorridor(space.corridor, 1)).toBe(true);
    expect(inStaticCorridor(space.corridor, 99)).toBe(true);
    expect(inStaticCorridor(space.corridor, 0)).toBe(false);
    expect(inStaticCorridor(space.corridor, 100)).toBe(false);
    expect(inStaticCorridor(space.corridor, 5.5)).toBe(false);
  });

  it("[I02-02][AC-03][corridor] solid 截断走廊；目标仍在段内时正常建格", () => {
    const space = spaceOf({ goalX: 15, wallX: 30, wallW: 2 });
    expect(space.corridor.xLo).toBe(1);
    expect(space.corridor.xHi).toBe(28);
    expect(space.arrival.goalStates).toEqual([12, 13, 14, 15, 16, 17, 18]);
  });

  it("[I02-02][AC-03][corridor] spawn 是无位移的脚点格，玩家盒由 boxFromFoot 派生", () => {
    const space = spaceOf();
    expect(space.spawn).toEqual({
      footX: 5,
      footY: 40,
      box: { x: 4, y: 20, w: 2, h: 20 },
      latticeAnchor: "foot-x",
    });
    expect(space.playerSize).toEqual({ w: 2, h: 20 });
  });

  it("[I02-02][AC-03][corridor] 非整数 spawn x / y ⇒ IE spawn-not-on-lattice，不得吸附", () => {
    for (const mutate of [
      (config: ReturnType<typeof witnessConfig>) => { config.player.at.x = 10.4; },
      (config: ReturnType<typeof witnessConfig>) => { config.player.at.y = 40.5; },
    ]) {
      const config = structuredClone(witnessConfig());
      mutate(config);
      const manifest = witnessManifest();
      const result = resolveWitnessSpace({ config, manifest, budget: budget(), periodMs: 200 });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.reason).toBe("spawn-not-on-lattice");
      expect(result.gap).toBe("spawn-foot-not-integer");
    }
  });

  it("[I02-02][AC-03][corridor] spawn 不在整数格时绝不 round() 到邻近格", () => {
    // 10.4 的邻近整数格 10 在走廊内且 standable；结果仍必须是 IE，而不是 (10, k)。
    const config = structuredClone(witnessConfig());
    config.player.at.x = 10.4;
    const manifest = witnessManifest();
    const result = resolveWitnessSpace({ config, manifest, budget: budget(), periodMs: 200 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.gap).toBe("spawn-foot-not-integer");
    const graph = buildMovementGraph(config, manifest);
    expect(graph?.standableAt(10, 40)).toBe(true);
  });

  it("[I02-02][AC-03][corridor] spawn 盒越界 / 压 solid / 脚点不可站 ⇒ 各自 IE 细分", () => {
    expect(spaceFailure({ spawnX: 0 })).toMatchObject({
      reason: "spawn-not-on-lattice", gap: "spawn-box-out-of-world",
    });
    expect(spaceFailure({ wallX: 5, wallW: 2 })).toMatchObject({
      reason: "spawn-not-on-lattice", gap: "spawn-box-overlaps-solid",
    });
    expect(spaceFailure({ spawnY: 30 })).toMatchObject({
      reason: "spawn-not-on-lattice", gap: "spawn-not-standable",
    });
  });

  it("[I02-02][AC-03][corridor] 禁止用 startCells() 的邻近落脚点替代真实 spawn", () => {
    const { config, manifest } = witnessWorld({ spawnY: 30 });
    const graph = buildMovementGraph(config, manifest);
    expect(graph).not.toBeNull();
    // startCells() 里确实有 (5, 40) 这个「宽松接位」落脚点……
    expect(graph?.startCells()).toContainEqual({ x: 5, y: 40 });
    // ……但 resolveWitnessSpace 不使用它，仍按真实 (5, 30) 判 IE。
    const result = resolveWitnessSpace({ config, manifest, budget: budget(), periodMs: 200 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("spawn-not-on-lattice");
    expect(result.gap).toBe("spawn-not-standable");
  });

  it("[I02-02][AC-03][corridor] 目标在走廊外 ⇒ IE goal-not-representable（不得推 PU）", () => {
    const failure = spaceFailure({ wallX: 20, wallW: 2 });
    expect(failure.reason).toBe("goal-not-representable");
    expect(failure.gap).toBe("goal-outside-corridor");
    // 失败侧没有证书 / 策略，不可能被下游当成 nb-candidate 或 pu-candidate。
    expect(failure).not.toHaveProperty("arrival");
  });

  it("[I02-02][AC-03][corridor] gate 缺失 / 资源缺失走 goal-not-representable 细分", () => {
    const missingGate = structuredClone(witnessConfig());
    missingGate.objective.gate = "nope";
    const manifest = witnessManifest();
    const result = resolveWitnessSpace({ config: missingGate, manifest, budget: budget(), periodMs: 200 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("goal-not-representable");
    expect(result.gap).toBe("gate-missing");
  });
});

// ── 3. 到达谓词 ─────────────────────────────────────────────────────────────

describe("U2 到达谓词（0.5px 内缩、状态边界）", () => {
  it("[I02-02][AC-03][arrival] 四边内缩 0.5px，到达状态与相位 k 无关", () => {
    const space = spaceOf();
    expect(space.arrival.predicate).toBe("overlapsStrict(playerBox, deflate(goalRect, 0.5))");
    expect(space.arrival.goalId).toBe("goal");
    expect(space.arrival.goalRect).toEqual({ x: 87, y: 20, w: 6, h: 20 });
    expect(space.arrival.deflatedGoalRect).toEqual({ x: 87.5, y: 20.5, w: 5, h: 19 });
    expect(space.arrival.goalStates).toEqual([87, 88, 89, 90, 91, 92, 93]);
    // 状态边界：goalStates 只由 footX 决定；每个 k 的同一 footX 都是到达状态。
    for (const footX of space.arrival.goalStates) {
      for (let k = 0; k < space.grid.phaseSteps; k++) {
        expect(witnessArrives(space.arrival, witnessPlayerBox(space, footX))).toBe(true);
      }
    }
  });

  it("[I02-02][AC-03][arrival] 0.5px 内缩把差 0.5px 的边界排除（奇数玩家宽）", () => {
    // 玩家宽 3 ⇒ 盒边落在半像素上，未内缩的 goalRect 会把 x=86 / x=94 也算到达。
    const space = spaceOf({ playerW: 3 });
    expect(space.arrival.goalRect).toEqual({ x: 87, y: 20, w: 6, h: 20 });
    expect(space.arrival.deflatedGoalRect).toEqual({ x: 87.5, y: 20.5, w: 5, h: 19 });
    expect(space.arrival.goalStates).toEqual([87, 88, 89, 90, 91, 92, 93]);
    for (const footX of [86, 94]) {
      const box = witnessPlayerBox(space, footX);
      expect(overlapsStrict(box, space.arrival.goalRect)).toBe(true); // 未内缩会误判到达
      expect(witnessArrives(space.arrival, box)).toBe(false);        // 内缩后必须拒绝
      expect(space.arrival.goalStates).not.toContain(footX);
    }
    for (const footX of [87, 93]) {
      expect(witnessArrives(space.arrival, witnessPlayerBox(space, footX))).toBe(true);
    }
  });

  it("[I02-02][AC-03][arrival] Goal Rect 退化 ⇒ IE goal-rect-degenerate", () => {
    const failure = spaceFailure({ goalW: 1, goalH: 1 });
    expect(failure.reason).toBe("goal-rect-degenerate");
    expect(failure.gap).toBe("goal-rect-degenerate");
  });

  it("[I02-02][AC-03][arrival] 没有合法格点满足谓词 ⇒ IE goal-not-representable", () => {
    const failure = spaceFailure({ wallX: 20, wallW: 2 });
    expect(failure.reason).toBe("goal-not-representable");
    expect(failure.gap).toBe("goal-outside-corridor");
  });

  it("[I02-02][AC-03][arrival] 玩家盒与解析几何同源：witnessPlayerBox == boxFromFoot", () => {
    const space = spaceOf();
    for (let footX = space.corridor.xLo; footX <= space.corridor.xHi; footX++) {
      expect(witnessPlayerBox(space, footX)).toEqual(
        boxFromFoot({ x: footX, y: space.spawn.footY }, space.playerSize),
      );
    }
  });
});

// ── 4. S1–S4 ────────────────────────────────────────────────────────────────

describe("U2 S1–S4 转移验证", () => {
  it("[I02-02][AC-03][S1] 跨 solid 的 move：真实走廊截断 + S1 连续扫掠都拒绝", () => {
    // 玩家宽 2、墙 1px；两端玩家盒都只与墙相切（standable），中间跨过墙。
    const space = spaceOf(
      { playerSpeed: 30, goalX: 12, wallX: 18, wallW: 1 },
      budget({ maxStates: 34 }),
    );
    expect(space.grid.maxStep).toBeCloseTo(3, 12);
    expect(space.corridor.xHi).toBe(17);
    const hazard = customHazard({ atX: 90, distance: 2 });

    // 真实走廊里 x=20 不是合法状态 ⇒ 转移无效（state），墙不可穿越。
    const natural = transition(space, hazard, { footX: 17, k: 0 }, { footX: 20, k: 1 });
    expect(natural.verified).toBe(false);
    expect(natural.failure).toBe("state");

    // 把走廊人为放宽到 22（仅用于单测 S1 分支）⇒ 端点 standable 且只与墙相切，
    // 但扫掠并集与墙正宽度重叠 ⇒ S1 必须判 static（不是端点采样）。
    const widened: WitnessSpace = {
      ...space,
      corridor: { ...space.corridor, xHi: 22 },
    };
    expect(overlapsStrict(witnessPlayerBox(space, 17), { x: 18, y: 20, w: 1, h: 20 })).toBe(false);
    expect(overlapsStrict(witnessPlayerBox(space, 20), { x: 18, y: 20, w: 1, h: 20 })).toBe(false);
    const synthetic = transition(widened, hazard, { footX: 17, k: 0 }, { footX: 20, k: 1 });
    expect(synthetic.verified).toBe(false);
    expect(synthetic.failure).toBe("static");
  });

  it("[I02-02][AC-04][S2] Hazard 连续碰撞：wait 端点安全、区间内碰撞仍是 hazard", () => {
    const space = spaceOf();
    // 玩家在 x=7，Hazard 在格 [66.67,133.33] 内从 x=1 扫到 x=5 再返回。
    const hazard = customHazard({ atX: -7, distance: 12, periodMs: 200 });
    const n3 = spaceOf({ playerSpeed: 30 }, budget({ maxStates: 300 }));
    const wait = transition(n3, hazard, { footX: 7, k: 1 }, { footX: 7, k: 2 });
    expect(wait.verified).toBe(false);
    expect(wait.failure).toBe("hazard");
    // 端点姿态本身都不碰撞（只查端点会漏）。
    const box = witnessPlayerBox(n3, 7);
    for (const t of [200 / 3, 400 / 3]) {
      const instant = intersectContinuous({
        motion: hazard.motion, hazard: hazard.box, playerBox: box,
        playerSpeedX: 0, t0: t, t1: t,
      });
      expect(instant.ok).toBe(true);
      if (instant.ok) expect(instant.intervals).toEqual([]);
    }
    // 同一条转移在 N=4 的相位格（cell 1 = [50,100]）里也按整格检查：
    // t=100 的姿态 [3,7] 与玩家 [6,8] 正宽度重叠 ⇒ 仍然失败。
    const coarser = transition(space, hazard, { footX: 7, k: 1 }, { footX: 7, k: 2 });
    expect(coarser.verified).toBe(false);
    expect(coarser.failure).toBe("hazard");
  });

  it("[I02-02][AC-04][S2] lagPad 按单调段方向加宽：上升段右扩、下降段左扩", () => {
    const space = spaceOf();
    const rising = customHazard({ atX: 47, distance: 10, periodMs: 200 });
    // t=50 时锚点 x=52、盒 [50,54]；玩家 [54,56] 只相切。
    expect(transition(space, rising, { footX: 55, k: 0 }, { footX: 55, k: 1 }, 0).verified).toBe(true);
    const risingPadded = transition(space, rising, { footX: 55, k: 0 }, { footX: 55, k: 1 }, 20);
    expect(risingPadded.verified).toBe(false);
    expect(risingPadded.failure).toBe("hazard");

    const falling = customHazard({ atX: 57, distance: 10, periodMs: 200 });
    // t=150 时锚点 x=62、盒 [60,64]；玩家 [58,60] 只相切。
    expect(transition(space, falling, { footX: 59, k: 2 }, { footX: 59, k: 3 }, 0).verified).toBe(true);
    const fallingPadded = transition(space, falling, { footX: 59, k: 2 }, { footX: 59, k: 3 }, 20);
    expect(fallingPadded.verified).toBe(false);
    expect(fallingPadded.failure).toBe("hazard");
  });

  it("[I02-02][AC-03][S2] 折返点切段：跨折返点的相位格被切成 2 段", () => {
    const space = spaceOf({ playerSpeed: 30 }, budget({ maxStates: 300 }));
    const hazard = customHazard({ atX: 90, distance: 2 });
    for (const k of [0, 1, 2]) {
      const check = transition(space, hazard, { footX: 5, k }, { footX: 5, k: (k + 1) % 3 });
      expect(check.verified).toBe(true);
      expect(check.segments).toBe(k === 1 ? 2 : 1);
      expect(check.cutPoints).toBe(0);
      expect(check.t0).toBe(witnessPhaseCellBounds(space.grid, k).t0);
      expect(check.t1).toBe(witnessPhaseCellBounds(space.grid, k).t1);
    }
  });

  it("[I02-02][AC-03][S3] 相位 / 时间：跨格、回退相位、越界 k、非整数 cycle ⇒ phase", () => {
    const space = spaceOf();
    const hazard = witnessHazard({ hazardY: 20 });
    expect(transition(space, hazard, { footX: 5, k: 0 }, { footX: 5, k: 2 }).failure).toBe("phase");
    expect(transition(space, hazard, { footX: 5, k: 0 }, { footX: 5, k: 0 }).failure).toBe("phase");
    expect(transition(space, hazard, { footX: 5, k: 4 }, { footX: 5, k: 1 }).failure).toBe("phase");
    const badCycle = verifyTransition({
      space, hazard, lagMs: 0, from: { footX: 5, k: 0 }, to: { footX: 5, k: 1 },
      cycle: 0.5, budget: workBudget(),
    });
    expect(badCycle.failure).toBe("phase");
    expect(badCycle.verified).toBe(false);
  });

  it("[I02-02][AC-03][S3] 非整数 / 走廊外状态与超速 move ⇒ state / speed", () => {
    const space = spaceOf();
    const hazard = witnessHazard({ hazardY: 20 });
    expect(transition(space, hazard, { footX: 5.5, k: 0 }, { footX: 6, k: 1 }).failure).toBe("state");
    expect(transition(space, hazard, { footX: 0, k: 0 }, { footX: 1, k: 1 }).failure).toBe("state");
    expect(transition(space, hazard, { footX: 5, k: 0 }, { footX: 7, k: 1 }).failure).toBe("speed");
    expect(transition(space, hazard, { footX: 5, k: 0 }, { footX: 6, k: 1 }).verified).toBe(true);
  });

  it("[I02-02][AC-03][S4] 链式连接：时间 / x / 相位连续；整周期偏移允许，其它断裂拒绝", () => {
    const space = spaceOf();
    const hazard = witnessHazard({ hazardY: 20 });
    const first = transition(space, hazard, { footX: 5, k: 0 }, { footX: 6, k: 1 });
    const second = transition(space, hazard, { footX: 6, k: 1 }, { footX: 6, k: 2 });
    expect(first.verified).toBe(true);
    expect(second.verified).toBe(true);
    expect(verifyTransitionChain(space, [first, second])).toEqual({ ok: true });
    // 整周期偏移：canonical 时间 + 周期（重放器允许）。
    const shifted: TransitionCheck = { ...second, t0: second.t0 - 200, t1: second.t1 - 200 };
    expect(verifyTransitionChain(space, [first, shifted])).toEqual({ ok: true });
    // 非 0 / 非 P 的时间断裂。
    const brokenTime: TransitionCheck = { ...second, t0: second.t0 + 1, t1: second.t1 + 1 };
    expect(verifyTransitionChain(space, [first, brokenTime])).toEqual({
      ok: false, index: 1, failure: "continuity",
    });
    // x 断裂。
    const brokenX: TransitionCheck = { ...second, from: { footX: 7, k: 1 } };
    expect(verifyTransitionChain(space, [first, brokenX])).toEqual({
      ok: false, index: 1, failure: "continuity",
    });
    // 相位不前进 1。
    const brokenPhase: TransitionCheck = { ...first, to: { footX: 6, k: 0 } };
    expect(verifyTransitionChain(space, [brokenPhase])).toEqual({
      ok: false, index: 0, failure: "continuity",
    });
  });
});

// ── 5. 残差等待 ─────────────────────────────────────────────────────────────

describe("U2 残差等待（整格保守覆盖）", () => {
  it("[I02-02][AC-04][residual] 输出 symbolic / conservative-over-cell，不是逐 φ0 采样", () => {
    const { space, hazard } = safeWorld();
    const check = verifyResidualWait({ space, hazard, lagMs: 0, cell: 2, budget: workBudget() });
    expect(check.verified).toBe(true);
    expect(check.symbolic).toBe(true);
    expect(check.residualWait).toBe("conservative-over-cell");
    expect(check.t0).toEqual({ kind: "cell-start", cell: 2, symbolic: true });
    expect(check.t1).toBe(witnessPhaseCellBounds(space.grid, 2).t1);
    expect(check.failure).toBeNull();
    // 数据形状只表达「整格覆盖」，没有「每个具体 φ0 已验证」的字段。
    expect(Object.keys(check).sort()).toEqual(
      ["budgetStop", "cell", "failure", "residualWait", "segments", "symbolic", "t0", "t1", "verified"],
    );
  });

  it("[I02-02][AC-04][residual] 只查格端点的反例：端点安全、格中穿过 spawn ⇒ 该格失败", () => {
    const space = spaceOf({ playerSpeed: 30 }, budget({ maxStates: 300 }));
    // cell 1 = [66.67,133.33] 跨 t=100 折返点；端点 Hazard 盒 [−1,3] 与 spawn [4,6] 分离，
    // 折返点姿态 [3,7] 与 spawn 正宽度重叠。
    const hazard = customHazard({ atX: -7, distance: 12, periodMs: 200 });
    const spawnBox = space.spawn.box;
    for (const t of [200 / 3, 400 / 3]) {
      const instant = intersectContinuous({
        motion: hazard.motion, hazard: hazard.box, playerBox: spawnBox,
        playerSpeedX: 0, t0: t, t1: t,
      });
      expect(instant.ok).toBe(true);
      if (instant.ok) expect(instant.intervals).toEqual([]);
    }
    const check = verifyResidualWait({ space, hazard, lagMs: 0, cell: 1, budget: workBudget() });
    expect(check.verified).toBe(false);
    expect(check.failure).toBe("hazard");
  });

  it("[I02-02][AC-04][residual] 折返点全程切段：安全格的 segments ≥ 2", () => {
    const space = spaceOf({ playerSpeed: 30 }, budget({ maxStates: 300 }));
    const hazard = customHazard({ atX: 90, distance: 2 });
    const check = verifyResidualWait({ space, hazard, lagMs: 0, cell: 1, budget: workBudget() });
    expect(check.verified).toBe(true);
    expect(check.segments).toBe(2);
  });

  it("[I02-02][AC-04][residual] 相切不算撞、正宽度才算撞（无最小安全窗口）", () => {
    const space = spaceOf();
    const tangent: WitnessHazard = {
      motion: triangleMotion({ atX: 2, atY: 40, distance: 0, periodMs: 200 }),
      box: hazardSpec({ w: 4, h: 12 }),
    };
    // Hazard 盒 [0,4] 与 spawn [4,6] 只贴边。
    const safe = verifyResidualWait({ space, hazard: tangent, lagMs: 0, cell: 0, budget: workBudget() });
    expect(safe.verified).toBe(true);
    // 0.5px 正宽度重叠就必须失败。
    const overlap: WitnessHazard = {
      motion: triangleMotion({ atX: 2.25, atY: 40, distance: 0, periodMs: 200 }),
      box: hazardSpec({ w: 4, h: 12 }),
    };
    const collided = verifyResidualWait({ space, hazard: overlap, lagMs: 0, cell: 0, budget: workBudget() });
    expect(collided.verified).toBe(false);
    expect(collided.failure).toBe("hazard");
  });
});

// ── 6. W：最小不动点、全相位、rank ──────────────────────────────────────────

describe("U2 全相位 Winning Set", () => {
  it("[I02-02][AC-03][W] 安全走廊：complete、覆盖全部 N 个相位格、rank 严格递减", () => {
    const { space, hazard } = safeWorld();
    const result = runW(space, hazard);
    expect(result.status).toBe("complete");
    expect(result.degradationReason).toBeNull();
    expect(result.phaseCoverage).toEqual({
      cells: space.grid.phaseSteps,
      coveredPhases: [0, 1, 2, 3],
      uncoveredPhases: [],
      complete: true,
    });
    expect(result.phases).toHaveLength(space.grid.phaseSteps);
    for (let k = 0; k < space.grid.phaseSteps; k++) {
      const phase = nth(result.phases, k);
      expect(phase.cell).toBe(k);
      expect(phase.covered).toBe(true);
      expect(phase.residualWait.verified).toBe(true);
      expect(phase.aligned).toEqual(aligned(space.spawn.footX, k, space.grid.phaseSteps));
      expect(phase.alignedWinning).toBe(true);
    }
    expect(result.winningStates).toBe(space.grid.stateCapacity);

    for (const entry of result.policy) {
      if (entry.transition === null) {
        expect(entry.rank).toBe(0);
        expect(space.arrival.goalStates).toContain(entry.state.footX);
        continue;
      }
      expect(entry.transition.verified).toBe(true);
      const successor = policyEntry(result.policy, entry.transition.to.footX, entry.transition.to.k);
      expect(successor).toBeDefined();
      expect(successor?.rank).toBe(entry.rank - 1);
    }
  });

  it("[I02-02][AC-03][W] 最小不动点 μX.(Goal ∪ Pre∃(X))，不是最大不动点", () => {
    // 永久屏障：hazard 在整周期内覆盖 [48,56]，玩家无法从 spawn 侧穿过。
    const options: WitnessWorldOptions = { hazardDistance: 4, hazardW: 2, hazardH: 8 };
    const space = spaceOf(options);
    const hazard = witnessHazard(options);
    const result = runW(space, hazard);

    // 失败仍只能 IE：不覆盖全部相位格，没有 Witness。
    expect(result.status).toBe("failed");
    expect(result.degradationReason).toBe("no-witness-found");
    expect(result.phaseCoverage.complete).toBe(false);

    // spawn 侧的 wait 边逐条安全（可以在里面安全地无限等待），但永远到不了 Goal。
    expect(transition(space, hazard, { footX: 5, k: 0 }, { footX: 5, k: 1 }).verified).toBe(true);
    expect(transition(space, hazard, { footX: 5, k: 1 }, { footX: 5, k: 2 }).verified).toBe(true);
    // 最大不动点会把「安全但永不到达」的 spawn 列也算进 W；最小不动点不会。
    for (let k = 0; k < space.grid.phaseSteps; k++) {
      expect(policyEntry(result.policy, 5, k)).toBeUndefined();
    }
    const minWinningX = Math.min(...result.policy.map((entry) => entry.state.footX));
    expect(minWinningX).toBeGreaterThan(5);
    expect(result.policy.some((entry) =>
      space.arrival.goalStates.includes(entry.state.footX) && entry.rank === 0)).toBe(true);

    // 这个「安全循环、无终止 rank」的东西不能被编码成 Witness。
    const encoded = encodeWitness({
      form: "winning-set", space, hazard, lagMs: 0, budget: budget(), result,
    });
    expect(encoded.ok).toBe(false);
    if (encoded.ok) return;
    expect(encoded.reason).toBe("no-witness-found");
    expect(encoded).not.toHaveProperty("witness");
  });

  it("[I02-02][AC-03][W] Hazard 穿过 spawn 的相位格不覆盖 ⇒ failed + uncoveredPhases", () => {
    const options: WitnessWorldOptions = { hazardX: 5, hazardDistance: 10 };
    const space = spaceOf(options);
    const result = runW(space, witnessHazard(options));
    expect(result.status).toBe("failed");
    expect(result.degradationReason).toBe("no-witness-found");
    expect(result.phaseCoverage.complete).toBe(false);
    expect(result.phaseCoverage.coveredPhases.length).toBeLessThan(space.grid.phaseSteps);
    expect(result.phaseCoverage.uncoveredPhases.length).toBeGreaterThan(0);
    expect(result.phases.some((phase) => !phase.residualWait.verified)).toBe(true);
  });
});

// ── 7. U9 安全等待格 ────────────────────────────────────────────────────────

describe("U2 U9 安全等待格证书", () => {
  it("[I02-02][AC-03][U9] 四项：standable、∀k 接近、整周期等待、∃ψ 出口", () => {
    const { space, hazard } = safeWorld();
    const result = runU9(space, hazard);
    expect(result.status).toBe("complete");
    expect(result.degradationReason).toBeNull();
    expect(result.failure).toBeNull();

    const cell = result.waitingCell;
    expect(cell).not.toBeNull();
    if (cell === null) return;
    expect(isValidWaitingCell(space, cell.footX)).toBe(true);
    expect(cell.footY).toBe(space.spawn.footY);
    expect(cell.corridor).toBe("spawn-foot-y-run");
    expect(cell.playerBox).toEqual(witnessPlayerBox(space, cell.footX));
    expect(space.graph.standableAt(cell.footX, cell.footY)).toBe(true);

    // 接近段：∀k（整格残差等待 + 对齐状态 rank ≥ 0）。
    const approach = result.approach;
    expect(approach).not.toBeNull();
    if (approach === null) return;
    expect(approach.phaseCoverage).toEqual({
      cells: space.grid.phaseSteps,
      coveredPhases: [0, 1, 2, 3],
      uncoveredPhases: [],
      complete: true,
    });
    expect(approach.phases).toHaveLength(space.grid.phaseSteps);
    for (let k = 0; k < space.grid.phaseSteps; k++) {
      const phase = nth(approach.phases, k);
      expect(phase.covered).toBe(true);
      expect(phase.residualWait.verified).toBe(true);
      expect(phase.residualWait.symbolic).toBe(true);
      expect(phase.rank).toBeGreaterThanOrEqual(0);
      expect(phase.aligned).toEqual(aligned(space.spawn.footX, k, space.grid.phaseSteps));
      expect(phase.tArrival).not.toBeNull();
    }
    // 接近段策略每条转移都 verified，rank 严格递减到 s（rank 0）。
    for (const entry of approach.policy) {
      if (entry.transition === null) {
        expect(entry.rank).toBe(0);
        expect(entry.state.footX).toBe(cell.footX);
        continue;
      }
      expect(entry.transition.verified).toBe(true);
      const successor = policyEntry(approach.policy, entry.transition.to.footX, entry.transition.to.k);
      expect(successor?.rank).toBe(entry.rank - 1);
    }

    // 出口段：∃ψ，一条 rank 严格递减到 Goal 的链。
    const exit = result.exit;
    expect(exit).not.toBeNull();
    if (exit === null) return;
    expect(exit.footX).toBe(cell.footX);
    expect(exit.phase).toBeGreaterThanOrEqual(0);
    expect(exit.phase).toBeLessThan(space.grid.phaseSteps);
    expect(exit.policy).toHaveLength(exit.rank + 1);
    expect(nth(exit.policy, 0).state).toEqual({ footX: cell.footX, k: exit.phase });
    expect(space.arrival.goalStates).toContain(exit.goalState.footX);
    expect(exit.goalState).toEqual(nth(exit.policy, exit.policy.length - 1).state);
    for (const entry of exit.policy) {
      const successor = entry.transition === null ? null : entry.transition.to;
      if (successor === null) {
        expect(entry.rank).toBe(0);
        continue;
      }
      expect(entry.transition?.verified).toBe(true);
      expect(successor.k).toBe((entry.state.k + 1) % space.grid.phaseSteps);
    }

    expect(result.termination).toEqual({
      kind: "strictly-decreasing-rank",
      approachRanks: [4, 4, 4, 4],
      approachMaxRank: 4,
      exitRank: exit.rank,
    });
  });

  it("[I02-02][AC-03][U9] 整周期等待：在 [T_arr, T_arr+P] 上切段，所有段用同一 lagPad", () => {
    const { space } = safeWorld();
    const hazard = witnessHazard({ hazardY: 20 });
    const lagMs = 16.67;
    const result = runU9(space, hazard, lagMs);
    expect(result.status).toBe("complete");
    const stay = result.stay;
    expect(stay).not.toBeNull();
    if (stay === null) return;
    expect(stay.verified).toBe(true);
    expect(stay.failure).toBeNull();
    expect(stay.periodMs).toBe(space.grid.periodMs);
    expect(stay.tEnd - stay.tArrival).toBe(space.grid.periodMs);
    expect(stay.turnarounds).toEqual([500]);
    expect(stay.segments).toHaveLength(2);
    expect(stay.segments.map((segment) => segment.direction)).toEqual(["rising", "falling"]);
    const hazardSpeed = triangleMaxRate(hazard.motion);
    expect(stay.hazardSpeed).toBeCloseTo(hazardSpeed, 12);
    expect(stay.lagPad).toBeCloseTo(hazardSpeed * lagMs, 12);
    let cursor = stay.tArrival;
    for (const segment of stay.segments) {
      expect(segment.t0).toBe(cursor);
      expect(segment.t1).toBeGreaterThan(segment.t0);
      expect(segment.lagPad).toBeCloseTo(Math.abs(segment.slope) * lagMs, 12);
      expect(segment.collided).toBe(false);
      expect(segment.collisionIntervals).toEqual([]);
      cursor = segment.t1;
    }
    expect(cursor).toBe(stay.tEnd);
  });

  it("[I02-02][AC-03][U9] 同一 pad 贯穿接近 / 等待 / 出口（不借用另一档 lag）", () => {
    const { space } = safeWorld();
    const hazard = witnessHazard({ hazardY: 20 });
    const result = runU9(space, hazard, 200);
    expect(result.status).toBe("complete");
    if (result.stay === null) return;
    const hazardSpeed = triangleMaxRate(hazard.motion);
    expect(result.stay.lagPad).toBeCloseTo(hazardSpeed * 200, 12);
    for (const segment of result.stay.segments) {
      expect(segment.lagPad).toBeCloseTo(Math.abs(segment.slope) * 200, 12);
    }
  });

  it("[I02-02][AC-03][U9] 前置：coverage.temporal 不是 checked / 几何不可信 ⇒ IE geometry-untrusted", () => {
    const { space, hazard } = safeWorld();
    const partial = runU9(space, hazard, 0, {}, {
      temporalCoverage: "partial", playerGeometryTrusted: true,
    });
    expect(partial.status).toBe("insufficient");
    expect(partial.degradationReason).toBe("geometry-untrusted");
    expect(partial.failure).toBe("temporal-coverage");
    expect(partial.waitingCell).toBeNull();

    const untrusted = runU9(space, hazard, 0, {}, {
      temporalCoverage: "checked", playerGeometryTrusted: false,
    });
    expect(untrusted.status).toBe("insufficient");
    expect(untrusted.degradationReason).toBe("geometry-untrusted");
    expect(untrusted.failure).toBe("player-geometry");
  });

  it("[I02-02][AC-04][U9] Hazard 覆盖 spawn ⇒ residual-wait 失败，无等待格证书", () => {
    const options: WitnessWorldOptions = { hazardX: 5, hazardDistance: 10 };
    const space = spaceOf(options);
    const result = runU9(space, witnessHazard(options));
    expect(result.status).toBe("failed");
    expect(result.failure).toBe("residual-wait");
    expect(result.degradationReason).toBe("no-witness-found");
    expect(result.waitingCell).toBeNull();
    expect(result.approach).toBeNull();
    expect(result.stay).toBeNull();
    expect(result.exit).toBeNull();
  });

  it("[I02-02][AC-03][U9] 无可用等待格 ⇒ failed no-waiting-cell（仍只 IE）", () => {
    const options: WitnessWorldOptions = { hazardDistance: 4, hazardW: 2, hazardH: 8 };
    const space = spaceOf(options);
    const result = runU9(space, witnessHazard(options));
    expect(result.status).toBe("failed");
    expect(result.failure).toBe("no-waiting-cell");
    expect(result.degradationReason).toBe("no-witness-found");
    expect(result.waitingCell).toBeNull();
  });
});

// ── 8. Witness 编码 ─────────────────────────────────────────────────────────

describe("U2 Witness 编码、体积与确定性", () => {
  it("[I02-02][AC-03][witness] D9 形状：policy + verification，信封字段齐全", () => {
    const { space, hazard } = safeWorld();
    const result = runW(space, hazard);
    const encoded = encodeWitness({
      form: "winning-set", space, hazard, lagMs: 0, budget: budget(), result,
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const witness = encoded.witness;
    expect(Object.keys(witness).sort()).toEqual(
      ["derived", "form", "phaseCoverage", "policy", "termination", "verifications", "volume"],
    );
    expect(witness.form).toBe("winning-set");
    expect(witness.derived).toBe(true);
    expect(witness.phaseCoverage).toEqual({ cells: 4, covered: 4, complete: true });
    expect(witness.termination.kind).toBe("rank");
    if (witness.termination.kind === "rank") {
      expect(witness.termination.rank).toHaveLength(witness.verifications.length);
      expect(witness.termination.rank.every((rank) => rank >= 1)).toBe(true);
    }
    expect(witness.volume.transitions).toBe(witness.verifications.length);
    expect(witness.volume.bytes).toBe(encoded.bytes);
    expect(encoded.bytes).toBe(new TextEncoder().encode(encoded.serialized).length);
    for (const tuple of witness.verifications) {
      expect(tuple).toHaveLength(7);
      expect(tuple[6]).toBe(1);
    }
  });

  it("[I02-02][AC-03][witness] policy 只引用 verified = 1 的记录", () => {
    const { space, hazard } = safeWorld();
    const result = runW(space, hazard);
    const encoded = encodeWitness({
      form: "winning-set", space, hazard, lagMs: 0, budget: budget(), result,
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.witness.policy.length).toBeGreaterThan(0);
    for (const index of encoded.witness.policy) {
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(encoded.witness.verifications.length);
      expect(nth(encoded.witness.verifications, index)[6]).toBe(1);
    }
    // 每条 policy 引用的转移都能用同一套派生几何重放并再次验证。
    for (const tuple of encoded.witness.verifications) {
      const replayed = verifyTransition({
        space, hazard, lagMs: 0,
        from: { footX: tuple[0], k: tuple[1] },
        to: { footX: tuple[2], k: tuple[3] },
        budget: workBudget(),
      });
      expect(replayed.verified).toBe(true);
      expect(replayed.t0).toBe(tuple[4]);
      expect(replayed.t1).toBe(tuple[5]);
      expect(witnessPlayerBox(space, tuple[0])).toEqual(
        boxFromFoot({ x: tuple[0], y: space.spawn.footY }, space.playerSize),
      );
      expect(witnessPlayerBox(space, tuple[2])).toEqual(
        boxFromFoot({ x: tuple[2], y: space.spawn.footY }, space.playerSize),
      );
    }
  });

  it("[I02-02][AC-03][witness] 确定性序列化：两次独立运行逐字节相同", () => {
    const encodeOnce = () => {
      const { space, hazard } = safeWorld();
      const result = runW(space, hazard);
      const encoded = encodeWitness({
        form: "winning-set", space, hazard, lagMs: 0, budget: budget(), result,
      });
      if (!encoded.ok) throw new Error(`expected encoding, got ${encoded.reason}`);
      return encoded;
    };
    const first = encodeOnce();
    const second = encodeOnce();
    expect(first.serialized).toBe(second.serialized);
    expect(first.bytes).toBe(second.bytes);
    expect(first.witness.verifications).toEqual(second.witness.verifications);
    expect(first.witness.policy).toEqual(second.witness.policy);
    expect(first.witness.termination).toEqual(second.witness.termination);
    // 序列化 = Witness 去掉 volume 的规范化 JSON（键序 / 数字 / 数组保序）。
    const semantic = {
      derived: first.witness.derived,
      form: first.witness.form,
      phaseCoverage: first.witness.phaseCoverage,
      policy: first.witness.policy,
      termination: first.witness.termination,
      verifications: first.witness.verifications,
    };
    expect(canonicalJson(semantic)).toBe(first.serialized);
  });

  it("[I02-02][AC-03][witness] 体积阈值：转移数 / 字节数超限 ⇒ witness-volume，无部分 Witness", () => {
    const { space, hazard } = safeWorld();
    const result = runW(space, hazard);
    for (const overrides of [
      { maxWitnessTransitions: 0 },
      { maxWitnessTransitions: 10 },
      { maxWitnessBytes: 1 },
      { maxWitnessBytes: 5_000 },
    ]) {
      const encoded = encodeWitness({
        form: "winning-set", space, hazard, lagMs: 0, budget: budget(overrides), result,
      });
      expect(encoded.ok).toBe(false);
      if (encoded.ok) continue;
      expect(encoded.reason).toBe("witness-volume");
      expect(encoded).not.toHaveProperty("witness");
      expect(encoded).not.toHaveProperty("serialized");
    }
    const invalid = encodeWitness({
      form: "winning-set", space, hazard, lagMs: 0,
      budget: budget({ maxWitnessBytes: -1 }), result,
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.reason).toBe("invalid-budget");
  });

  it("[I02-02][AC-03][witness] U9 编码：approach ∀k + 整周期 wait + ∃ψ exit，trace 有限", () => {
    const { space, hazard } = safeWorld();
    const result = runU9(space, hazard);
    expect(result.status).toBe("complete");
    const encoded = encodeWitness({ form: "u9", space, hazard, lagMs: 0, budget: budget(), result });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const witness = encoded.witness;
    expect(witness.form).toBe("u9");
    expect(witness.termination).toEqual({ kind: "trace", finite: true, length: 93 });
    expect(witness.phaseCoverage).toEqual({ cells: 4, covered: 4, complete: true });
    expect(witness.volume.transitions).toBe(witness.verifications.length);
    expect(witness.volume.bytes).toBe(encoded.bytes);
    for (const index of witness.policy) {
      expect(nth(witness.verifications, index)[6]).toBe(1);
    }
    // 停留段是 s 上的 N 个单格 wait（k 升序），不按 φ0 采样。
    const cell = result.waitingCell;
    expect(cell).not.toBeNull();
    if (cell === null) return;
    const stays = witness.verifications.filter(
      (tuple) => tuple[0] === cell.footX && tuple[2] === cell.footX,
    );
    expect(stays.map((tuple) => tuple[1])).toEqual([0, 1, 2, 3]);
  });

  it("[I02-02][AC-03][witness] 派生盒 == 解析盒：重放 U9 的每条记录都仍 verified", () => {
    const { space, hazard } = safeWorld();
    const result = runU9(space, hazard);
    const encoded = encodeWitness({ form: "u9", space, hazard, lagMs: 0, budget: budget(), result });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    for (const tuple of encoded.witness.verifications) {
      const replayed = verifyTransition({
        space, hazard, lagMs: 0,
        from: { footX: tuple[0], k: tuple[1] },
        to: { footX: tuple[2], k: tuple[3] },
        budget: workBudget(),
      });
      expect(replayed.verified).toBe(true);
      expect(replayed.t0).toBe(tuple[4]);
      expect(replayed.t1).toBe(tuple[5]);
    }
  });

  it("[I02-02][AC-03][witness] 结果不完整 / Hazard 非有限 ⇒ 失败且无部分 Witness", () => {
    const { space, hazard } = safeWorld();
    const empty: WinningSetResult = {
      status: "insufficient",
      degradationReason: "state-budget-exhausted",
      phaseCoverage: { cells: 4, coveredPhases: [], uncoveredPhases: [0, 1, 2, 3], complete: false },
      phases: [],
      policy: [],
      winningStates: 0,
      budgets: workBudget().finish(),
    };
    const encoded = encodeWitness({ form: "winning-set", space, hazard, lagMs: 0, budget: budget(), result: empty });
    expect(encoded.ok).toBe(false);
    if (!encoded.ok) expect(encoded.reason).toBe("state-budget-exhausted");
    expect(encoded).not.toHaveProperty("witness");

    const nonFinite = encodeWitness({
      form: "winning-set", space,
      hazard: { ...hazard, motion: { ...hazard.motion, distance: Number.NaN } },
      lagMs: 0, budget: budget(), result: empty,
    });
    expect(nonFinite.ok).toBe(false);
    if (!nonFinite.ok) expect(nonFinite.reason).toBe("model-out");
  });
});

// ── 9. 双档 lag ─────────────────────────────────────────────────────────────

describe("U2 双档 lag 独立 Witness", () => {
  it("[I02-02][AC-09][lag] 16.67ms / 200ms 各自独立编码，不共享 / 不拼接", () => {
    const { space, hazard } = safeWorld();
    const first = runU9(space, hazard, 16.67);
    const second = runU9(space, hazard, 200);
    expect(first.status).toBe("complete");
    expect(second.status).toBe("complete");
    const a = encodeWitness({ form: "u9", space, hazard, lagMs: 16.67, budget: budget(), result: first });
    const b = encodeWitness({ form: "u9", space, hazard, lagMs: 200, budget: budget(), result: second });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.witness).not.toBe(b.witness);
    // 每档都能独立复算字节数；两档的证明记录都来自各自的结果对象。
    expect(a.bytes).toBe(new TextEncoder().encode(a.serialized).length);
    expect(b.bytes).toBe(new TextEncoder().encode(b.serialized).length);
  });

  it("[I02-02][AC-09][lag] 把一档的 U9 停留记录接到另一档 ⇒ model-out", () => {
    const { space, hazard } = safeWorld();
    const result = runU9(space, hazard, 16.67);
    expect(result.status).toBe("complete");
    // 16.67ms 的 stay.lagPad / hazardSpeed 与 200ms 请求不一致 ⇒ 必须拒绝。
    const cross = encodeWitness({
      form: "u9", space, hazard, lagMs: 200, budget: budget(), result,
    });
    expect(cross.ok).toBe(false);
    if (!cross.ok) expect(cross.reason).toBe("model-out");

    // 换一份 Hazard（不同速度）同样不能复用旧停留记录。
    const otherHazard = customHazard({ atX: 50, atY: 20, distance: 4, periodMs: 200, w: 4, h: 12 });
    const crossHazard = encodeWitness({
      form: "u9", space, hazard: otherHazard, lagMs: 16.67, budget: budget(), result,
    });
    expect(crossHazard.ok).toBe(false);
    if (!crossHazard.ok) expect(crossHazard.reason).toBe("model-out");
  });
});

// ── 10. D3 §11 十三条反例 ───────────────────────────────────────────────────

describe("D3 §11 反例（必须失败 / 必须 IE）", () => {
  it("[I02-02][D3§11-#1] move 跨过 solid：真实走廊截断 + S1 连续扫掠都拒绝", () => {
    const space = spaceOf(
      { playerSpeed: 30, goalX: 12, wallX: 18, wallW: 1 },
      budget({ maxStates: 34 }),
    );
    const hazard = customHazard({ atX: 90, distance: 2 });
    expect(transition(space, hazard, { footX: 17, k: 0 }, { footX: 20, k: 1 }).failure).toBe("state");
    const widened: WitnessSpace = { ...space, corridor: { ...space.corridor, xHi: 22 } };
    expect(transition(widened, hazard, { footX: 17, k: 0 }, { footX: 20, k: 1 }).failure).toBe("static");
  });

  it("[I02-02][D3§11-#2] spawn 脚点 x = 10.4 ⇒ IE，不得从 footX=10 开始", () => {
    const config = structuredClone(witnessConfig());
    config.player.at.x = 10.4;
    const manifest = witnessManifest();
    const result = resolveWitnessSpace({ config, manifest, budget: budget(), periodMs: 200 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("spawn-not-on-lattice");
    expect(result.gap).toBe("spawn-foot-not-integer");
  });

  it("[I02-02][D3§11-#3] 未内缩的 Goal Rect 会把差 0.5px 判成到达", () => {
    const space = spaceOf({ playerW: 3 });
    for (const footX of [86, 94]) {
      const box = witnessPlayerBox(space, footX);
      expect(overlapsStrict(box, space.arrival.goalRect)).toBe(true);
      expect(witnessArrives(space.arrival, box)).toBe(false);
    }
    expect(space.arrival.goalStates).toEqual([87, 88, 89, 90, 91, 92, 93]);
  });

  it("[I02-02][D3§11-#4] 残差等待只查格端点会漏掉格中碰撞", () => {
    const space = spaceOf({ playerSpeed: 30 }, budget({ maxStates: 300 }));
    const hazard = customHazard({ atX: -7, distance: 12, periodMs: 200 });
    const check = verifyResidualWait({ space, hazard, lagMs: 0, cell: 1, budget: workBudget() });
    expect(check.verified).toBe(false);
    expect(check.failure).toBe("hazard");
  });

  it("[I02-02][D3§11-#5] wait 端点安全、区间内碰撞 ⇒ 该段失败（采样陷阱）", () => {
    const space = spaceOf({ playerSpeed: 30 }, budget({ maxStates: 300 }));
    const hazard = customHazard({ atX: -7, distance: 12, periodMs: 200 });
    const wait = transition(space, hazard, { footX: 7, k: 1 }, { footX: 7, k: 2 });
    expect(wait.verified).toBe(false);
    expect(wait.failure).toBe("hazard");
  });

  it("[I02-02][D3§11-#6] 预算耗尽虽已有安全前缀 ⇒ IE，不得输出 NB / 部分 witness", () => {
    const { space, hazard } = safeWorld();
    const result = runW(space, hazard, 0, { maxStates: 4 });
    expect(result.status).toBe("insufficient");
    expect(result.degradationReason).toBe("state-budget-exhausted");
    expect(result.policy).toEqual([]);
    expect(result.phases).toEqual([]);
    expect(result.winningStates).toBe(0);
    const encoded = encodeWitness({
      form: "winning-set", space, hazard, lagMs: 0, budget: budget(), result,
    });
    expect(encoded.ok).toBe(false);
    expect(encoded).not.toHaveProperty("witness");
  });

  it("[I02-02][D3§11-#7] 每边安全但形成循环、无终止 rank ⇒ 不是 Witness", () => {
    const options: WitnessWorldOptions = { hazardDistance: 4, hazardW: 2, hazardH: 8 };
    const space = spaceOf(options);
    const hazard = witnessHazard(options);
    const result = runW(space, hazard);
    expect(result.status).toBe("failed");
    expect(result.degradationReason).toBe("no-witness-found");
    // spawn 列的 wait 边都安全（可无限循环），但没有 rank ⇒ 不进策略。
    expect(transition(space, hazard, { footX: 5, k: 0 }, { footX: 5, k: 1 }).verified).toBe(true);
    expect(policyEntry(result.policy, 5, 0)).toBeUndefined();
  });

  it("[I02-02][D3§11-#8] 16.67ms 档记录接到 200ms 结论 ⇒ model-out", () => {
    const { space, hazard } = safeWorld();
    const result = runU9(space, hazard, 16.67);
    const cross = encodeWitness({
      form: "u9", space, hazard, lagMs: 200, budget: budget(), result,
    });
    expect(cross.ok).toBe(false);
    if (!cross.ok) expect(cross.reason).toBe("model-out");
  });

  it("[I02-02][D3§11-#9] 用 startCells() 邻近落脚点替代真实 spawn ⇒ 禁止", () => {
    const { config, manifest } = witnessWorld({ spawnY: 30 });
    expect(buildMovementGraph(config, manifest)?.startCells()).toContainEqual({ x: 5, y: 40 });
    const result = resolveWitnessSpace({ config, manifest, budget: budget(), periodMs: 200 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.gap).toBe("spawn-not-standable");
  });

  it("[I02-02][D3§11-#10] 目标在静态走廊外 ⇒ IE，不得输出 PU", () => {
    const failure = spaceFailure({ wallX: 20, wallW: 2 });
    expect(failure.reason).toBe("goal-not-representable");
    expect(failure.gap).toBe("goal-outside-corridor");
  });

  it("[I02-02][D3§11-#11] Goal Rect 退化 / 没有合法格点满足谓词 ⇒ IE", () => {
    expect(spaceFailure({ goalW: 1, goalH: 1 })).toMatchObject({
      reason: "goal-rect-degenerate", gap: "goal-rect-degenerate",
    });
    expect(spaceFailure({ wallX: 20, wallW: 2 })).toMatchObject({
      reason: "goal-not-representable", gap: "goal-outside-corridor",
    });
  });

  it("[I02-02][D3§11-#12] move 只查端点 standable、不做连续 S1 ⇒ 禁止", () => {
    const space = spaceOf(
      { playerSpeed: 30, goalX: 12, wallX: 18, wallW: 1 },
      budget({ maxStates: 34 }),
    );
    const hazard = customHazard({ atX: 90, distance: 2 });
    // 端点 standable 的玩家盒都与 [18,19] 只相切。
    for (const footX of [17, 20]) {
      expect(overlapsStrict(witnessPlayerBox(space, footX), { x: 18, y: 20, w: 1, h: 20 })).toBe(false);
    }
    const widened: WitnessSpace = { ...space, corridor: { ...space.corridor, xHi: 22 } };
    const check = transition(widened, hazard, { footX: 17, k: 0 }, { footX: 20, k: 1 });
    expect(check.verified).toBe(false);
    expect(check.failure).toBe("static");
  });

  it("[I02-02][D3§11-#13] 残差等待不得写成「全部具体 φ0 轨迹均已验证」", () => {
    const { space, hazard } = safeWorld();
    const check = verifyResidualWait({ space, hazard, lagMs: 0, cell: 0, budget: workBudget() });
    expect(check.symbolic).toBe(true);
    expect(check.residualWait).toBe("conservative-over-cell");
    expect(check.t0).toMatchObject({ kind: "cell-start", symbolic: true });
    expect(check).not.toHaveProperty("phi0");
    expect(check).not.toHaveProperty("traces");
  });
});

// ── 11. 预算 ────────────────────────────────────────────────────────────────

describe("U2 预算耗尽与墙钟 abort", () => {
  it("[I02-02][AC-08][budget] maxStates / maxEdges / maxCutsPerBranch 耗尽 ⇒ 实际原因码 + 无部分策略", () => {
    const { space, hazard } = safeWorld();
    const cases: readonly (readonly [string, Partial<BudgetProfile>, string])[] = [
      ["state", { maxStates: 4 }, "state-budget-exhausted"],
      ["edge", { maxEdges: 3 }, "edge-budget-exhausted"],
      ["cut", { maxCutsPerBranch: 0 }, "cut-budget-exhausted"],
    ];
    for (const [label, overrides, reason] of cases) {
      const result = runW(space, hazard, 0, overrides);
      expect(result.status, label).toBe("insufficient");
      expect(result.degradationReason, label).toBe(reason);
      expect(result.phaseCoverage.complete, label).toBe(false);
      expect(result.policy, label).toEqual([]);
      expect(result.phases, label).toEqual([]);
    }
  });

  it("[I02-02][AC-08][budget] 注入时钟越过 timeBudgetMs ⇒ wall-clock-abort", () => {
    const { space, hazard } = safeWorld();
    let now = 0;
    const profile = budget({ timeBudgetMs: 1, timeBudgetCheckpointWork: 1 });
    const result = searchWinningSet({
      space, hazard, lagMs: 0,
      budget: createWitnessWorkBudget({ profile, now: () => (now += 10) }),
    });
    expect(result.status).toBe("insufficient");
    expect(result.degradationReason).toBe("wall-clock-abort");
    expect(result.policy).toEqual([]);
  });

  it("[I02-02][AC-08][budget] maxCutsPerCheck 不在 U2 入口单独触发（预切段后无内部折返点）", () => {
    // U2 在调用连续求交前已按折返点切段 ⇒ 单次 check 没有内部 cut。
    // 用 0 验证「不依赖一次跨折返点的 check」；真正的 per-check 上限归 U1 原语。
    const space = spaceOf({ playerSpeed: 30 }, budget({ maxStates: 300 }));
    const hazard = customHazard({ atX: 90, distance: 2 });
    const check = transition(space, hazard, { footX: 5, k: 1 }, { footX: 5, k: 2 }, 0, { maxCutsPerCheck: 0 });
    expect(check.verified).toBe(true);
    expect(check.segments).toBe(2);
    expect(check.cutPoints).toBe(0);
  });

  it("[I02-02][AC-08][budget] U9 预算耗尽同样只 IE、不保留部分证书", () => {
    const { space, hazard } = safeWorld();
    for (const overrides of [{ maxStates: 4 }, { maxEdges: 3 }]) {
      const result = runU9(space, hazard, 0, overrides);
      expect(result.status).toBe("insufficient");
      expect(result.waitingCell).toBeNull();
      expect(result.approach).toBeNull();
      expect(result.stay).toBeNull();
      expect(result.exit).toBeNull();
      expect(result.termination).toBeNull();
    }
  });
});

// ── 12. 确定性 ──────────────────────────────────────────────────────────────

describe("U2 确定性", () => {
  it("[I02-02][AC-10][determinism] 同一输入重复运行：W 的 rank / 策略 / 转移逐项相同", () => {
    const run = () => {
      const { space, hazard } = safeWorld();
      return runW(space, hazard);
    };
    const first = run();
    const second = run();
    expect(first.status).toBe("complete");
    expect(second.status).toBe("complete");
    expect(first.phaseCoverage).toEqual(second.phaseCoverage);
    expect(first.winningStates).toBe(second.winningStates);
    expect(first.policy.map((entry) => [entry.state.footX, entry.state.k, entry.rank]))
      .toEqual(second.policy.map((entry) => [entry.state.footX, entry.state.k, entry.rank]));
    expect(first.policy.map((entry) => entry.transition === null ? null : entry.transition.to))
      .toEqual(second.policy.map((entry) => entry.transition === null ? null : entry.transition.to));
  });

  it("[I02-02][AC-10][determinism] encodeWitness 的 serialized / bytes 逐字节相同（无墙钟字段）", () => {
    const encodeOnce = () => {
      const { space, hazard } = safeWorld();
      const result = runW(space, hazard);
      const encoded = encodeWitness({
        form: "winning-set", space, hazard, lagMs: 0, budget: budget(), result,
      });
      if (!encoded.ok) throw new Error(`expected encoding, got ${encoded.reason}`);
      return encoded;
    };
    const first = encodeOnce();
    const second = encodeOnce();
    expect(first.serialized).toBe(second.serialized);
    expect(first.bytes).toBe(second.bytes);
    expect(first.serialized).not.toContain("wallClockMs");
  });
});
