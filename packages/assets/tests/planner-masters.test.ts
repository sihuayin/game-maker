// 票 03：planner 的**母版兜底** —— 每个带 `characterId` 的 animation 都必须有一张母版。
//
// ⚠️ 为什么是「兜底」而不是「只改提示词」：B 跑（`runs/2026-10-18d/`）量到 3 个角色、0 张母版，
//   而当时的提示词逐字允许「母版不必每份清单都有」⇒ 模型照许可省略。提示词改硬是必要的一半，
//   但模型的遵守率没有免费验证手段；这一层是**确定性**的那一半。
import { describe, expect, it } from "vitest";
import { parseRecipe, type AssetRecipe, type AssetSpec } from "@game-maker/contracts";
import { ensureCharacterMasters } from "../src/index.js";

const anim = (
  id: string,
  opts: { characterId?: string; size?: { w: number; h: number }; masterAsset?: string } = {},
): { spec: AssetSpec; source: { kind: "image" } } => ({
  spec: {
    kind: "animation", id, role: `${id} 的可见形象`, description: `${id} 的所有动作`,
    styleId: "style-ref", anchor: { x: 0.5, y: 1 }, size: opts.size ?? { w: 48, h: 64 }, required: true,
    ...(opts.characterId === undefined ? {} : { characterId: opts.characterId }),
    ...(opts.masterAsset === undefined ? {} : { masterAsset: opts.masterAsset }),
    animations: [{ name: "idle", frames: 1, loop: true }],
  },
  source: { kind: "image" },
});

const sprite = (id: string, characterId?: string): { spec: AssetSpec; source: { kind: "drawlist" } } => ({
  spec: {
    kind: "sprite", id, role: "道具", description: "一件道具", styleId: "style-ref",
    anchor: { x: 0, y: 0 }, size: { w: 16, h: 16 }, required: true,
    ...(characterId === undefined ? {} : { characterId }),
  },
  source: { kind: "drawlist" },
});

const recipe = (assets: AssetRecipe["assets"], authoring?: AssetRecipe["authoring"]): AssetRecipe => ({
  format: "asset-recipe/v1", id: "planner-masters", styleRef: "stylespec.json",
  assets, ...(authoring === undefined ? {} : { authoring }),
});

const mastersOf = (r: AssetRecipe) => r.authoring ?? [];

describe("§ ensureCharacterMasters —— 每个角色的动画都有母版", () => {
  it("同一角色、同一比例 ⇒ **一张**母版，两个动画都指向它（不同尺寸也算同一比例）", () => {
    const out = ensureCharacterMasters(recipe([
      anim("hero-big", { characterId: "hero", size: { w: 48, h: 64 } }),
      anim("hero-small", { characterId: "hero", size: { w: 24, h: 32 } }),
    ]));
    const masters = mastersOf(out);
    expect(masters).toHaveLength(1);
    const id = masters[0]!.id;
    expect(out.assets.map((a) => a.spec.masterAsset)).toEqual([id, id]);
    expect(masters[0]!.characterId).toBe("hero");
    expect(masters[0]!.source).toEqual({ kind: "image" });
    expect(parseRecipe(out).ok).toBe(true);
  });

  it("同一角色、**不同比例** ⇒ 各一张母版（母版画布的比例必须与被引用的动画一致）", () => {
    const out = ensureCharacterMasters(recipe([
      anim("hero-tall", { characterId: "hero", size: { w: 48, h: 64 } }),
      anim("hero-square", { characterId: "hero", size: { w: 48, h: 48 } }),
    ]));
    const masters = mastersOf(out);
    expect(masters).toHaveLength(2);
    expect(new Set(masters.map((m) => m.id)).size).toBe(2);
    for (const e of out.assets) {
      const m = masters.find((x) => x.id === e.spec.masterAsset)!;
      expect(m.size.w * e.spec.size.h).toBe(m.size.h * e.spec.size.w);
    }
    expect(parseRecipe(out).ok).toBe(true);
  });

  it("模型已经给对了 —— **复用**，不再新建", () => {
    const existing = {
      id: "master-hero", role: "母版", description: "已有母版", source: { kind: "image" as const },
      characterId: "hero", size: { w: 48, h: 64 },
    };
    const out = ensureCharacterMasters(recipe([
      anim("hero-idle", { characterId: "hero", masterAsset: "master-hero" }),
      anim("hero-run", { characterId: "hero" }),
    ], [existing]));
    expect(out.authoring).toEqual([existing]);
    expect(out.assets.map((a) => a.spec.masterAsset)).toEqual(["master-hero", "master-hero"]);
  });

  it("⚠️ 已有链接指向**别的角色**的母版 ⇒ 改指向本角色那张（票面要求「它的」母版）", () => {
    const wrong = {
      id: "master-enemy", role: "敌人母版", description: "另一个角色", source: { kind: "image" as const },
      characterId: "enemy", size: { w: 48, h: 64 },
    };
    const out = ensureCharacterMasters(recipe([
      anim("hero-idle", { characterId: "hero", masterAsset: "master-enemy" }),
    ], [wrong]));
    const own = mastersOf(out).find((m) => m.characterId === "hero")!;
    expect(own).toBeDefined();
    expect(out.assets[0]!.spec.masterAsset).toBe(own.id);
    expect(parseRecipe(out).ok).toBe(true);
  });

  it("非动画 / 没有 characterId / 被 skip 的资产都不动 —— 旧清单**不长出** authoring", () => {
    const out = ensureCharacterMasters(recipe([
      anim("no-char"),
      anim("imported-hero", { characterId: "hero" }),
      sprite("crate"),
      sprite("hero-item", "hero"),
    ]), { skipAssetIds: new Set(["imported-hero"]) });
    expect(out.authoring).toBeUndefined();
    expect(out.assets.every((a) => a.spec.masterAsset === undefined)).toBe(true);
  });

  it("幂等：跑两遍结果相同（planner 重放不会长出第二张）", () => {
    const once = ensureCharacterMasters(recipe([
      anim("hero-idle", { characterId: "hero" }),
      anim("enemy-idle", { characterId: "enemy", size: { w: 64, h: 64 } }),
    ]));
    const twice = ensureCharacterMasters(once);
    expect(twice).toEqual(once);
  });

  it("母版 id 与资产 id 撞名时自动让开（两个 id 空间必须分开）", () => {
    const out = ensureCharacterMasters(recipe([
      sprite("master-hero"),
      anim("hero-idle", { characterId: "hero" }),
    ]));
    const id = out.assets[1]!.spec.masterAsset!;
    expect(id).not.toBe("master-hero");
    expect(out.assets.map((a) => a.spec.id)).not.toContain(id);
    expect(parseRecipe(out).ok).toBe(true);
  });
});
