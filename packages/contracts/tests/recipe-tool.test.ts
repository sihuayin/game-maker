// 票 12 立的那份 **v4 镜像**（`recipe-tool.ts`）与它镜像的 **v3 契约**（`recipe.ts`）之间的**漂移测试**。
//
// ⚠️ 判据比对的是**行为**，不是源码字面（票 02 立镜像时的同款判据）：
//   同一份输入，两份**要么都过、要么都拒** —— 唯一的例外是**明示例外**那一组（见下）。
//   ⚠️ 镜像存在的**全部理由**是 `toolInputSchema` 只吃 v4（票 28 的边界）——
//   所以最后那一条断言比什么都重要：**它转得动**。
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AssetRecipe, parseRecipe, toolInputSchema, type AssetRecipe as Recipe } from "../src/index.js";
import { RecipeToolSchema } from "../src/recipe-tool.js";

const RECIPE_DIR = fileURLToPath(new URL("../../../fixtures/recipes/", import.meta.url));
const NAMES = readdirSync(RECIPE_DIR).filter((n) => n.endsWith(".json"));
const load = (n: string): Recipe => JSON.parse(readFileSync(RECIPE_DIR + n, "utf8"));
const clone = (n: string): Recipe => structuredClone(load(n));

/** 两份对同一份输入的**行为**是否一致（不传 `why` 就是断言「一致」）。 */
const agree = (input: unknown): boolean => parseRecipe(input).ok === RecipeToolSchema.safeParse(input).success;
const v3 = (input: unknown) => parseRecipe(input).ok;
const v4 = (input: unknown) => RecipeToolSchema.safeParse(input).success;

describe("§镜像与契约**行为一致**（漂移测试）", () => {
  it("8 份真 fixture：两份都过", () => {
    for (const n of NAMES) {
      const r = load(n);
      expect(v3(r), `${n} 该过`).toBe(true);
      expect(v4(r), `${n} 该过（镜像）`).toBe(true);
      expect(agree(r), `${n} 两份应当一致`).toBe(true);
    }
  });

  it("⚠️ **封口逐层一致**：任何一层多一个键，两份都拒", () => {
    const add = (mut: (r: Record<string, unknown>) => void, why: string) => {
      const r = clone("last-train.json") as unknown as Record<string, unknown>;
      mut(r);
      expect(v3(r), `${why}：契约该拒`).toBe(false);
      expect(v4(r), `${why}：镜像该拒`).toBe(false);
    };
    add((r) => { r["备注"] = "顶层多一个键"; }, "顶层");
    add((r) => { (r["assets"] as Record<string, unknown>[])[0]!["多余"] = 1; }, "entry 层");
    add((r) => { ((r["assets"] as Record<string, unknown>[])[0]!["spec"] as Record<string, unknown>)["多余"] = 1; }, "spec 层");
    add((r) => { ((r["assets"] as Record<string, unknown>[])[0]!["spec"] as Record<string, unknown>)["anchor"] = { x: 0.5, y: 0.5, z: 0 }; }, "anchor 层");
    add((r) => { ((r["assets"] as Record<string, unknown>[])[0]!["source"] as Record<string, unknown>)["多余"] = 1; }, "source 层");
  });

  it("⚠️ **默认值逐字一致**（`required` / `loop` / `tileable`）—— 少一个默认值，省略该键的输入就会分叉", () => {
    const r = load("last-train.json");
    const a = parseRecipe(r);
    const b = RecipeToolSchema.safeParse(r);
    expect(a.ok && b.success).toBe(true);
    if (!a.ok || !b.success) return;
    const v3specs = a.value.assets.map((e) => e.spec);
    const v4specs = (b.data as typeof a.value).assets.map((e) => e.spec);
    expect(v4specs.map((s) => s.required)).toEqual(v3specs.map((s) => s.required));
    const bg3 = v3specs.find((s) => s.kind === "background")!;
    const bg4 = v4specs.find((s) => s.kind === "background")!;
    expect(bg4.kind === "background" && bg3.kind === "background" && bg4.layers).toEqual(bg3.layers);
    const an3 = v3specs.find((s) => s.kind === "animation");
    const an4 = v4specs.find((s) => s.kind === "animation");
    if (an3?.kind === "animation" && an4?.kind === "animation") expect(an4.animations).toEqual(an3.animations);
  });

  it("⚠️ 默认值在**省略该键**的输入上也一致 —— 不然上面那条测的是「都写了」，不是「默认值」", () => {
    // ⚠️ 这一条是**补的**：第一版的「默认值一致」拿真 fixture 比 `required` 数组，
    //   而那份 fixture 的每一条都**显式写了** `required` ⇒ 把镜像里那个 `.default(true)` 删掉
    //   它**照样绿**（变异第 4 发没红）。⇒ 必须先把键**删掉**，再比「默认出来的那个值是什么」。
    const r = clone("last-train.json") as unknown as {
      assets: { spec: { required?: boolean; animations?: { loop?: boolean }[]; layers?: { tileable?: unknown }[] } }[];
    };
    for (const e of r.assets) {
      delete e.spec.required;
      for (const a of e.spec.animations ?? []) delete a.loop;
      for (const l of e.spec.layers ?? []) delete l.tileable;
    }
    const a = parseRecipe(r);
    const b = RecipeToolSchema.safeParse(r);
    expect(a.ok && b.success, "省略这些键的输入，两份都该过").toBe(true);
    if (!a.ok || !b.success) return;
    const v3specs = a.value.assets.map((e) => e.spec);
    const v4specs = (b.data as typeof a.value).assets.map((e) => e.spec);
    // 具体值也要点出来：`true` / `true` / `{x:false,y:false}` —— 只比「两份相等」的话，
    // 两边**一起错**（都不给默认值）也会绿。
    expect(v3specs.map((x) => x.required)).toEqual(v3specs.map(() => true));
    expect(v4specs.map((x) => x.required)).toEqual(v3specs.map((x) => x.required));
    const anims3 = v3specs.flatMap((x) => (x.kind === "animation" ? x.animations : []));
    const anims4 = v4specs.flatMap((x) => (x.kind === "animation" ? x.animations : []));
    expect(anims3.length).toBeGreaterThan(0);
    expect(anims3.map((x) => x.loop)).toEqual(anims3.map(() => true));
    expect(anims4.map((x) => x.loop)).toEqual(anims3.map((x) => x.loop));
    const tiers3 = v3specs.flatMap((x) => (x.kind === "background" ? (x.layers ?? []) : []));
    const tiers4 = v4specs.flatMap((x) => (x.kind === "background" ? (x.layers ?? []) : []));
    expect(tiers3.length).toBeGreaterThan(0);
    expect(tiers4).toEqual(tiers3);
  });

  it("两份对**垃圾输入**的口径一致（`null` / 数组 / 空对象 / 字符串）", () => {
    for (const junk of [null, 1, "x", [], {}, { format: "asset-recipe/v1" }]) expect(agree(junk)).toBe(true);
  });
});

