// `fixtures/recipes/**` 的**全量校验**（票 35 施工的最后一道闸）。
//
// ⚠️ 它回答的是「**这 9 份手写清单，改完契约与组装之后，是不是每一份都还成立**」——
//   单点测试保不住这个：契约删一个字段（本票删的正是 `source.prompt`）、组装换一处派生
//   （本票把底色改成**始终** `keyColorFor(palette)`），单点测试各自照样绿，而某一份
//   手写清单可能已经出不了包了。所以这里**逐份真跑一遍** `buildAssetPack`。
//
// ⚠️ **一份一份地测**（`for` 里 `it`），不是「随便挑一份」：哪一份坏了，报告里直接写着它的文件名。
//
// ⚠️ 而它顺带钉住**抠底那一侧的真相**（**票 37**）：桩生图器**读得出提示词里那个底色、
//   但画的不是它** —— 它画一个**实测交付过**的颜色（`_model-paint.ts`）。
//   于是「出得了包」这条judgement第一次真的要求「抠底认得出**模型实际交付的那个颜色**」，
//   而不是「提示词说的色 === `pack` 抠的色」（那条判据在票 35 时看着像守卫，
//   ⚠️ 实际上**把错误钉死了**：它要求两者相等，而实测两者**永远不等**）。
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { imageCallsOf, parseRecipe, type AssetRecipe, type DrawList, type StyleSpec } from "@game-maker/contracts";
import {
  buildAssetPack, keyColorFor, verifyPack,
  type DrawListGenerator, type ImageGenerator, type RasterImage,
} from "../src/index.js";
import { deliveredColour, px } from "./_model-paint.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
/** ⚠️ **配方文件所在的那个目录** —— `referenceImage` 与 `source.ref` 都相对它解析（契约 `InputPath`）。 */
const RECIPE_DIR = path.join(ROOT, "fixtures/recipes");
const RECIPES = readdirSync(RECIPE_DIR).filter((f) => f.endsWith(".json")).sort();
const EPOCH = 1790208000;

const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "sweep-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

/** 桩 drawlist 生成器（与 `pack.test.ts` 那份同款：确定性地按 spec 画几张色块）。 */
const stub: DrawListGenerator = (spec) => {
  const n = spec.kind === "animation" ? spec.animations.reduce((s, a) => s + a.frames, 0)
    : spec.kind === "background" && spec.layers ? spec.layers.length : 1;
  return Array.from({ length: n }, (_, i) => ({
    format: "drawlist+curve/v1", id: spec.id, frame: `f${i}`,
    viewBox: [0, 0, spec.size.w, spec.size.h], expectedSize: [spec.size.w, spec.size.h],
    ops: [
      { op: "rect", x: 0, y: 0, w: spec.size.w, h: spec.size.h, fill: `palette:${i % 5}` },
      { op: "rect", x: 1, y: 1, w: Math.max(1, spec.size.w - 2), h: 2, fill: "palette:1" },
    ] as DrawList["ops"],
  }));
};

/**
 * 风格：按 `styleRef` 解析（相对配方文件），解析不到就回落到 `fixtures/style-spec.json`。
 *
 * ⚠️ **回落是为一处已知的例外而写的**：`shift-change.json` 的 `styleRef` 是
 *   `authoring/stylespec.json` —— 那是**交付包里**那份副本的路径（真跑时配方住在
 *   `out/<id>/recipes/` 底下），而它作为一份躺在 `fixtures/` 里的清单是解析不到的。
 *   （它今天无害：`buildAssetPack` 根本不读 `styleRef`，风格是调用方递进来的。）
 */
const styleOf = (r: AssetRecipe): StyleSpec => {
  const p = path.resolve(RECIPE_DIR, r.styleRef);
  return JSON.parse(readFileSync(existsSync(p) ? p : path.join(ROOT, "fixtures/style-spec.json"), "utf8"));
};

