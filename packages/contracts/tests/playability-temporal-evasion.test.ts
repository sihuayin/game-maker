// U4-02：`graph.ts` 的 `HopSampling` 可选尾参 —— 默认行为等价与稳定序列化回归。
// ⚠️ 本文件此阶段只承载尾参回归；U4 图割语义由后续票追加。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAssetPack, parseGameConfig, playerMoveOf } from "../src/index.js";
import { buildMovementGraph, hopEdges, hopSamples, hopTargets } from "../src/playability/graph.js";
import {
  MOVEMENT_MODEL_CLOSURE, computePermanentEvasion, normalPositionsCovered, withExactSpawnSeed,
} from "../src/playability/temporal-evasion.js";
import type { MovementGraph } from "../src/playability/graph.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const MANIFEST = (() => {
  const p = parseAssetPack(JSON.parse(readFileSync(`${ROOT}fixtures/packs/last-train/v2/manifest.json`, "utf8")));
  if (!p.ok) throw new Error("夹具包本身就不过 schema：" + p.errors.join("；"));
  return p.value;
})();
const CONFIG = (() => {
  const c = parseGameConfig(JSON.parse(readFileSync(`${ROOT}fixtures/game-configs/last-train.json`, "utf8")));
  if (!c.ok) throw new Error("夹具配置本身就不过 schema：" + c.errors.join("；"));
  return c.value;
})();
const graph = (() => {
  const g = buildMovementGraph(CONFIG, MANIFEST);
  if (!g) throw new Error("夹具的玩家资源应该解得动");
  return g;
})();
const move = playerMoveOf(CONFIG);
const START = { x: 40, y: 250 } as const;
const EXPLICIT_DEFAULT = { hz: 60, maxSamples: 120 } as const;
const arcs = hopEdges(graph, START.x, START.y, move);

describe("U4-02 graph.ts HopSampling 尾参默认等价", () => {
  it("夹具在起点至少有一条跳跃弧（否则本组断言无意义）", () => {
    expect(arcs.length).toBeGreaterThan(0);
  });

  it("hopSamples：无参 ≡ 显式默认 ≡ 单项缺省", () => {
    for (const arc of arcs) {
      const implicit = hopSamples(graph, START.x, START.y, arc.x, arc.y, move);
      expect(implicit).not.toBeNull();
      expect(hopSamples(graph, START.x, START.y, arc.x, arc.y, move, EXPLICIT_DEFAULT)).toEqual(implicit);
      expect(hopSamples(graph, START.x, START.y, arc.x, arc.y, move, { hz: 60 })).toEqual(implicit);
      expect(hopSamples(graph, START.x, START.y, arc.x, arc.y, move, { maxSamples: 120 })).toEqual(implicit);
    }
  });

  it("hopEdges / hopTargets：显式默认与无参结果一致", () => {
    expect(hopEdges(graph, START.x, START.y, move, EXPLICIT_DEFAULT)).toEqual(arcs);
    expect(hopTargets(graph, START.x, START.y, move, EXPLICIT_DEFAULT))
      .toEqual(hopTargets(graph, START.x, START.y, move));
    expect(hopTargets(graph, START.x, START.y, move)).toEqual(arcs.map((e) => ({ x: e.x, y: e.y })));
  });

  it("默认档结果可稳定序列化（重复调用逐字节一致）", () => {
    const a = JSON.stringify(hopEdges(graph, START.x, START.y, move));
    const b = JSON.stringify(hopEdges(graph, START.x, START.y, move, EXPLICIT_DEFAULT));
    expect(a).toBe(b);
    expect(JSON.stringify(hopTargets(graph, START.x, START.y, move)))
      .toBe(JSON.stringify(hopTargets(graph, START.x, START.y, move, EXPLICIT_DEFAULT)));
  });

  it("倍档参数生效：120Hz / cap 240 在长弧上采样更密，端点不变（不要求精确 2×）", () => {
    const longest = arcs.reduce((best, edge) => (edge.samples.length > best.samples.length ? edge : best));
    expect(longest.samples.length).toBeGreaterThan(6); // 已脱离 n=6 下限
    const base = hopSamples(graph, START.x, START.y, longest.x, longest.y, move, EXPLICIT_DEFAULT);
    const doubled = hopSamples(graph, START.x, START.y, longest.x, longest.y, move, { hz: 120, maxSamples: 240 });
    expect(base).not.toBeNull();
    expect(doubled).not.toBeNull();
    expect(doubled!.length).toBeGreaterThan(base!.length);
    expect(doubled![0]).toEqual(base![0]);
    expect(doubled!.at(-1)).toEqual(base!.at(-1));
  });
});


