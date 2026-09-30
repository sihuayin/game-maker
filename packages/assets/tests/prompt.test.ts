// `prompt.ts` —— 给模型看的那些文字。⚠️ 它测的是**散文**，而那正是重点：
// 三张票（01 / 05 / 08）各自证明过同一件事 —— **提示词里写错的一句话，模型会照着错**，
// 而错法**看起来很正常**。所以凡是「不该再这么写」的地方，得有一条会红的测试守着。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TD_REFERENCE_SCALE, assetTask, recipeShapeSpec, tdConfigPrompt } from "../src/index.js";
import type { StyleSpec } from "@game-maker/contracts";

describe("清单的形状说明：**同时钉住两边**（票 08）", () => {
  const spec = recipeShapeSpec();

  it("`ui` 那头：**不再是**「ui 就该写 ninePatch」的形状", () => {
    // 病根就是这一行 —— 它把 `ninePatch` 与 `animations` / `layers` 并列成「ui 的形状」，
    // 于是三张 derive 出来的清单里 ui **百分之百**都带它。
    expect(spec).not.toMatch(/ui\s+→\s*"ninePatch"/);
    expect(spec).toMatch(/ui\s+→\s*\*\*没有必须加的键\*\*/);
  });

  it("**面板那头必须保留**「该写它」的说法 —— 免得下一次「统一措辞」把它一起抹平", () => {
    // ⚠️ 这一条是**两边**里的另一边。只钉「不许写」会把面板也一起禁掉，
    //   而面板恰恰是唯一真该写它的那一类。（`game-creation-v1` 的票 51 吃过同款的亏。）
    expect(spec).toMatch(/✅ \*\*该写\*\*：面板/);
    expect(spec).toMatch(/❌ \*\*不该写\*\*：\*\*图标/);
  });

  it("说了**害处** —— 写了它，这张图会按九宫格的规矩画，中央不许画东西", () => {
    // 光是标「可选」不够：模型会把「可选」读成「写上更保险」。
    // 真正让它判断对的是这条 —— 写了它，**画**就被约束了。
    expect(spec).toMatch(/中央区必须平坦且可任意重复/);
    expect(spec).toMatch(/一圈空心框/);
  });
});

describe("塔防提示词：几处**量出来的**措辞，别被「统一措辞」抹平", () => {
  const prompt = tdConfigPrompt("（需求）", "（清单）", { format: "td-config/v1" });

  it("⚠️ 路径**不由模型写** —— 那一族失败（坐标与地图对不上）被做成了结构上不可能", () => {
    // ⚠️ 实测 20 次真调用：单次过 ≈ 25%，而失败**几乎全在同一族** ——
    //   「`path.points` 的坐标」与「地图上画成 `:` 的格」对不上。
    //   「再写硬一点」（0/4 → 1/4）与「换个更大的模型」（代理忽略模型名）都够不着它
    //   ⇒ 票 12 的裁决不是再求模型一次，而是**换掉谁写它**：路径由工具从地图派生。
    expect(prompt).toMatch(/不要写 `path` 这一块/);
    expect(prompt).toMatch(/由工具从你画的那张地图/);
    // ⚠️ 而顶层键清单里**不许再出现 `path`** —— 留在那儿，模型就会写它（模板比铁律更有分量）。
    expect(prompt).not.toMatch(/顶层只有这些键：[^\n]*path/);
    // 派生的前提是走道**只有一条** —— 所以那条「不许分叉」必须还在
    expect(prompt).toMatch(/走道要连成正好一条/);
    expect(prompt).toMatch(/也不要在中间分叉/);
  });

  it("⚠️ `aoe` 塔**不写 projectile**、`slow` 是个对象 —— 这两条是原型第一次真跑被拒的三处之二", () => {
    expect(prompt).toMatch(/`aoe` 塔不写 `projectile`/);
    expect(prompt).toMatch(/是个\*\*对象\*\*/);
  });

  it("⚠️ 砖的尺寸必须等于 cell、锚点必须正中 —— 外壳按「格心 + 锚点」摆精灵", () => {
    expect(prompt).toMatch(/砖的尺寸必须正好等于/);
    expect(prompt).toMatch(/锚点必须是正中/);
  });

  it("那个**方向**（宁可写弱）与那条**铺开**（插槽沿走道）都在 —— 它们是量出来的，不是口味", () => {
    expect(prompt).toMatch(/宁可把敌人写弱、把塔写便宜/);
    expect(prompt).toMatch(/插槽要沿走道铺开/);
    expect(prompt).toMatch(/10 倍量级/);
  });

  it("刻度是真的：区间里的上下界都能在提示词里找到", () => {
    const s = TD_REFERENCE_SCALE;
    expect(prompt).toMatch(new RegExp(`${s.damage.min}–${s.damage.max}`));
    expect(prompt).toMatch(new RegExp(`${s.hp.min}–${s.hp.max}`));
  });
});

