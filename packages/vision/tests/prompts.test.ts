// 提示词的判据：**那两条实测纠正必须活着**，以及**工具 description 是三件「模型看不见的事」唯一的家**。
//
// ⚠️ 这两条都不是文风问题：
//   ① 「不要按画面占比排序」—— 参考图 80% 以上是中性色，按占比分配的色板会**全是灰的**，
//      而灰的画不出招牌/发光屏/机器外壳（票 39 量过：参考图有 122,240 种颜色、最高占比 1.42%）。
//   ② `constraints` 不许写「某色面积 < X%」—— 那是一句**没人校验**的字符串，还把重音色当污染物。
import { describe, expect, it } from "vitest";
import { TOOL_DESCRIPTION, TOOL_NAME, visionPrompt } from "../src/index.js";

const P = () => visionPrompt({ requirementText: "  做一个末班车小站的横版过关  ", styleId: "halt-dusk" });

describe("提示词", () => {
  it("需求文本原样进去（R1-Q1）—— 它是这一步看图的第二个理由", () => {
    expect(P()).toContain("做一个末班车小站的横版过关");
    expect(P()).not.toContain("  做一个末班车小站的横版过关  ");   // 首尾空白被 trim 掉
  });

  it("`style.id` 递给模型照抄（票 02 裁决 21）", () => {
    expect(P()).toContain("halt-dusk");
    expect(P()).toContain("照抄");
  });

  it("⚠️ 纠正①活着：**选色不排色**", () => {
    expect(P()).toContain("不要**按画面占比从高到低排序");
    expect(P()).toContain("必须真的出现在这张图里");
  });

  it("⚠️ 纠正②活着：constraints 里**不许写数值面积上限**", () => {
    expect(P()).toContain("某色面积 < X%");
    expect(P()).toContain("重音色当成污染物");
  });

  it("工具名与票 27 探针同名（那批 raw 还躺在 experiments/ 里，要对得上）", () => {
    expect(TOOL_NAME).toBe("emit_visual_world");
    expect(P()).toContain(TOOL_NAME);
  });
});

describe("工具 description —— 三件「模型看不见的事」唯一的家（R2-Q5）", () => {
  it("① 那三个开放对象**不是数组**（票 08 第 05 发正是栽在这里）", () => {
    expect(TOOL_DESCRIPTION).toContain("style.camera");
    expect(TOOL_DESCRIPTION).toContain("不是数组");
  });

  it("② `style` 的键集是封的，且**逐个点名**（第 06 发自造 `environmentStyle` 被拒）", () => {
    for (const k of ["id", "identity", "camera", "composition", "palette", "lighting",
                     "shapeLanguage", "material", "environment", "characterStyle", "constraints", "confidence"])
      expect(TOOL_DESCRIPTION, `description 漏了 style.${k}`).toContain(k);
    expect(TOOL_DESCRIPTION).toContain("不许自造键");
  });

  it("③ 越界与重色 —— `superRefine` 会被转换器丢掉，所以只能写在这里", () => {
    expect(TOOL_DESCRIPTION).toContain("严格小于");
    expect(TOOL_DESCRIPTION).toContain("不许有重复色");
  });

  it("⚠️ **不写**路径那三条 —— 它们管的是调用方注入的 `styleReferences`，模型答不出来（R1-Q2）", () => {
    expect(TOOL_DESCRIPTION).not.toContain("styleReferences");
  });
});
