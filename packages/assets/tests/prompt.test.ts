// `prompt.ts` —— 给模型看的那些文字。⚠️ 它测的是**散文**，而那正是重点：
// 三张票（01 / 05 / 08）各自证明过同一件事 —— **提示词里写错的一句话，模型会照着错**，
// 而错法**看起来很正常**。所以凡是「不该再这么写」的地方，得有一条会红的测试守着。
import { describe, expect, it } from "vitest";
import { recipeShapeSpec } from "../src/index.js";

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
