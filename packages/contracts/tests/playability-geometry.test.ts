// LP-01：AABB / Runtime geometry profile 的边界用例。
//
// ⚠️ 这些用例钉的是 **LP-00 复核后的语义**：
//   solid / chest / danger 吃 `body`；pickup / hazard / goal 忽略 `body`；
//   chest 交互盒四边外扩 `range`，严格相交、不要求落地。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAssetPack, parseGameConfig } from "../src/index.js";
import type { GameConfig, GameEntity } from "../src/game-config.js";
import {
  boxFromFoot, contains, expandBox, overlapsInclusive, overlapsStrict, touches,
} from "../src/playability/geometry.js";
import {
  chestInteractionBox, chestInteractable, runtimeEntityGeometry, runtimePlayerGeometry,
} from "../src/playability/profile.js";

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
const base = (id: string): GameEntity => structuredClone(CONFIG.entities.find((e) => e.id === id)!);
const player = (c: GameConfig = CONFIG) => runtimePlayerGeometry(c, MANIFEST)!;

describe("§AABB 原语", () => {
  it("严格相交：有正面积才算；贴边不算", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(overlapsStrict(a, { x: 9, y: 0, w: 10, h: 10 })).toBe(true);
    expect(overlapsStrict(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(overlapsStrict(a, { x: 10, y: 10, w: 1, h: 1 })).toBe(false);
  });

  it("闭区间相交与「接触」：贴边算接触，不算重叠", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const edge = { x: 10, y: 0, w: 10, h: 10 };
    expect(overlapsInclusive(a, edge)).toBe(true);
    expect(touches(a, edge)).toBe(true);
    expect(touches(a, { x: 9, y: 0, w: 10, h: 10 })).toBe(false);
  });

  it("包含（闭区间）：贴边算包含，越界不算", () => {
    const outer = { x: 0, y: 0, w: 10, h: 10 };
    expect(contains(outer, { x: 0, y: 0, w: 10, h: 10 })).toBe(true);
    expect(contains(outer, { x: 5, y: 5, w: 5, h: 5 })).toBe(true);
    expect(contains(outer, { x: 5, y: 5, w: 6, h: 5 })).toBe(false);
  });

  it("四边外扩与脚点反推", () => {
    expect(expandBox({ x: 10, y: 20, w: 30, h: 40 }, 5)).toEqual({ x: 5, y: 15, w: 40, h: 50 });
    expect(boxFromFoot({ x: 40, y: 252.4 }, { w: 32, h: 48 })).toEqual({ x: 24, y: 204.4, w: 32, h: 48 });
  });
});

describe("§Runtime geometry profile（LP-00 裁定）", () => {
  it("solid 吃 `body` 覆盖；没给就用 manifest 标称尺寸", () => {
    const plain = runtimeEntityGeometry(base("luggage"), MANIFEST)!;
    expect(plain).toEqual({ box: { x: 480, y: 210, w: 40, h: 40 }, source: "body", coverage: "checked" });

    const tall = base("luggage");
    tall.body = { w: 20, h: 100 };
    expect(runtimeEntityGeometry(tall, MANIFEST)!.box).toEqual({ x: 490, y: 150, w: 20, h: 100 });
  });

  it("⚠️ pickup 忽略 `body` —— 运行时物理体来自图集帧，不是配置里的覆盖", () => {
    const withBody = base("suitcase-1");
    withBody.body = { w: 10, h: 10 };
    const g = runtimeEntityGeometry(withBody, MANIFEST)!;
    expect(g.source).toBe("frame");
    expect(g.coverage).toBe("partial");
    expect(g.box).toEqual({ x: 292, y: 234, w: 16, h: 16 });
  });

  it("chest 吃 `body`，交互盒四边外扩 `range`", () => {
    const chest = base("suitcase-1");
    chest.kind = "chest";
    chest.asset = "prop-luggage-pile";
    chest.at = { x: 500, y: 250 };
    const g = runtimeEntityGeometry(chest, MANIFEST)!;
    expect(g.box).toEqual({ x: 480, y: 210, w: 40, h: 40 });
    expect(chestInteractionBox(g, 12)).toEqual({ x: 468, y: 198, w: 64, h: 64 });
  });

  it("chest 交互：严格 AABB、不要求落地；贴边不算", () => {
    const chest = base("suitcase-1");
    chest.kind = "chest";
    chest.asset = "prop-luggage-pile";
    chest.at = { x: 500, y: 250 };
    const g = runtimeEntityGeometry(chest, MANIFEST)!;

    // 右边缘正好贴住交互盒左边缘 ⇒ 不算
    expect(chestInteractable({ x: 436, y: 202, w: 32, h: 48 }, g, 12)).toBe(false);
    // 向内 1px ⇒ 算
    expect(chestInteractable({ x: 437, y: 202, w: 32, h: 48 }, g, 12)).toBe(true);
    // 悬空（脚不在地上）也算 —— P3 不要求落地
    expect(chestInteractable({ x: 460, y: 151, w: 32, h: 48 }, g, 12)).toBe(true);
    // 上下贴边不算
    expect(chestInteractable({ x: 460, y: 150, w: 32, h: 48 }, g, 12)).toBe(false);
  });

  it("decor 无碰撞；资源解不到返回 null（引用族的事）", () => {
    const decor = base("suitcase-1");
    decor.kind = "decor";
    expect(runtimeEntityGeometry(decor, MANIFEST)).toBeNull();

    const missing = base("suitcase-1");
    missing.asset = "查无此资源";
    expect(runtimeEntityGeometry(missing, MANIFEST)).toBeNull();
  });

  it("玩家几何用 manifest 尺寸 / 锚点；脚点是底边中点，coverage 为 partial", () => {
    expect(player()).toEqual({
      size: { w: 32, h: 48 },
      anchor: { x: 0.5, y: 0.95 },
      foot: { x: 40, y: 252.4 },
      coverage: "partial",
    });
  });
});