describe("⚠️ **明示例外**：只被 v3 的 refine 拒的输入，镜像放行 —— 那几条 gate 模型看不见", () => {
  // `toJSONSchema` 静默丢掉 `superRefine`（票 08 实测）⇒ 镜像里有没有它们，**模型看见的一样**；
  // 而把同一批判据在两种方言里各写一遍，就是 `derivePackMode` 那种漂移。⇒ 它们的落点是**装配后**那次
  // `parseRecipe`。⚠️ 所以这四条**不是**漂移，是**分工**：镜像管线形状，契约判成立与否。
  it("① 路径的字符检查（绝对路径）—— 镜像只到 `min(1)`", () => {
    const r = clone("last-train.json") as unknown as Record<string, unknown>;
    r["styleRef"] = "/绝对路径.json";
    expect(v3(r)).toBe(false);
    expect(v4(r)).toBe(true);
  });

  it("② 九宫格中央区非空", () => {
    // ⚠️ 8 份 fixture 里没有带 `ninePatch` 的 ui，所以**现造一个**：
    //   把第一个资产改成 `ui` 并写一个中央区为空的九宫格（`left + right >= 宽度`）。
    //   ⚠️ 得**整份换掉 spec**，不能只改 `kind` —— 原资产若是 animation，留着 `animations`
    //   会被 `ui` 那份 `strictObject` 以「多余的键」拒掉，那样两份拒的是**不同的理由**。
    const r = clone("shift-change.json");
    r.assets[0]!.spec = {
      kind: "ui", id: "ui-panel", role: "面板", description: "一块会被拉伸的板子", styleId: "s",
      anchor: { x: 0, y: 0 }, size: { w: 16, h: 16 }, required: true,
      ninePatch: { left: 16, right: 1, top: 0, bottom: 0 } // 中央区空
    } as never;
    expect(v3(r)).toBe(false);
    expect(v4(r)).toBe(true);
  });

  it("③ 依赖图**有环**", () => {
    const r = clone("shift-change.json");
    const [a, b] = r.assets;
    (a!.spec as { dependsOn?: string[] }).dependsOn = [b!.spec.id];
    (b!.spec as { dependsOn?: string[] }).dependsOn = [a!.spec.id];
    expect(v3(r)).toBe(false);
    expect(v4(r)).toBe(true);
  });

  it("④ 母版画布的宽高比与引用它的资产不一致", () => {
    const r = clone("shift-change.json");
    const first = r.assets[0]!;
    (r as { authoring?: unknown[] }).authoring = [
      { id: "m", role: "母版", description: "d", source: { kind: "drawlist" }, characterId: "p", size: { w: 1, h: 7 } }
    ];
    (first.spec as { masterAsset?: string }).masterAsset = "m";
    expect(v3(r)).toBe(false);
    expect(v4(r)).toBe(true);
  });
});

describe("§镜像存在的**全部理由**：`toolInputSchema` 转得动它", () => {
  it("⚠️ 顶层 7 键、封口、无 `$ref`；而 gate 的话**一个字都不在里面**", () => {
    const json = toolInputSchema(RecipeToolSchema);
    expect(Object.keys(json.properties as object)).toHaveLength(7);
    expect(json.additionalProperties).toBe(false);
    const text = JSON.stringify(json);
    expect(text).not.toContain("superRefine");
    expect(text).not.toContain("有环");        // 依赖图那条 gate
    expect(text).not.toContain("宽高比");      // 母版比例那条
    expect(text).not.toContain("中央区");      // 九宫格那条
  });

  it("⚠️ 而**v3 那份转不动** —— 这就是镜像存在的理由（v3 的 `ZodObject` 没有 `_zod`）", () => {
    expect(() => toolInputSchema(AssetRecipe as never)).toThrowError(/zod\/v4/);
  });
});