/** 提示词里那句底色 —— 三份生图模板（含母版那份）**都用这个说法**。 */
const COLOUR_IN_PROMPT = /纯色 (#[0-9a-fA-F]{6})/;
/** 动画那张横图里「一共几个角色」—— 桩照着它画几格（与模型该做的一样）。 */
const CELLS_IN_PROMPT = /整张图共 (\d+) 个角色，不多不少/;

/**
 * 桩生图器：**它做提示词要它做的事，除了那一件 —— 底色**。
 *
 * · 它读得出提示词里那个色（`told` 记下来，用来验「提示词说的色是**派生**出来的那一个」）；
 * · 但**画的是另一个颜色**（`deliveredColour`，票 37 的 Q5）—— 这是模型**实际的行为**：
 *   9/9 张都没交付我们声明的那个颜色；
 * · 格数与缝照旧（每格一个色板色、格与格之间留干净的底），否则切帧那条判据无从谈起。
 *
 * ⚠️ **每格的墨占中间 40%**（`0.3 ~ 0.7`）——「四周留一圈底」是**实测的构图**
 *   （真跑那 9 张的主体只占 10~20%：极简像素 · 大片留白）。此前这里画的是 75%（墨 56%），
 *   **墨比底还多** ⇒ 众数色就是**主体** ⇒ 按众数抠底等于把主体抠掉。
 *   ⚠️ 那个坑是票 37 改完抠底之后**当场被这套测试抓出来的** —— 桩画得不像模型，
 *   判据就会去咬一个真实世界里不存在的情形。形状不对的桩，比没有桩更危险。
 */
const modelLike = () => {
  const told: string[] = [];
  const painted: string[] = [];
  const gen: ImageGenerator = async (req) => {
    const m = COLOUR_IN_PROMPT.exec(req.prompt);
    if (m === null) throw new Error(`提示词里没写底色 —— 桩没法照它画：\n${req.prompt}`);
    told.push(m[1]!);
    const k = deliveredColour(m[1]!);
    painted.push(`#${k.map((v) => v.toString(16).padStart(2, "0")).join("")}`);
    const n = Number(CELLS_IN_PROMPT.exec(req.prompt)?.[1] ?? 1);
    const w = req.size.w, h = req.size.h, cellW = w / n;
    const data = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cell = Math.min(n - 1, Math.floor(x / cellW));
      const inX = x - cell * cellW;
      // 每格的墨占中间 40% —— 留下的那圈底正好是「四周很窄的空白」与「角色之间的缝」
      const inner = inX >= cellW * 0.3 && inX < cellW * 0.7 && y >= h * 0.3 && y < h * 0.7;
      const c = inner ? px("#3e3236") : k;
      const o = (y * w + x) * 4;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
    return {
      image: { width: w, height: h, data } as RasterImage,
      call: { protocol: "openai", requestedSize: `${w}x${h}`, ms: 1, attempts: 1 },
    };
  };
  return { gen, told, painted };
};

// ⚠️ **这里曾经有第二份 `imageUnits()`**（7 行复制品，注释还自称「与 `pack.ts` 的划分同构」）。
//   票 40 把它删了、改成 import 共享的那把尺子 —— 两份互相保证的实现在源码上再也看不见。
//   ⚠️ **牙齿不在那把尺子上，在 `told` 上**：`told` 是**桩实际收到的调用**（观测到的真相），
//   与「谁算的」无关 ⇒ `pack` 的展开真错了它就会红。**不能**拿共享函数同时生成预期值和实际值。

describe("9 份手写 fixture：**每一份都过契约、都出得了包**（票 35 的全量校验）", () => {
  it("先把清单点清 —— 少测一份就等于少一份保证", () => {
    expect(RECIPES).toEqual([
      "counter-siege-derived.json", "counter-siege.json", "last-train-image.json",
      "last-train.json", "shift-change-image-anim.json", "shift-change-master.json",
      "shift-change-mixed.json", "shift-change-openai.json", "shift-change.json",
    ]);
  });

  for (const file of RECIPES) {
    it(file, async () => {
      const parsed = parseRecipe(JSON.parse(readFileSync(path.join(RECIPE_DIR, file), "utf8")));
      expect(parsed.ok, parsed.ok ? "" : parsed.errors.join(" / ")).toBe(true);
      if (!parsed.ok) return;
      const recipe = parsed.value;
      const style = styleOf(recipe);
      const { gen, told, painted } = modelLike();

      const run = buildAssetPack({
        recipe, style, outDir: tmp(), recipeDir: RECIPE_DIR,
        generate: stub, generateImage: gen, sourceDateEpoch: EPOCH,
      });

      // ⚠️⚠️ **2026-10-10 由票 38 翻过来的那一支。**
      //   票 37 的 Q3 把「背景层要不要也改成众数色」推给了票 38，而那张票今天裁完了：
      //   **非最远层按这张图上量出来的众数色抠，最远层压根不抠**。
      //   ⇒ 这里原来那条 `rejects.toThrow(/底色一个像素都没抠到/)` **必须翻过来**（改成
      //   断言它**出得了包**）—— 桩交的是**另一个颜色**（= 模型实测的行为），
      //   而今天正是**按那个颜色**抠的，所以它再也抛不出来。
      //   ⚠️ 那个特例分支就此**没有存在理由**：这一份与其余八份走同一条路。

      const { manifest, packDir, audit } = await run;

      expect(audit, "对账不为空").toEqual([]);
      expect(verifyPack({ packDir }).data.ok, "包自身校验不过").toBe(true);
      expect(manifest.assets.length).toBe(recipe.assets.length);

      // ⚠️ **提示词那一侧仍然要同源**：每一次生图调用被告诉的那个底色，必须是这个风格
      //   **派生**出来的那一个。只要有一发说的是别的颜色，就意味着「提示词」自己就分家了。
      const key = keyColorFor(style.palette);
      expect(told.filter((c) => c !== key), `有调用被告诉了一个别的底色（期望 ${key}）`).toEqual([]);

      // ⚠️ **而交付那一侧必须不同**（票 37）：桩要是画了声明色，这个测试环境就**没有牙齿**了
      //   —— 它又会变回「照着提示词画的傀儡」，而这正是票 37 §4 那个「三道闸全绿而规则是错的」。
      expect(painted.filter((c) => c === key), "桩交付了声明色 —— 测试环境退化成傀儡了").toEqual([]);

      // ⚠️ 而**「一次都没发」也要能被看见**：`told` 全空的话上面那句是空转的真话。
      //   预期值取自**与检查点同一把尺子**（`imageCallsOf`，票 40）—— 左半边是「谁算的」，
      //   右半边 `told` 是「真发了什么」，**两边不同源**才有牙齿。
      const want = imageCallsOf(recipe).total;
      expect(told, `这份清单该有 ${want} 次生图调用`).toHaveLength(want);
    });
  }
});
