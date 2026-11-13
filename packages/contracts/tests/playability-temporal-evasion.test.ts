// U4-02：`graph.ts` 的 `HopSampling` 可选尾参 —— 默认行为等价与稳定序列化回归。
// ⚠️ 本文件此阶段只承载尾参回归；U4 图割语义由后续票追加。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAssetPack, parseGameConfig, playerMoveOf } from "../src/index.js";
import { buildMovementGraph, hopEdges, hopSamples, hopTargets } from "../src/playability/graph.js";
import { computePermanentEvasion } from "../src/playability/temporal-evasion.js";

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

  it("骨架恒为 INCOMPLETE + graph-cut-incomplete，三个半部为 null", () => {
    expect(Object.keys(outcome).sort()).toEqual([
      "graphCut", "hopDoubling", "hopSamplingCoverage", "movementModelClosure", "reason", "status",
    ]);
    expect(outcome.status).toBe("INCOMPLETE");
    expect(outcome.reason).toBe("graph-cut-incomplete");
    expect(outcome.graphCut).toBeNull();
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
      "./geometry.js", "./graph.js", "./temporal-motion.js", "./temporal-budget.js", "./temporal-result.js",
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

  it("骨架不消费 reach / startCells，不做图割", () => {
    expect(code).not.toContain("assessReachability(");
    expect(code).not.toContain("startCells(");
    expect(code).not.toContain("puConditions");
    expect(code).not.toContain("geometryCoverage");
    expect(code).not.toContain("lagInvariantByConstruction");
  });
});
