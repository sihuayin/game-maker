// **依赖图**（票 11 的 Q3/Q4/Q5）：两类边 · 环 · 母版画布的比例。
//
// ⚠️ 这三条判据的**时机**与它们本身一样重要：`packAssets` 第一行就 `parseRecipe`
//   ⇒ 含环的配方在**任何生图之前**被拒（退出码 4）。把环留到生成期才发现，就是「跑到一半死」。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseRecipe, type AssetRecipe as Recipe } from "../src/index.js";

const RECIPE_DIR = fileURLToPath(new URL("../../../fixtures/recipes/", import.meta.url));
/** 拿一份**真的**清单当底（票 28 那条「人给的 / 推导的同构」在这里也成立：图与来源无关）。 */
const BASE: Recipe = JSON.parse(readFileSync(RECIPE_DIR + "shift-change.json", "utf8"));

const recipe = (): Recipe => structuredClone(BASE);
const ids = (r: Recipe) => r.assets.map((e) => e.spec.id);
const errors = (r: unknown): string => {
  const p = parseRecipe(r);
  expect(p.ok, "本该被拒，却通过了").toBe(false);
  return p.ok ? "" : p.errors.join("\n");
};

/** 给某个资产挂一条 `dependsOn`。 */
const dep = (r: Recipe, i: number, ...on: string[]): Recipe => {
  (r.assets[i]!.spec as { dependsOn?: string[] }).dependsOn = on;
  return r;
};

/** 加一张母版（画布由调用方给），并把第 `i` 个资产指过去。
 *  ⚠️ 画布**必须显式给** —— 从资产尺寸推的话，那两格就不是两个独立的输入了，
 *    而「比例一致 / 不一致」正是靠它们的**比**判的。 */
const withMaster = (r: Recipe, i: number, canvas: { w: number; h: number }): Recipe => {
  (r as { authoring?: unknown[] }).authoring = [
    { id: "player-master", role: "母版", description: "一张画布", source: { kind: "drawlist" }, characterId: "p", size: canvas },
  ];
  (r.assets[i]!.spec as { masterAsset?: string }).masterAsset = "player-master";
  return r;
};

/** 保证**同比例**的画布：两边同乘一个数。 */
const sameRatio = (r: Recipe, i: number): { w: number; h: number } => {
  const s = r.assets[i]!.spec.size;
  return { w: s.w * 3, h: s.h * 3 };
};

/** 保证**不同比例**的画布：一边乘 2、一边乘 3（`2/3 · w/h ≠ w/h`，与资产本身的比例无关）。 */
const otherRatio = (r: Recipe, i: number): { w: number; h: number } => {
  const s = r.assets[i]!.spec.size;
  return { w: s.w * 2, h: s.h * 3 };
};

describe("§依赖边 `dependsOn`（资产 → 资产）", () => {
  it("解得到 ⇒ 过（把它当**顺序**用：先造 A 再造 B）", () => {
    const [a, b] = ids(recipe());
    expect(parseRecipe(dep(recipe(), 1, a!)).ok).toBe(true);
    void b;
  });

  it("解不到 ⇒ 拒，且 `path` 指得到**那一格**", () => {
    const r = dep(recipe(), 0, "没有这个资产");
    const p = parseRecipe(r);
    expect(p.ok).toBe(false);
    // ⚠️ **收窄写在失败那一支里**（本文件后面几条同款）—— 不这么写，两支会挤在一行里，
    //   而这里原本那句 `if (!p.ok) return;` 让**这一整块断言从来没跑过**：
    //   解析失败（正是要测的那条路）时它当场返回 ⇒ 「报错里有没有那个 id、指不指得到那一格」
    //   谁也没查 —— 一张**因为错误的理由而绿**的用例（票 11 自己命名的那个病）。
    if (!p.ok) {
      const msg = p.errors.join();
      expect(msg).toContain("没有这个资产");
      expect(msg).toContain("assets[0].spec.dependsOn[0]");   // ← `formatIssues` 把 `path` 摊在行首
    }
  });

  it("⚠️ 指向**自己** ⇒ 拒（一个资产不能是自己的前置）", () => {
    const r = recipe();
    expect(errors(dep(r, 0, r.assets[0]!.spec.id))).toMatch(/依赖它自己/);
  });

  it("⚠️ 指向一个**母版** id ⇒ 拒，而且消息说得出「该用 `masterAsset`」", () => {
    const r = recipe();
    withMaster(r, 1, sameRatio(r, 1));
    const r2 = dep(r, 2, "player-master");   // 另一个资产拿母版 id 去当 dependsOn
    expect(errors(r2)).toMatch(/是个\*\*母版\*\*|母版.*masterAsset/);
  });

  it("空数组 / 压根不写 ⇒ 都过（兼容：8 份 fixture 一个字不改）", () => {
    expect(parseRecipe(dep(recipe(), 0)).ok).toBe(true);
    expect(parseRecipe(recipe()).ok).toBe(true);
  });
});

