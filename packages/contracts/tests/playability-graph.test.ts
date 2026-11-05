// LP-01：共享移动图 —— Solid 阻挡、walk / walk-off / fall、低天花板、moving solid。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAssetPack, parseGameConfig, playerMoveOf } from "../src/index.js";
import type { GameConfig } from "../src/game-config.js";
import {
  buildMovementGraph, fallTarget, hopTargets, movementNeighbors, reachableCells,
} from "../src/playability/graph.js";

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
const withConfig = (f: (c: GameConfig) => void): GameConfig => {
  const c = structuredClone(CONFIG);
  f(c);
  return c;
};
const graphOf = (c: GameConfig) => {
  const g = buildMovementGraph(c, MANIFEST);
  if (!g) throw new Error("夹具的玩家资源应该解得动");
  return g;
};

describe("§建图与出生点", () => {
  it("真夹具能建图；出生点附近有落脚点", () => {
    const g = graphOf(CONFIG);
    expect(g.coverage).toBe("partial"); // 玩家是动画精灵，body 位置跟帧 origin 走
    expect(g.standableAt(40, 250)).toBe(true);
    expect(g.startCells()).toContainEqual({ x: 40, y: 250 });
  });

  it("玩家资源解不到 ⇒ 不建图（归引用族）", () => {
    expect(buildMovementGraph(withConfig((c) => { c.player.asset = "查无此资源"; }), MANIFEST)).toBeNull();
  });
});

describe("§Solid 阻挡", () => {
  it("行李堆（solid，40×40）挡住脚点格，也挡得住走进它", () => {
    const g = graphOf(CONFIG);
    expect(g.freeAt(500, 250)).toBe(false);
    expect(g.standableAt(500, 250)).toBe(false);
    expect(movementNeighbors(g, 464, 250).some((e) => e.x === 465 && e.kind === "walk")).toBe(false);
  });

  it("⚠️ moving solid 按**原始位置**静态处理：扫过但不在原位的格子不挡", () => {
    const g = graphOf(withConfig((c) => {
      c.entities = [{
        id: "moving", kind: "solid", at: { x: 500, y: 250 }, asset: "prop-luggage-pile",
        motion: { kind: "cycle", axis: "x", distance: 200, periodMs: 1000 },
      }];
    }));
    expect(g.freeAt(500, 250)).toBe(false);  // 原位
    expect(g.freeAt(600, 250)).toBe(true);   // 扫过区，但不在原位
  });
});

describe("§Walk / Fall", () => {
  it("平地上相邻列是 walk 边", () => {
    const g = graphOf(CONFIG);
    expect(movementNeighbors(g, 300, 250)).toContainEqual({ x: 301, y: 250, kind: "walk" });
  });

  it("走出 10px 台阶 ⇒ walk-off 到下一层的落脚点", () => {
    const g = graphOf(withConfig((c) => {
      c.terrain = [{ x: 0, y: 250, w: 600, h: 20 }, { x: 600, y: 260, w: 840, h: 10 }];
      c.entities = [];
    }));
    // 玩家半宽 16px：直到脚点 615 仍踩在上层边缘；616 才真正悬空、落到下一层。
    expect(movementNeighbors(g, 615, 250)).toContainEqual({ x: 616, y: 260, kind: "walk-off" });
  });

  it("自由空中格竖直下落 ⇒ fall 到该列下一个落脚点", () => {
    const g = graphOf(withConfig((c) => {
      c.terrain = [{ x: 0, y: 250, w: 600, h: 20 }, { x: 600, y: 260, w: 840, h: 10 }];
      c.entities = [];
    }));
    expect(g.freeAt(616, 250)).toBe(true);
    expect(g.standableAt(616, 250)).toBe(false);
    expect(fallTarget(g, 616, 250)).toBe(260);
  });

  it("⚠️ 低天花板：走路能过（旧判据只建跳跃弧会误报）", () => {
    const g = graphOf(withConfig((c) => {
      c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }];
      c.entities = [{
        id: "ceiling", kind: "solid", at: { x: 320, y: 202 }, asset: "prop-luggage-pile",
        body: { w: 240, h: 12 },
      }];
    }));
    // 天花板底边 202 = 玩家盒子顶边 202：贴着不算撞
    expect(g.freeAt(320, 250)).toBe(true);
    expect(g.standableAt(320, 250)).toBe(true);
    const reached = reachableCells(g, [{ x: 200, y: 250 }], playerMoveOf(CONFIG), false);
    expect(reached.has("440,250")).toBe(true);
  });
});

describe("§Hop（抛物线）", () => {
  it("同高相邻列也在跳跃可达集里（弧线不撞）", () => {
    const g = graphOf(CONFIG);
    expect(hopTargets(g, 300, 250, playerMoveOf(CONFIG))).toContainEqual({ x: 301, y: 250 });
  });
});
