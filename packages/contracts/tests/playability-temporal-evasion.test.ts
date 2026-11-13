// U4-02：`graph.ts` 的 `HopSampling` 可选尾参 —— 默认行为等价与稳定序列化回归。
// ⚠️ 本文件此阶段只承载尾参回归；U4 图割语义由后续票追加。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAssetPack, parseGameConfig, playerMoveOf } from "../src/index.js";
import { buildMovementGraph, hopEdges, hopSamples, hopTargets } from "../src/playability/graph.js";
import { computePermanentEvasion, withExactSpawnSeed } from "../src/playability/temporal-evasion.js";
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

  it("输出形状固定；图割已填充，hop 半部仍为 null", () => {
    expect(Object.keys(outcome).sort()).toEqual([
      "graphCut", "hopDoubling", "hopSamplingCoverage", "movementModelClosure", "reason", "status",
    ]);
    expect(outcome.status).toBe("INCOMPLETE");
    expect(outcome.reason).toBe("graph-cut-incomplete");
    expect(outcome.graphCut).not.toBeNull();
    expect(Object.keys(outcome.graphCut!).sort()).toEqual([
      "evidence", "goalIntersections", "midAirHits", "reachableFootpoints", "verdict",
    ]);
    expect(outcome.graphCut!.verdict).toBe("conditional");
    expect(outcome.hopDoubling).toBeNull();
    expect(outcome.hopSamplingCoverage).toBeNull();
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
      "./geometry.js", "./graph.js", "./reach.js", "./temporal-motion.js", "./temporal-budget.js", "./temporal-result.js",
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