describe("§环 —— **当场拒**，不是跑到一半死（票 11 的 Q4）", () => {
  it("二元环 a → b → a ⇒ 拒，且报错里**抄得出那个环**", () => {
    const r = recipe();
    const [a, b] = ids(r);
    dep(r, 0, b!);
    dep(r, 1, a!);
    const msg = errors(r);
    expect(msg).toMatch(/有环/);
    expect(msg).toContain(a!);
    expect(msg).toContain(b!);
  });

  it("三元环 a → b → c → a ⇒ 拒", () => {
    const r = recipe();
    const [a, b, c] = ids(r);
    dep(r, 0, b!);
    dep(r, 1, c!);
    dep(r, 2, a!);
    expect(errors(r)).toMatch(/有环/);
  });

  it("**没有**环的链（a → b → c）⇒ 过 —— 判据不许误伤正例", () => {
    const r = recipe();
    const [a, b, c] = ids(r);
    dep(r, 0, b!);
    dep(r, 1, c!);
    expect(parseRecipe(r).ok).toBe(true);
    void a;
  });

  it("两个互不相干的子图 ⇒ 过", () => {
    const r = recipe();
    const [a, b, c, d] = ids(r);
    dep(r, 0, b!);
    dep(r, 2, d!);
    expect(parseRecipe(r).ok).toBe(true);
    void c;
  });
});

describe("§母版的画布比例（票 11 的 Q5：把注释里那条判据兑现）", () => {
  it("画布**比例一致**（尺寸不同）⇒ 过 —— 判据管的是比，不是尺寸", () => {
    const r = recipe();
    expect(parseRecipe(withMaster(r, 1, sameRatio(r, 1))).ok).toBe(true);
  });

  it("⚠️ 画布**比例不一致** ⇒ 拒，且报错点得出两个尺寸", () => {
    const r = recipe();
    const s = r.assets[1]!.spec.size;
    const canvas = otherRatio(r, 1);
    const p = parseRecipe(withMaster(r, 1, canvas));
    expect(p.ok).toBe(false);
    if (!p.ok) {
      const msg = p.errors.join();
      expect(msg).toMatch(/宽高比不一致/);
      expect(msg).toContain(`${s.w}×${s.h}`);
      expect(msg).toContain(`${canvas.w}×${canvas.h}`);
    }
  });

  it("不引母版的资产，尺寸随便 ⇒ 过（判据只管「引了母版」的那些）", () => {
    expect(parseRecipe(recipe()).ok).toBe(true);
  });

  it("母版**不存在**时只报一条（别把同一件事报两遍）", () => {
    const r = recipe();
    (r.assets[1]!.spec as { masterAsset?: string }).masterAsset = "没这张母版";
    const p = parseRecipe(r);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.errors.filter((e) => /母版/.test(e))).toHaveLength(1);
  });
});

describe("§兼容 —— 新字段全是 optional，磁盘上那 8 份一个字不改", () => {
  it("没有 `dependsOn` / `authoring` / `masterAsset` 的配方照旧合法", () => {
    expect(parseRecipe(recipe()).ok).toBe(true);
  });
});
