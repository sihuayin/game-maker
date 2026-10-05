// 这一步的**问话面**：工具说明与提示词骨架（票 09 的 R2-Q5 那个杠杆 + R2-Q4 的骨架）。
//
// ⚠️ 这里有一条**结构性的判据**：提示词骨架必须把契约的**每一个键**都点名一遍 ——
//   那就是票 03 的「① 档欠条」要的「逐个点名」。少了哪个键，它在提示词里就不存在，
//   而「不在模板里露脸的字段**当场出局**」。
import { describe, expect, it } from "vitest";
import { GameIntentSpecSchema } from "@game-maker/contracts";
import { TOOL_DESCRIPTION, TOOL_NAME, intentPrompt } from "../src/index.js";

const KEYS = Object.keys(GameIntentSpecSchema.shape);

describe("提示词骨架", () => {
  it("需求原文原样递进去（并 trim）", () => {
    expect(intentPrompt({ requirementText: "  做一个废土横版寻宝游戏\n" }))
      .toContain("做一个废土横版寻宝游戏");
  });

  it("⚠️ **契约的每一个键都在骨架里被点名**（① 档欠条要的「逐个点名」）", () => {
    const p = intentPrompt({ requirementText: "x" });
    const missing = KEYS.filter((k) => !p.includes(`\`${k}\``));
    expect(missing).toEqual([]);
    // 反向：骨架里**不许**多出契约没有的名字（多了就是把模型引向已经不存在的字段）
    const bullets = p.split("\n").filter((l) => l.startsWith("- `"));
    expect(bullets).toHaveLength(KEYS.length);
  });

  it("⚠️ 骨架里**没有** `resources` 这个名字了（Q5：它已经出局，别再把它引回来）", () => {
    const p = intentPrompt({ requirementText: "x" });
    expect(p).not.toContain("`resources`");
    expect(p).toContain("`resource`"); // 而实体那个枚举档**还在**（它是唯一的地方）
  });

  it("工具名出现在提示词里（模型要按名字调它）", () => {
    expect(TOOL_NAME).toBe("emit_game_intent");
    expect(intentPrompt({ requirementText: "x" })).toContain(TOOL_NAME);
  });
});

describe("工具说明 = schema 说不清的东西唯一的家（R2-Q5）", () => {
  it("① `mechanics[].name` 是自由文本、**不许**按外壳能力筛（票 03 播给本票的第一条）", () => {
    expect(TOOL_DESCRIPTION).toContain("自由文本");
    expect(TOOL_DESCRIPTION).toContain("照原话记");
    expect(TOOL_DESCRIPTION).toContain("做不做得了");
  });

  it("② 四个 `entities[].type` 的值**逐个点名**，且说清 `resource` 是资源唯一的地方", () => {
    for (const v of ["enemy", "npc", "interactable", "resource"]) expect(TOOL_DESCRIPTION).toContain(v);
    expect(TOOL_DESCRIPTION).toContain("唯一");
  });

  it("③ `title` 可空、别为填满而编", () => {
    expect(TOOL_DESCRIPTION).toContain("可空");
    expect(TOOL_DESCRIPTION).toContain("别为了填满而编");
  });

  it("④ `ambiguity` 必须**以字段名开头**，且不许写成缺项或设计细节（R2-Q2 的 (c)）", () => {
    expect(TOOL_DESCRIPTION).toContain("字段名开头");
    expect(TOOL_DESCRIPTION).toContain("camera：需求没提");   // 给了一个照抄的例子
    expect(TOOL_DESCRIPTION).toContain("我们没做");            // 「缺项」被显式排除
    expect(TOOL_DESCRIPTION).toContain("不是这份契约的字段");  // 设计细节也被排除
  });

  it("⑤ 那条 gate 的规矩写在这里（因为 `toJSONSchema` 把 `superRefine` 丢了，模型看不见它）", () => {
    expect(TOOL_DESCRIPTION).toContain("不许有空串");
    expect(TOOL_DESCRIPTION).toContain("至少一条");
    expect(TOOL_DESCRIPTION).toContain("可以是空数组");    // entities / win / lose / ambiguity
    expect(TOOL_DESCRIPTION).toContain("不许重复");
  });

  it("⚠️ 反例：说明里**一个 `resources` 都没有** —— Q5 之后它不该在模型眼前出现", () => {
    expect(TOOL_DESCRIPTION).not.toContain("resources");
  });
});