describe("清单那条路（drawlist）也读**逐层描述**（票 02）", () => {
  // ⚠️ 这一条是**补的**：`assetTask` 此前**一条用例都没有**，而票 02 给它的逐帧列表
  //   加了一句「这一层自己那句」—— 改的是一条**本来就跑得通**的提示词。
  //   （那次改动的实测在 `experiments/drawlist-layers/`：四个样本两臂，两臂都过门禁。）
  // ⚠️ 读**那一份**风格规格（`pack.test.ts` / `review.test.ts` 读的是同一个文件）——
  //   再写一份字面量就是第四份会各自漂的副本。
  const STYLE: StyleSpec = JSON.parse(readFileSync(fileURLToPath(new URL(
    "../../../.scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", import.meta.url)), "utf8"));
  const bg = (layers: unknown[]) => ({
    kind: "background" as const, id: "bg", role: "三层视差背景", description: "整张场景那一句",
    styleId: "style-ref", anchor: { x: 0, y: 0 }, size: { w: 480, h: 270 }, required: true,
    layers: layers as never,
  });
  const LAYERS = [
    { name: "sky", parallax: 0, description: "整幅黄昏天空，铺满整块画布" },
    { name: "wall", parallax: 0.6, tileable: { x: true, y: false } },      // 没给 ⇒ 不带那句
    { name: "ground", parallax: 1, tileable: { x: true, y: false }, description: "站台与铁轨那一条" },
  ];

  it("给了自己那句的层，**逐帧列表里带上它**（钉整行 —— 只断「这句话在不在」的话，串错层也过）", () => {
    const lines = assetTask(bg(LAYERS), STYLE).split("\n");
    expect(lines.find((l) => l.includes("层名 sky"))).toBe("  第 1 帧（层名 sky）：从远到近的第 1/3 层 —— 整幅黄昏天空，铺满整块画布");
    expect(lines.find((l) => l.includes("层名 ground"))).toBe("  第 3 帧（层名 ground）：从远到近的第 3/3 层 —— 站台与铁轨那一条");
  });

  it("⚠️ 而整张场景那句**照旧在** —— 这与生图那条路**故意不同**", () => {
    // ⚠️ 生图那条路是**一层一次调用**，整张场景的描述会把这一层带偏 ⇒ 那边给了逐层描述就不带 `role`。
    //   而这条路是**一个资源一次调用画完 N 层**：它要的正是「这几层叠起来是什么」，
    //   逐帧列表里的层名 + 各自那句才是「怎么切」。⇒ 整张那句**不能删**。
    const t = assetTask(bg(LAYERS), STYLE);
    expect(t).toContain("整张场景那一句");
    expect(t).toContain("三层视差背景");
  });

  it("⚠️ **最远那层要另说一套** —— 它后面什么都没有，必须铺满（其余层照旧留空）", () => {
    // ⚠️ 这一条是补的**行为**：这条路此前对每一层都说「没东西的地方留空」，**没有最远层的例外**
    //   —— 而 `backgroundLayerPrompt`（生图那条）有，那是票 51 量出来的。
    //   实测（`experiments/drawlist-layers/`）：不带这一句时，最远层会缩成中间一条带
    //   （一次 56.1%，按「最远层必须画满」那条**会被拒**）；带上之后 3+3 个样本全满。
    const t = assetTask(bg(LAYERS), STYLE);
    expect(t).toMatch(/最远那一层（sky）是上面那条的例外/);
    expect(t).toMatch(/铺满整块画布/);
    expect(t).toMatch(/其余层照上面那条留空/);
  });

  it("⚠️ 没给自己的那层**不许**凭空长出一句（回落是「没有」，不是「拿整张冒充」）", () => {
    const t = assetTask(bg(LAYERS), STYLE);
    const wallLine = t.split("\n").find((l) => l.includes("层名 wall"))!;
    // ⚠️ **断内容，不断那个分隔符**：先写的是 `not.toContain("——")`，而那只钉住了「用什么接」
    //   —— 把回落改成「接一个空格」就能带着整张场景的描述溜过去（实测过）。
    expect(wallLine).toBe("  第 2 帧（层名 wall）：从远到近的第 2/3 层");
    expect(wallLine).not.toContain("整张场景那一句");
  });
});
