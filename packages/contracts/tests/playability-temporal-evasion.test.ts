// U4-02：`graph.ts` 的 `HopSampling` 可选尾参 —— 默认行为等价与稳定序列化回归。
// ⚠️ 本文件此阶段只承载尾参回归；U4 图割语义由后续票追加。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAssetPack, parseGameConfig, playerMoveOf } from "../src/index.js";
import { buildMovementGraph, hopEdges, hopSamples, hopTargets } from "../src/playability/graph.js";

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
