// 这一步的**问话面**：工具说明与提示词骨架（票 09 的 R2-Q5 那个杠杆 + R2-Q4 的骨架）。
//
// ⚠️ 这里有一条**结构性的判据**：提示词骨架必须把契约的**每一个键**都点名一遍 ——
//   那就是票 03 的「① 档欠条」要的「逐个点名」。少了哪个键，它在提示词里就不存在，
//   而「不在模板里露脸的字段**当场出局**」。
//
// ⚠️ **票 70（2026-10-14）**：契约 `game-intent.ts:119-121` 自己写着「gate 那条规矩由本文件
//   在工具 `description` 里补」—— 那句自白对 ① ② ③ ⑤ ⑤b ⑤c 六组成立、**对 ④（可选对象的空壳）
//   不成立**。⚠️ 而 `:18-25` 那条**结构性判据今天过得了**，因为**它看的是「名字在不在」、
//   不是「规矩在不在」**（`KEYS` 16 个、`missing=[]`）⇒ ④ 的回归防线只能是一条**新断言**。
//   （⚠️ 陷阱：下面 `it` 标题里的 `①②③④⑤⑥` 是**工具说明第几条**，不是 gate 的组号。）
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

  it("⑥ **先分家**：一句话先判它归哪一格，四格逐个点名（票 54）", () => {
    // ⚠️ 病根（第八次真跑）：需求里「游戏需要有：…」那张清单被**逐条抄进了 `mechanics[]`** ⇒
    //   `chest`/`resource`/`enemy` 同时躺在两个数组里（第 6 条一直禁着、只是没有 gate 看着），
    //   而 `wasteland-bg`/`final-goal` 更是**根本不属于** `mechanics[]`（它们的家是 `world` 与
    //   `winConditions`）⇒ `wasteland-bg` 在设计层找不到枚举对家，**独立**拒掉了一跑。
    expect(TOOL_DESCRIPTION).toContain("先分家");
    for (const home of ["entities[]", "mechanics[]", "winConditions[]"])
      expect(TOOL_DESCRIPTION).toContain(`记进 \`${home}\``);
    expect(TOOL_DESCRIPTION).toContain("`world` 那三格");
  });

  it("⑥ **拆两条**是那条出路，连例子一起给（只禁不给路 ⇒ 模型会去删实体）", () => {
    // ⚠️ 人类裁定的补充裁定 1/2：要给「拆成两条、各起一个 id」的**具体写法**，并明说
    //   **删掉实体不是出路** —— 不说的话，模型躲开冲突最省事的做法就是删，而那是真的丢内容。
    expect(TOOL_DESCRIPTION).toContain("拆成两条、各起一个 id");
    expect(TOOL_DESCRIPTION).toContain("open-chest");
    expect(TOOL_DESCRIPTION).toContain("为了躲开冲突把实体删掉");
  });

  it("⑥ 而「分家」分的是**类别**，不是**做不做得了** —— 不然它跟第 1 条打架", () => {
    // ⚠️ 第 1 条说「照原话记，别按外壳能力筛」，第 6 条说「别把非机制写进 `mechanics[]`」——
    //   两句挨着放会被读成「做不了的也别记」⇒ 外壳做不了的真机制（二段跳 / Boss 战）会被丢掉，
    //   而那正是 R12 **唯一**能说出口的东西。这半句就是那条分界线。
    expect(TOOL_DESCRIPTION).toContain("不是「做不做得了」");
    expect(TOOL_DESCRIPTION).toContain("「二段跳」是机制");
  });

  it("⑥ 第 6 条**升成 gate**：跨数组也不许撞，且出路是拆、不是删（票 54）", () => {
    expect(TOOL_DESCRIPTION).toContain("两张表之间");
    expect(TOOL_DESCRIPTION).toContain("别删实体");
  });

  it("⑥ **伞状动词不是一条机制**：探索/寻宝/冒险拆成移动+收集+抵达，不单独立 `explore`（票 11）", () => {
    // ⚠️ 病根（票 05 重跑）：analyze-intent 把「在废弃城市中探索」抽成独立机制 `mech-explore`，
    //   而设计层 MECHANICS 封闭枚举没有 `explore`（「探索」= 移动+寻找+抵达的合称）⇒ R12 拒绝「悄悄做丢」。
    //   ⚠️ 关键在**跟第 1 条分界**：二段跳是「一条」照样记，探索是「好几条的合称」要拆 —— 不然模型会把
    //   「拆」读成「做不了的也拆掉」，又把 R12 唯一能说出口的那句（二段跳）吞了。
    expect(TOOL_DESCRIPTION).toContain("伞状动词不是一条机制");
    expect(TOOL_DESCRIPTION).toContain("探索");
    expect(TOOL_DESCRIPTION).toContain("拆成");
    expect(TOOL_DESCRIPTION).toContain("explore");
    expect(TOOL_DESCRIPTION).toContain("好几条的合称");
  });

  it("⑥ 字段台账里也各点了一次名（`mechanics` 的边界 / `entities` 不许撞）", () => {
    const p = intentPrompt({ requirementText: "x" });
    expect(p).toContain("都不是机制");                 // `mechanics` 那一条
    expect(p).toContain("与 `mechanics[].id` **不许撞**"); // `entities` 那一条
  });

  it("⚠️ 反例：说明里**一个 `resources` 都没有** —— Q5 之后它不该在模型眼前出现", () => {
    expect(TOOL_DESCRIPTION).not.toContain("resources");
  });

  // ── 票 70 · ⑦：gate ④（可选对象出现了但两端皆空）的散文（人裁 Q1(a) + Q2(c) + Q3(a)）──
  //
  // ⚠️ 病根：**④ 是七组里唯一一组两个面都没有的**。契约 `game-intent.ts:119-121` 逐字写着
  //   「这条规矩由 `prompts.ts` 在工具 `description` 里补」—— ① ② ③ ⑤ ⑤b ⑤c 六组**每个字都在**，
  //   而**没有一行**说得到 ④（第 3 条 `title` 可空讲的是「整个省掉」，不是「空壳」）。
  // ⚠️ 它**没有 Zod 的替身**：`{}` 过得了 Zod（那两个对象 `optional`、两格也 `optional`），
  //   被 `superRefine` 拒 ⇒ 射程**整段**落在 `toJSONSchema` 丢掉的那一半里 ⇒ 散文是它**唯一的家**。
  // ⚠️ 它**有价签**：空壳今天值 3 发（三发 body 逐字节相同 · 抛 · 退 4），合法写法值 1 发。
  it("⑦ 工具说明：可选对象出现了就不能**两端皆空**，且三种情形分得清（票 70）", () => {
    expect(TOOL_DESCRIPTION, "接着第 5 条那句说的，不是另起一条").toContain("可以是空数组");
    expect(TOOL_DESCRIPTION).toContain("两端都空");
    // ⚠️ 人裁的补充边界明写**不许把三种情形混成一种** ⇒ 三条各有一条断言
    expect(TOOL_DESCRIPTION, "① 整个省掉合法").toContain("整个省掉");
    expect(TOOL_DESCRIPTION, "② 只给一格有内容的也合法").toContain("也合法");
    expect(TOOL_DESCRIPTION, "③ 空壳不合法").toContain("判失败");
    // ⚠️ Q3(a)：`""` 与 `"  "` 都要点到，且说得出来「空白按 trim 之后算」
    expect(TOOL_DESCRIPTION).toContain('{description:"  "}');
    expect(TOOL_DESCRIPTION).toContain("trim()");
  });

  it("⑦ 字段台账里也补足了 —— `progression` 那行写全，`challenge` 依「同上」**自动继承**", () => {
    // ⚠️ 为什么只补 `progression`：`challenge` 那行的正文**本来就是一个指针**（「同上」）⇒
    //   补 `challenge` 那行补不进这条规矩，补 `progression` 那行它自动继承（人裁 Q2(c) 的原话）。
    const p = intentPrompt({ requirementText: "x" });
    expect(p, "旧的那半句一个字没动").toContain("推不出就整个省掉");
    expect(p).toContain("写了就不能两端都空");
    expect(p).toContain("合法");                              // ② 那一档
    expect(p).toContain("判失败、当场重来");                    // ③ 那一档
    expect(p, "`challenge` 仍是指针 ⇒ 它继承的是同一条规矩").toContain("难度来源。同上");
  });
});
