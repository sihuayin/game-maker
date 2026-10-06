// **依赖边的排程**（票 11 的 Q4）：契约判环，**pack 排序**。这一份测的是后半句。
//
// ⚠️ 三件事要分开说清，因为它们是**三条不同的**主张：
//   ① 有依赖时**真的等**（不是碰巧顺序对）；
//   ② 前置没造出来时，依赖者**根本不上路**（那正是这条边省下来的钱）；
//   ③ 没依赖时**行为一字不变**（全并发不许被顺序器拖慢）。
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import type { AssetRecipe, AssetSpec, DrawList, StyleSpec } from "@game-maker/contracts";
import { buildAssetPack, type DrawListGenerator } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const RECIPE: AssetRecipe = JSON.parse(readFileSync(ROOT + "fixtures/recipes/shift-change.json", "utf8"));
const STYLE: StyleSpec = JSON.parse(readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
const EPOCH = 1790208000;

const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "packdeps-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

/** ⚠️ 帧数必须与 `framePlan(spec)` 对得上（动画是各段帧数之和、分层背景是层数）——
 *  给少了 `pack` 会当场拒「清单说要有 N 帧，生成器给了 M 帧」。 */
const frameCount = (spec: AssetSpec): number =>
  spec.kind === "animation" ? spec.animations.reduce((n, a) => n + a.frames, 0)
    : spec.kind === "background" && spec.layers ? spec.layers.length : 1;

const drawlists = (spec: AssetSpec): DrawList[] =>
  Array.from({ length: frameCount(spec) }, (_, i) => ({
    format: "drawlist+curve/v1", id: spec.id, frame: `f${i}`,
    viewBox: [0, 0, spec.size.w, spec.size.h], expectedSize: [spec.size.w, spec.size.h],
    ops: [
      { op: "rect", x: 0, y: 0, w: spec.size.w, h: spec.size.h, fill: "palette:0" },
      { op: "rect", x: 1, y: 1, w: Math.max(1, spec.size.w - 2), h: 2, fill: "palette:1" },
    ] as DrawList["ops"],
  }));

/** 取两个真资产，**把顺序倒过来放**（`b` 在清单里排前面）—— 这样「谁先被造」就不是声明顺序了。 */
const twoAssets = (dependsOn?: string[]): AssetRecipe => {
  const [a, b] = RECIPE.assets;
  const spec = structuredClone(b!) as (typeof RECIPE.assets)[number];
  if (dependsOn) (spec.spec as { dependsOn?: string[] }).dependsOn = dependsOn;
  return { ...RECIPE, assets: [spec, structuredClone(a!)] };
};
const A_ID = RECIPE.assets[0]!.spec.id;   // 排在后面、被别人依赖的那个
const B_ID = RECIPE.assets[1]!.spec.id;   // 排在前面的那个

/** 记下每个资产**第一次**被调用的时刻。 */
const recorder = (slow: string) => {
  const at: Record<string, number> = {};
  const gen: DrawListGenerator = async (spec) => {
    at[spec.id] ??= Date.now();
    if (spec.id === slow) await new Promise((r) => setTimeout(r, 60));
    return drawlists(spec);
  };
  return { at, gen };
};

describe("§依赖边：pack 真的按图排序（票 11 的 Q4）", () => {
  it("⚠️ `b.dependsOn = [a]` ⇒ **a 先造**，哪怕 b 在清单里排在前面", async () => {
    const { at, gen } = recorder(A_ID);
    await buildAssetPack({ recipe: twoAssets([A_ID]), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: gen, sourceDateEpoch: EPOCH });
    expect(at[B_ID]).toBeDefined();
    expect(at[A_ID]!).toBeLessThan(at[B_ID]!);
  });

  it("⚠️ 而且是真的**等**它造完（不是碰巧顺序对）：a 慢 60ms，b 就得晚 ≥50ms 才开始", async () => {
    const { at, gen } = recorder(A_ID);
    await buildAssetPack({ recipe: twoAssets([A_ID]), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: gen, sourceDateEpoch: EPOCH });
    expect(at[B_ID]! - at[A_ID]!).toBeGreaterThanOrEqual(50);
  });

  it("⚠️ **没依赖时行为一字不变**：两笔同时起飞（全并发不许被顺序器拖慢）", async () => {
    const { at, gen } = recorder(A_ID);
    await buildAssetPack({ recipe: twoAssets(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: gen, sourceDateEpoch: EPOCH });
    expect(Math.abs(at[B_ID]! - at[A_ID]!)).toBeLessThan(40);   // 谁先谁后无所谓，**同时**就行
  });
});

describe("§前置失败 ⇒ 依赖者**一个字节都不往外发**", () => {
  // ⚠️ **这一条必须用「不经过闸门的那种失败」**，否则它测的不是依赖边。
  //   为什么：`pack` 早有一道**共享的失败闸**（`stop`）—— 串行时代留下的保险，
  //   它让「已经知道失败了」之后**排进闸门的**调用不再发出去。所以**闸门内**的失败
  //   （比如生成器自己抛）**本来**就会挡住 b，与依赖边无关。
  //   ⚠️ 第一版正是这么写的，于是它在**变异把依赖边拿掉之后照样绿**（红不起来 ⇒ 判据漏了）。
  //   ⇒ 这里改用**闸门之外**的失败：让 a 给出与 `framePlan` 对不上的帧数，
  //     那句 throw 在 `await textGate(...)` **之后** ⇒ `stop` 一个字节都没设过。
  //     这一发才是真的在问「依赖边自己守不守得住」。
  it("a 的失败**.没有经过闸门**（帧数对不上）⇒ b 的生成器**根本没被调用**（那一笔钱没花）", async () => {
    const called: string[] = [];
    const gen: DrawListGenerator = async (spec) => {
      called.push(spec.id);
      return spec.id === A_ID ? [] : drawlists(spec);   // a 给 0 帧 ⇒ 帧数对不上 ⇒ 闸门**之外**抛
    };
    const p = buildAssetPack({ recipe: twoAssets([A_ID]), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: gen, sourceDateEpoch: EPOCH });
    await expect(p).rejects.toThrowError(/帧/);
    expect(called).toContain(A_ID);
    expect(called).not.toContain(B_ID);
  });

  it("而 a 在**闸门内**失败（生成器自己抛）时，b 也出不去 —— 那一道保险是 `stop`，不是依赖边", async () => {
    const called: string[] = [];
    const gen: DrawListGenerator = async (spec) => {
      called.push(spec.id);
      if (spec.id === A_ID) throw new Error("上游挂了");
      return drawlists(spec);
    };
    const p = buildAssetPack({ recipe: twoAssets([A_ID]), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: gen, sourceDateEpoch: EPOCH });
    await expect(p).rejects.toThrowError(/上游挂了|前置资产/);
    expect(called).not.toContain(B_ID);
  });
});