describe("U4-04 图割半部 API 骨架与输入契约", () => {
  const INPUT = {
    spawnCell: START,
    goalRegion: { x: 64, y: 20, w: 60, h: 40 },
    gateRect: { x: 54, y: 20, w: 10, h: 40 },
    move,
    graph,
  } as const;
  const outcome = computePermanentEvasion(INPUT);
  const source = readFileSync(
    fileURLToPath(new URL("../src/playability/temporal-evasion.ts", import.meta.url)),
    "utf8",
  );
  // 注释里会提到被禁止的符号名；负向断言只看代码本体。
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("输出形状固定；图割与 hop 半部均已填充", () => {
    expect(Object.keys(outcome).sort()).toEqual([
      "graphCut", "hopDoubling", "hopSamplingCoverage", "movementModelClosure", "reason", "status",
    ]);
    expect(["COMPLETE", "INCOMPLETE"]).toContain(outcome.status);
    expect(outcome.graphCut).not.toBeNull();
    expect(Object.keys(outcome.graphCut!).sort()).toEqual([
      "evidence", "goalIntersections", "midAirHits", "reachableFootpoints", "verdict",
    ]);
    expect(outcome.graphCut!.verdict).toBe("conditional");
    expect(outcome.hopDoubling).not.toBeNull();
    expect(Object.keys(outcome.hopDoubling!).sort()).toEqual([
      "base", "connectivityPreserved", "doubled", "normalizedCoverage",
    ]);
    expect(Object.keys(outcome.hopDoubling!.base).sort()).toEqual(["cap", "endpoints", "n"]);
    expect(outcome.hopDoubling!.base.cap).toBe(120);
    expect(outcome.hopDoubling!.doubled.cap).toBe(240);
    expect(outcome.hopSamplingCoverage).not.toBeNull();
    expect(outcome.movementModelClosure).toBe("not-proven-air-control");
  });

  it("失败原因只取 D9 闭集的 U4 子集", () => {
    const allowed = new Set([
      "graph-cut-incomplete", "hop-sample-budget", "hop-doubling-changed",
      "movement-model-unclosed", "geometry-untrusted",
    ]);
    expect(outcome.reason === null || allowed.has(outcome.reason)).toBe(true);
    expect(source).not.toMatch(/reason\s*:\s*["'](?!graph-cut-incomplete)/);
  });

  it("确定性与无随机 / 时间依赖", () => {
    expect(source).not.toMatch(/Math\.random|Date\.now|performance\.now/);
    expect(JSON.stringify(computePermanentEvasion(INPUT))).toBe(JSON.stringify(outcome));
  });

  it("依赖边界：不 import temporal.ts / temporal-gate.ts / temporal-witness.ts", () => {
    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    const allowed = new Set([
      "./geometry.js", "./graph.js", "./reach.js", "./temporal-motion.js", "./temporal-budget.js", "./temporal-result.js", "../game-config.js",
    ]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(allowed.has(specifier as string), specifier).toBe(true);
    expect(source).not.toMatch(/from\s+["']\.\/temporal\.js["']/);
    expect(source).not.toMatch(/from\s+["']\.\/temporal-gate\.js["']/);
    expect(source).not.toMatch(/from\s+["']\.\/temporal-witness\.js["']/);
  });

  it("不新增公共 barrel 导出、无 analyze: / Symbol( / TEMPORAL_LAG_", () => {
    for (const barrel of [
      "packages/contracts/src/playability/index.ts",
      "packages/contracts/src/index.ts",
    ]) {
      expect(readFileSync(fileURLToPath(new URL(`../../../${barrel}`, import.meta.url)), "utf8"), barrel)
        .not.toContain("temporal-evasion");
    }
    expect(code).not.toMatch(/TEMPORAL_LAG_/);
    expect(code).not.toContain("Symbol(");
    expect(source).not.toMatch(/analyze\s*:/);
  });

  it("不调用 startCells()，不生成 U5 字段", () => {
    expect(code).not.toContain("startCells(");
    expect(code).not.toContain("puConditions");
    expect(code).not.toContain("geometryCoverage");
    expect(code).not.toContain("lagInvariantByConstruction");
  });
});


describe("U4-05 图割判据与 reach 消费", () => {
  const MOVE = { speed: 0.05, jumpVelocity: 0.3, gravity: 0.003 } as const;
  const SPAWN = { x: 2, y: 20 } as const;

  // 合成图：40×100。上层地板 x=0..5（脚点线 y=20），下层只有 x=6 一格（脚点线 y=90），
  // 其余为空域；玩家 4×6，跳跃顶点约 y=5。这样：
  //   - walk-off 从 (5,20) 掉到 (6,90)，fall 弧可在空中向右漂移；
  //   - hop 只能落回 x=6，覆盖不到右侧空域 ⇒ 目标可被 fall 弧「空中触达」。
  const synthGraph = (): MovementGraph => {
    const width = 40;
    const height = 100;
    const stride = height + 1;
    const blocked = new Uint8Array((width + 1) * stride);
    for (let x = 0; x <= 5; x++) blocked[x * stride + 21] = 1;
    blocked[6 * stride + 91] = 1;
    const forbidden = blocked.slice();
    const standable = new Uint8Array(blocked.length);
    for (let x = 0; x <= 5; x++) standable[x * stride + 20] = 1;
    standable[6 * stride + 90] = 1;
    const columns = Array.from({ length: width + 1 }, () => [] as number[]);
    for (let x = 0; x <= 5; x++) columns[x] = [20];
    columns[6] = [90];
    const inBounds = (x: number, y: number) => x >= 0 && x <= width && y >= 0 && y <= height;
    return {
      width, height, stride, blocked, forbidden, standable, columns,
      player: { size: { w: 4, h: 6 }, anchor: { x: 0.5, y: 1 }, foot: { x: 2, y: 20 }, coverage: "partial" },
      solids: [],
      coverage: "partial",
      freeAt: (x, y) => inBounds(x, y) && forbidden[x * stride + y] === 0,
      standableAt: (x, y) => inBounds(x, y) && standable[x * stride + y] === 1,
      startCells: () => [SPAWN],
    };
  };
  const run = (graph: MovementGraph, goalRegion: { x: number; y: number; w: number; h: number }) =>
    computePermanentEvasion({
      spawnCell: SPAWN,
      goalRegion,
      gateRect: { x: 0, y: 0, w: 1, h: 1 },
      move: MOVE,
      graph,
    });

  it("精确 spawn：输入图的 startCells 宽松多起点被覆盖为单一种子", () => {
    const g = synthGraph();
    const loose = { ...g, startCells: () => [SPAWN, { x: 30, y: 94 }] };
    const half = run(loose, { x: 30, y: 10, w: 2, h: 2 });
    expect(half.graphCut!.evidence).toContain("seeds=1");
    expect(withExactSpawnSeed(g, { x: 4, y: 20 }).startCells()).toEqual([{ x: 4, y: 20 }]);
    // 只替换种子函数，其余静态底座共享。
    expect(withExactSpawnSeed(g, SPAWN).freeAt(3, 20)).toBe(g.freeAt(3, 20));
    expect(withExactSpawnSeed(g, SPAWN).width).toBe(g.width);
  });

  it("可达目标：落脚点覆盖 => goalIntersections=1，verdict 仍为 conditional", () => {
    const half = run(synthGraph(), { x: 2, y: 14, w: 4, h: 6 });
    expect(half.graphCut!.goalIntersections).toBe(1);
    expect(half.graphCut!.verdict).toBe("conditional");
    expect(half.status).toBe("INCOMPLETE");
  });

  it("不可达目标：无落脚点、无空中触达 => 0 / 0，图割半部照常产出", () => {
    const half = run(synthGraph(), { x: 30, y: 10, w: 2, h: 2 });
    expect(half.graphCut!.goalIntersections).toBe(0);
    expect(half.graphCut!.midAirHits).toBe(0);
    expect(half.graphCut!.verdict).toBe("conditional");
    expect(half.graphCut!.reachableFootpoints).toBeGreaterThan(1);
  });

  it("mid-air 仅触达：midAirHits=1 且落脚点未覆盖（只作否决，不是正面证明）", () => {
    const half = run(synthGraph(), { x: 10, y: 50, w: 1, h: 2 });
    expect(half.graphCut!.goalIntersections).toBe(0);
    expect(half.graphCut!.midAirHits).toBe(1);
    expect(half.graphCut!.verdict).toBe("conditional");
  });

  it("evidence 确定性且 verdict 恒 conditional", () => {
    const g = synthGraph();
    const a = run(g, { x: 30, y: 10, w: 2, h: 2 }).graphCut!;
    const b = run(g, { x: 30, y: 10, w: 2, h: 2 }).graphCut!;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.evidence).toMatch(/^reach@full; seeds=1; footpoints=\d+; goalIntersections=0; midAirHits=0; verdict=conditional$/);
  });
});


const GAP_SPAWN = { x: 4, y: 20 } as const;
// 单位与夹具一致：px/s、px/s²。t = 2v/g = 0.2s，最大跳距 speed·t = 2px。
const DEFAULT_MOVE = { speed: 10, jumpVelocity: 90, gravity: 900 } as const;

// 合成图：左侧地板 x=0..4（脚点线 y=20），右侧平台 x=6..10，x=5 为空域。
// 只有 (4,20) → (6,20) 的 hop 弧能跨过缺口。
const gapGraph = (forbiddenCells: readonly (readonly [number, number])[] = []): MovementGraph => {
  const width = 40;
  const height = 100;
  const stride = height + 1;
  const blocked = new Uint8Array((width + 1) * stride);
  for (let x = 0; x <= 4; x++) blocked[x * stride + 21] = 1;
  for (let x = 6; x <= 10; x++) blocked[x * stride + 21] = 1;
  const forbidden = blocked.slice();
  for (const [x, y] of forbiddenCells) forbidden[x * stride + y] = 1;
  const standable = new Uint8Array(blocked.length);
  for (let x = 0; x <= 4; x++) standable[x * stride + 20] = 1;
  for (let x = 6; x <= 10; x++) standable[x * stride + 20] = 1;
  const columns = Array.from({ length: width + 1 }, () => [] as number[]);
  for (let x = 0; x <= 4; x++) columns[x] = [20];
  for (let x = 6; x <= 10; x++) columns[x] = [20];
  const inBounds = (x: number, y: number) => x >= 0 && x <= width && y >= 0 && y <= height;
  return {
    width, height, stride, blocked, forbidden, standable, columns,
    player: { size: { w: 4, h: 6 }, anchor: { x: 0.5, y: 1 }, foot: { x: 4, y: 20 }, coverage: "partial" },
    solids: [], coverage: "partial",
    freeAt: (x, y) => inBounds(x, y) && forbidden[x * stride + y] === 0,
    standableAt: (x, y) => inBounds(x, y) && standable[x * stride + y] === 1,
    startCells: () => [GAP_SPAWN],
  };
};
const runGap = (
  graph: MovementGraph,
  goalRegion: { x: number; y: number; w: number; h: number },
  move: { speed: number; jumpVelocity: number; gravity: number } = DEFAULT_MOVE,
) =>
  computePermanentEvasion({
    spawnCell: GAP_SPAWN, goalRegion, gateRect: { x: 0, y: 0, w: 1, h: 1 }, move, graph,
  });
const FAR_GOAL = { x: 30, y: 90, w: 2, h: 2 } as const;

describe("U4-06 hop 双档与规范化采样覆盖", () => {

  it("两档各自完整跑：记录 n / 端点 / cap，且 F1 ⊆ F2", () => {
    const half = runGap(gapGraph(), FAR_GOAL);
    expect(half.hopDoubling!.base.cap).toBe(120);
    expect(half.hopDoubling!.doubled.cap).toBe(240);
    expect(half.hopDoubling!.base.n).toBe(12);      // ceil(0.2s · 60Hz)
    expect(half.hopDoubling!.doubled.n).toBe(24);   // ceil(0.2s · 120Hz)
    expect(half.hopDoubling!.base.endpoints).toContainEqual([6, 20]);
    expect(half.hopDoubling!.normalizedCoverage).toBe(true);
    expect(half.hopSamplingCoverage).toEqual({ covered: true, method: "normalized" });
  });

  it("反例 10：判据是 F1 ⊆ F2，不是 n_doubled === 2·n_base", () => {
    expect(normalPositionsCovered(6, 12)).toBe(true);
    expect(normalPositionsCovered(12, 24)).toBe(true);
    expect(normalPositionsCovered(6, 18)).toBe(true);   // 3× 也覆盖，不要求恰好 2×
    expect(normalPositionsCovered(7, 13)).toBe(false);  // 13 不是 7 的倍数
  });

  it("覆盖不可证明 ⇒ hop-doubling-changed（n1=7 / n2=13）", () => {
    const move = { speed: 10, jumpVelocity: 47.25, gravity: 900 } as const; // t=0.105s
    const half = runGap(gapGraph(), FAR_GOAL, move);
    expect(half.hopDoubling!.base.n).toBe(7);
    expect(half.hopDoubling!.doubled.n).toBe(13);
    expect(half.hopDoubling!.normalizedCoverage).toBe(false);
    expect(half.hopSamplingCoverage).toEqual({ covered: false, method: "insufficient" });
    expect(half.status).toBe("INCOMPLETE");
    expect(half.reason).toBe("hop-doubling-changed");
  });

  it("cap 绑定 ⇒ hop-sample-budget", () => {
    const move = { speed: 10, jumpVelocity: 1000, gravity: 900 } as const; // t≈2.22s
    const half = runGap(gapGraph(), FAR_GOAL, move);
    expect(half.status).toBe("INCOMPLETE");
    expect(half.reason).toBe("hop-sample-budget");
  });

  it("反例 9：两档都跑，连通性变化被记录（n1=12 粗档跨过缺口，n2=24 密档被否）", () => {
    // 120Hz 独有采样点 (4,17) 落入禁区：粗档弧通过、密档弧被否 ⇒ 右侧平台只在粗档可达。
    const half = runGap(gapGraph([[4, 17]]), { x: 6, y: 14, w: 1, h: 1 });
    expect(half.hopDoubling!.connectivityPreserved).toBe(false);
    expect(half.hopDoubling!.base.endpoints).toContainEqual([6, 20]);
    expect(half.hopDoubling!.doubled.endpoints).not.toContainEqual([6, 20]);
    expect(half.status).toBe("INCOMPLETE");
    // 冻结映射：任一档目标可达 ⇒ graph-cut-incomplete（先于 hop 原因）。
    expect(half.reason).toBe("graph-cut-incomplete");
  });

  it("两档都不可达且覆盖成立 ⇒ COMPLETE、reason = null", () => {
    const half = runGap(gapGraph(), FAR_GOAL);
    expect(half.hopDoubling!.connectivityPreserved).toBe(true);
    expect(half.status).toBe("COMPLETE");
    expect(half.reason).toBeNull();
  });
});


describe("U4-07 模型闭合、降级映射与输出边界", () => {
  const COVER_MOVE = { speed: 10, jumpVelocity: 47.25, gravity: 900 } as const; // t=0.105s
  const CAP_MOVE = { speed: 10, jumpVelocity: 1000, gravity: 900 } as const;   // t≈2.22s
  const REACHABLE_GOAL = { x: 6, y: 14, w: 1, h: 1 } as const;
  const source = readFileSync(
    fileURLToPath(new URL("../src/playability/temporal-evasion.ts", import.meta.url)),
    "utf8",
  );
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const cases = [
    { name: "clean", half: runGap(gapGraph(), FAR_GOAL) },
    { name: "reachable", half: runGap(gapGraph(), REACHABLE_GOAL) },
    { name: "cap", half: runGap(gapGraph(), FAR_GOAL, CAP_MOVE) },
    { name: "coverage", half: runGap(gapGraph(), FAR_GOAL, COVER_MOVE) },
  ] as const;

  it("movementModelClosure 恒为 D9 冻结字面量，与 status / reason 无关", () => {
    expect(MOVEMENT_MODEL_CLOSURE).toBe("not-proven-air-control");
    for (const { half } of cases) {
      expect(half.movementModelClosure).toBe(MOVEMENT_MODEL_CLOSURE);
      expect(half.graphCut!.verdict).toBe("conditional");
    }
  });

  it("主降级原因按固定优先级映射，且只取 U4 闭集子集", () => {
    const reasonOf = (name: string) => cases.find((c) => c.name === name)!.half.reason;
    expect(reasonOf("clean")).toBeNull();
    expect(reasonOf("reachable")).toBe("graph-cut-incomplete");
    expect(reasonOf("cap")).toBe("hop-sample-budget");
    expect(reasonOf("coverage")).toBe("hop-doubling-changed");
    const allowed = new Set([
      "graph-cut-incomplete", "hop-sample-budget", "hop-doubling-changed",
      "movement-model-unclosed", "geometry-untrusted",
    ]);
    for (const { half } of cases) expect(half.reason === null || allowed.has(half.reason)).toBe(true);
  });

  it("COMPLETE ⇔ reason = null；COMPLETE 也不等于能力授权", () => {
    for (const { half } of cases) {
      expect(half.status === "COMPLETE").toBe(half.reason === null);
      expect(half.movementModelClosure).toBe("not-proven-air-control");
    }
  });

  it("输出边界：运行时只有六个键，不夹带 U5 / 公共字段", () => {
    const forbidden = [
      "puConditions", "geometryCoverage", "lagMode", "lagInvariantByConstruction",
      "certificate", "internalResult", "publicCapability", "publicVerdict", "puEligible",
    ];
    for (const { half } of cases) {
      const keys = Object.keys(half);
      expect(keys.sort()).toEqual([
        "graphCut", "hopDoubling", "hopSamplingCoverage", "movementModelClosure", "reason", "status",
      ]);
      for (const key of forbidden) expect(keys).not.toContain(key);
    }
  });

  it("反例 11：不把图割不连通写成 Runtime 不可达", () => {
    expect(code).not.toMatch(/runtimeUnreachable|provenUnplayable|PROVEN_UNPLAYABLE|runtime-unreachable/);
    expect(code).toContain('"not-proven-air-control"');
    expect(code).toContain("graph-cut-incomplete");
  });

  it("反例 12：模型未闭合 / coverage partial 时不发布 PU 或公共能力", () => {
    expect(code).not.toMatch(/certificate|internalResult|publicCapability|publicVerdict|puConditions/);
    expect(code).not.toMatch(/PROVEN_UNPLAYABLE/);
    for (const { half } of cases) expect(half.movementModelClosure).toBe("not-proven-air-control");
  });

  it("hopSamplingCoverage.covered 与 hopDoubling.normalizedCoverage 同源", () => {
    for (const { half } of cases) {
      expect(half.hopSamplingCoverage!.covered).toBe(half.hopDoubling!.normalizedCoverage);
      expect(half.hopSamplingCoverage!.method).toBe(
        half.hopSamplingCoverage!.covered ? "normalized" : "insufficient",
      );
    }
  });
});
