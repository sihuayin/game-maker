// `prompt.ts` —— 给模型看的那些文字。⚠️ 它测的是**散文**，而那正是重点：
// 三张票（01 / 05 / 08）各自证明过同一件事 —— **提示词里写错的一句话，模型会照着错**，
// 而错法**看起来很正常**。所以凡是「不该再这么写」的地方，得有一条会红的测试守着。
import { describe, expect, it } from "vitest";
import { TD_REFERENCE_SCALE, recipeShapeSpec, tdConfigPrompt } from "../src/index.js";

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

  it("⚠️ 路径必须**照着地图读出来** —— 那是 8 次真跑里 7 次失败的那一处", () => {
    // ⚠️ 实测：连跑 8 次，**7 次**被校验拒，而失败几乎全在同一族 ——
    //   「`path.points` 的坐标」与「地图上画成 `:` 的格」对不上。
    //   只写「坐标要落在走道那一格的中心上」不够（模型会另写一套），
    //   所以要给它一个**做法**：先定地图、再沿 `:` 把它读出来，并自查一遍。
    expect(prompt).toMatch(/必须「照着地图读出来」/);
    expect(prompt).toMatch(/写完自查一遍/);
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
