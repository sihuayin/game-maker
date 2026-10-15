// **跨阶段一致性**：样板那份背景层 × 段 B 的骨架世界（[票 88](.scratch/game-maker-v2/issues/88-recipe-shape-sample-as-data.md) · [票 76](.scratch/game-maker-v2/issues/76-cross-stage-sample-conflict.md) 的 Q2）。
//
// ⚠️ **它补的是什么**：票 76 的立案现场逐字 ——「今天两份样板**各自没有一条判据看着它们合起来的样子**」。
//   票 76 量到的那个形状就是这么漏出去的：段 A 教 `sky` 不铺 + `parallax 0.3`、段 B 教世界宽 1440，
//   而票 65 那条判据说这两样配在一起**必拒**；⛔ 而链上**没有东西**看着这个组合。
//
// ⚠️ **它读的是数据，不是正则解析那段散文**（票 88 的 Q2 逐字：「不能只靠人工对读」）——
//   所以 `RECIPE_SAMPLE_BACKGROUND` 必须是导出的数据，而不是埋在模板串里的一段字。
//
// ⚠️ **两个假设写在文件头**（它们是这条测试的立论前提；不写就是下一个人踩的坑）：
//   ① **层按视口尺寸作画**（`NOMINAL` 取 `DEFAULT_VIEWPORT`）。盘上三份真产物逐份都是 480×270
//      （票 76 的探针量的），而它**不是契约规定的** —— `AssetPackEntry.size` 由清单写。
//   ② **`nominal` 是资源级的**：`ops.ts` 的 config 侧与 `demo/src/draw.ts` 都取 `asset.size`
//      ⇒ **层与层不能各自定宽**，所以那条规矩的第二支说的是「把**这件资源**画得足够宽」
//      （票 76 的人裁原话逐字：「或将**资源**绘制得足够宽」）。
//   ⇒ 于是这条测试证的是「**样板那份形状 × 骨架那个世界**」的相容性，
//     **不证**任意尺寸的层都安全。
import { describe, expect, it } from "vitest";
import { auditLayerCoverage, layerDrawnSize } from "@game-maker/contracts";
import {
  DEFAULT_VIEWPORT, gameConfigExample, recipeShapeSpec,
  RECIPE_SAMPLE_BACKGROUND, type RecipeSampleLayer
} from "../src/index.js";

/** 样板那几层画出来多大 —— 见文件头假设 ①。 */
const NOMINAL = { w: 480, h: 270 };

/** 段 B 那个骨架世界（`ops.ts` 的 `gameConfigExample`，逐字 1440×270）。 */
const WORLD = gameConfigExample.world.size;

/** 把一层层摆成一轮审计的入参 —— 与 `ops.ts` 的 config 侧、`draw.ts` 的站点侧**同一套算法**。 */
const auditSample = (layers: readonly RecipeSampleLayer[]) =>
  auditLayerCoverage(DEFAULT_VIEWPORT, WORLD, layers.map((l) => ({
    where: "scene.background[0]", name: l.name, parallax: l.parallax,
    drawn: layerDrawnSize({ tileable: l.tileable, nominal: NOMINAL }, WORLD)
  })));

describe("⭐ 跨阶段：样板那份背景层 × 段 B 的骨架世界（票 76 / 票 88）", () => {
  it("① 阳性：样板那份数据 × 骨架那个世界 ⇒ **零 error**", () => {
    expect(auditSample(RECIPE_SAMPLE_BACKGROUND)).toEqual([]);
  });

  it("② ⚠️ **不是恒真**：把最远那层退回 `parallax: 0.3` ⇒ 当场红，且报文里有 192×270", () => {
    // ⚠️ 这一条是**必需的**：没有它，上面那条可能只是「判据在这个入参上恒绿」。
    //   而 192 这个数与 `demo/tests/site.test.ts` 那句注释**同一个数** —— 那一处正是
    //   「把合规夹具的 `sky` 从 0 改成 0.3」造出来的、票 40 算过的那条拒绝。
    const broken: RecipeSampleLayer[] = [
      { ...RECIPE_SAMPLE_BACKGROUND[0]!, parallax: 0.3 },
      ...RECIPE_SAMPLE_BACKGROUND.slice(1)
    ];
    const issues = auditSample(broken);
    expect(issues).not.toEqual([]);
    expect(issues.some((i) => i.message.includes("192×270px"))).toBe(true);
  });

  it("③ 规矩在场：那段字逐字给出**配对规矩**，而**旧的宽泛示范已撤**", () => {
    const spec = recipeShapeSpec();
    expect(spec).toContain("不平铺的层，`parallax` 必须是 `0`");
    expect(spec).toContain("必须写 `tileable`");
    expect(spec).toContain("画得足够宽");
    // ⚠️ 旧那句把「天空不平铺」说成了**示范** —— 而人裁明令不许只改数字、留下它
    //   （票 76 Q1 逐字：「否则，中间层仍可能生成 `parallax: 0.4` 且不平铺的错误形状」）。
    expect(spec).not.toContain("不平铺的层**别写 tileable**");
    expect(spec).not.toContain("天空不平铺");
  });

  it("④ 样板那一行**由数据渲染**，且逐字就是这三层（模型读到的字）", () => {
    // 先钉「它确实是渲染出来的」……
    expect(recipeShapeSpec()).toContain(
      `  background → "layers":[${RECIPE_SAMPLE_BACKGROUND.map((l) => JSON.stringify(l)).join(",\n" + " ".repeat(25))}]`
    );
    // ……再把渲染结果本身钉死（换列宽 / 换层会在这一行红）
    expect(recipeShapeSpec()).toContain(
      '  background → "layers":[{"name":"sky","parallax":0},\n' +
      '                         {"name":"wall","parallax":0.6,"tileable":{"x":true,"y":false}},\n' +
      '                         {"name":"ground","parallax":1,"tileable":{"x":true,"y":false}}]'
    );
  });

  it("⑤ 没碰模型读到的**其余**字面：animation 那一行与九宫格那三句照旧", () => {
    // （`prompt.test.ts` 另有更细的九宫格断言；这里只钉「本票没把它们碰掉」。）
    const spec = recipeShapeSpec();
    expect(spec).toContain('animation  → "animations":[{"name":"walk","frames":4,"fps":8,"loop":true}, ...]');
    expect(spec).toContain("ui         → **没有必须加的键**");
    expect(spec).toContain("中央区必须平坦且可任意重复");
    expect(spec).toContain("画出来会是一圈空心框，而不是一个图标");
  });
});
