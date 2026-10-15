// 设计编译那一步的**问话面** —— 两条**结构性**判据住在这里：
//   ① 提示词骨架必须把契约的**每一个键**都点名（① 档欠条要的「逐个点名」）；
//   ② **设计层那 12 个 ① 档字段**必须被**明确生产**（票 10 落地时的裁定原话：
//      「Design 12 个必须在本票 prompt 中明确生产，但业务消费者在下游」）。
import { describe, expect, it } from "vitest";
import { GameDesignSpecSchema } from "@game-maker/contracts";
import { DESIGN_TOOL_DESCRIPTION, DESIGN_TOOL_NAME, designPrompt, intentPrompt } from "../src/index.js";
import { INTENT, VWS } from "./fixtures.js";

const ECHO = { runtimeProfile: "platformer/v1", genre: "platformer", camera: "side" };
const KEYS = Object.keys(GameDesignSpecSchema.shape);
const prompt = (over: Partial<Parameters<typeof designPrompt>[0]> = {}) =>
  designPrompt({ intent: INTENT, vws: VWS, echo: ECHO, ...over });

/** 设计层那 **12 个 ① 档字段**（`game-design.ts:16-30` 的欠条，逐字抄下来）。 */
const ONE_TIER = [
  "world.theme", "world.setting", "world.structure",
  "player.role", "player.abilities",
  "enemies[].behavior", "enemies[].threat",
  "npcs[].role", "npcs[].interaction",
  "interactables[].type", "interactables[].behavior",
  "levels[].purpose"
];

describe("提示词骨架", () => {
  it("⚠️ **契约的每一个键都在骨架里被点名**（① 档欠条要的「逐个点名」）", () => {
    const p = prompt();
    expect(KEYS.filter((k) => !p.includes(`\`${k}\``))).toEqual([]);
    // ⚠️ 只数**字段台账那一段**里的条目 —— 全篇还有别的 `- \`x\`` 开头的行（照抄那三个值），
    //   拿整篇数会数出 19 来（第一版就是这么错的）。
    const hints = p.split("# 必须")[1]!.split("\n# 照抄")[0]!;
    expect(hints.split("\n").filter((l) => l.startsWith("- `"))).toHaveLength(KEYS.length);
  });

  it("⚠️ **那 12 个 ① 档字段逐个具名出现**（本票要「明确生产」它们，不是随便发挥）", () => {
    const p = prompt();
    expect(ONE_TIER.filter((f) => !p.includes(`\`${f}\``))).toEqual([]);
  });

  it("意图层那 6 个 ① 档字段是**按值插进具名位置的**（欠条的另一半）", () => {
    const p = prompt();
    expect(p).toContain(INTENT.subgenre!);
    expect(p).toContain(INTENT.camera!);
    expect(p).toContain(INTENT.targetExperience);
    expect(p).toContain(INTENT.world.atmosphere);
    expect(p).toContain(INTENT.player.role);
    expect(p).toContain(INTENT.entities[0]!.role);
  });

  it("⚠️ **`world.structure` 要与参考图挂钩**（VWS 的 `composition` 落点，票 10 的 Q1）", () => {
    const p = prompt();
    expect(p).toContain("world.structure");
    expect(p).toContain(VWS.composition.midground!);      // 真值插进去了，不是只提了个名字
    expect(p).toContain("照参考图那个世界的结构写");
  });

  it("⚠️ **`levels[].layout` 要与参考图的环境挂钩**（VWS 的第二个落点）", () => {
    const p = prompt();
    expect(p).toContain(VWS.environment.architecture!);
    expect(p).toContain(VWS.environment.terrain!);
  });

  it("⚠️ 实体那一列把意图的 `id` 与 `type` **逐条递过去**（id 延续靠它，不许模型改名）", () => {
    const p = prompt();
    for (const e of INTENT.entities) {
      expect(p).toContain(e.id);
      expect(p).toContain(e.type);
    }
    expect(p).toContain("原样沿用");
    expect(p).toContain("不许改、不许删、不许换桶");
  });

  it("⚠️ **三条「玩家 / 桶」的散文口径一致**（票 53：三处一起改口，别只改一处）", () => {
    const p = prompt();
    // ⚠️ 票 42 一次加了**三处**说同一件事的地方（工具说明第 4 条 + `npcs` / `levels` 两条字段台账），
    //   票 53 因此**三处一起**改口。⚠️ 只锚工具说明那一处的话，另外两处**漂回旧口径也不会红** ——
    //   而「漂回去」正是第八次真跑段 A 那种死法（`auditIntentCoverage` 拒「缺了 `scavenger`」）。
    expect(DESIGN_TOOL_DESCRIPTION).toContain("不是「把桶里那条删掉」");   // ① 工具说明第 4 条
    expect(p).toContain("意图层已经登记过的那条要留着");                    // ② `npcs` 台账
    expect(p).toContain("意图层登记过的那条**留着**");                     // ③ `levels` 台账
  });

  it("⚠️ **「覆盖 + 补全」写进了提示词**（R2-Q1 的裁定：这一层可以多，不可以少、不可以改）", () => {
    const p = prompt();
    expect(p).toContain("意图覆盖 + 需求补全");
    expect(p).toContain("不是**意图的镜像");
    expect(p).toContain("补全");   // 「这一层可以补全」那句
    expect(p).toContain("**可以多，不可以少、不可以改**");
    // ⚠️ 而依据必须是**需求**，不是模型自己的口味 —— 探针那次 `e-water` 是对的，
    //   因为意图层的 `coreLoopSteps` 说了「收集废料与净水」
    expect(p).toContain("依据是需求");
    expect(p).toContain("别加");
  });

  it("三个照抄值递过去了，且说清了「装配时会覆盖」", () => {
    const p = prompt();
    expect(p).toContain(ECHO.genre);
    expect(p).toContain(ECHO.camera);
    expect(p).toContain('"id":"platformer"');
    expect(p).toContain("强制覆盖");
  });

  it("`game.title` 的建议**只在用户起了名时**给（别替用户编名字）", () => {
    expect(prompt({ echo: { ...ECHO, gameTitleHint: "铁轨末班" } })).toContain("`game.title` 建议用");
    expect(prompt({ echo: ECHO })).not.toContain("`game.title` 建议用");
    // ⚠️ 「只在 `intent.title` 有值时才递这个 hint」那半在 `compile-design.ts`，
    //   由 `compile-design.test.ts` 的「三个照抄值递过去了」那条盯着。
  });

  it("两张封闭词表都摊开在提示词里（模型只能从里面挑）", () => {
    const p = prompt();
    expect(p).toContain("jump");
    expect(p).toContain("reach-goal");
    expect(p).toContain("input:keyboard");
    expect(p).toContain("coord:delivery-pixels");
  });
});

describe("工具说明 = schema 说不清的东西唯一的家（R2-Q5）", () => {
  it("① 那条 gate 的规矩写在这里（`toJSONSchema` 丢了 `superRefine`，模型看不见它）", () => {
    expect(DESIGN_TOOL_DESCRIPTION).toContain("不许有空串");
    expect(DESIGN_TOOL_DESCRIPTION).toContain("至少一条");
    expect(DESIGN_TOOL_DESCRIPTION).toContain("四个桶本身可以是空的");
  });

  it("② 封闭枚举那条**做不了就整条省掉、不许挑近似的** —— 静默损失比省掉更糟", () => {
    expect(DESIGN_TOOL_DESCRIPTION).toContain("整条省掉");
    expect(DESIGN_TOOL_DESCRIPTION).toContain("静默丢东西");
    // ⚠️ 半句都要盯住：只锚「整条省掉」的话，**「不许挑个近似的」那半句被改掉也不会红**
    //   （票 10 的变异第 22 发就是这么漏的 —— 变异瞄准的句子没有判据看着）。
    expect(DESIGN_TOOL_DESCRIPTION).toContain("不许");
    expect(DESIGN_TOOL_DESCRIPTION).toContain("挑一个「近似的」顶上去");
    // ⚠️ **2026-10-13（票 54）**：上面那几句的**后半截换过口**。原文「省掉之后由 `compile-design` 判：
    //   那正是『外壳做不了它』被说出来的一刻」读起来像「判 = 一个中性的观察」，而实际是
    //   **整份拒绝、退 4、链断在这儿** ⇒ 第八次真跑量到的正是这个后果的形状：
    //   **听话的那一条死了（`wasteland-bg`）、拿近似值顶替的六条活了**。
    expect(DESIGN_TOOL_DESCRIPTION).toContain("整份拒绝");
    expect(DESIGN_TOOL_DESCRIPTION).toContain("退出码 4");
    expect(DESIGN_TOOL_DESCRIPTION).toContain("点名");
    // ⚠️ 而「顶替」那半句**反过来**也要说清：省掉至少当场叫停，顶替是没人看见的丢东西。
    expect(DESIGN_TOOL_DESCRIPTION).toContain("没人看见的丢东西");
  });

  it("⚠️ 「`id` 照抄意图层」（字段台账）与「挑不出对家就省掉」（第 2 条）**不再打架**（票 54）", () => {
    // ⚠️ 上面那条 pin 的是工具说明，而**真正把模型推上「近似顶替」那条路的是字段台账**：
    //   第八跑那份提示词里，`mechanics` 台账写着「`id` **照抄意图层**」，第 2 条却写着「整条省掉」——
    //   合起来等于「意图里**每一条**机制的 `id` 都要出现在设计里」⇒ 挑不出对家的那些**只能**填近似值
    //   （盘上 3 份 + 第七跑全是这么过的）。⇒ 两句必须说清是同一条规矩的两个方向。
    expect(prompt()).toContain("只在你能给它挑出一个对家时");
    expect(prompt()).toContain("整条省掉");
  });

  // ── 票 74 · 上面那条的**下一半**：散文 vs **机器** ─────────────────────────────────────
  //
  // ⚠️ 上面那条修的是**散文内部**的打架（台账「`id` 照抄意图层」vs 第 2 条「整条省掉」）；
  //   而「**散文 vs 机器**」那处它修不了 —— gate ④ 只数长度，却明写着「`mechanics` 至少一条」
  //   ⇒ 散文叫模型做一件机器会拒的事，而模型**读不到拒绝的理由**（盲重采样三发）。
  //   票 74 把 gate ④ 那一格移了出去（人裁 Q1 = (a)，判据归 R12）⇒ 两处**这才**同步。
  // ⚠️ 下面一条钉两半：**工具说明**那句并列清单里不再有 `mechanics`（且不是删了、是说清了为什么），
  //   **字段台账**那一格不再要求「至少一条」（而票 54 那两句**留着** —— 原则不变）。
  it("⚠️ 票 74：散文两处**不再要求 `mechanics`「至少一条」**（gate ④ 已把它交给 R12）", () => {
    // ① 工具说明：那句「至少一条」的并列清单里**不再有 `mechanics`**……
    const line = DESIGN_TOOL_DESCRIPTION.split("\n").find((l) => l.includes("至少一条"))!;
    expect(line, "其余那些格子照旧").toContain("coreLoopSteps");
    expect(line, "⚠️ 而 `mechanics` 不在这一句里了").not.toContain("mechanics");
    // ……而它**不是被删掉**：紧接着要说清「它不在这一句里」以及它什么时候可以是空的
    expect(DESIGN_TOOL_DESCRIPTION).toContain("**不在这一句里**");
    expect(DESIGN_TOOL_DESCRIPTION).toContain("可以整个是空数组");
    // ② 字段台账那一格：末尾那句「至少一条」没了，而**票 54 那两句留着**
    const cell = prompt().split("\n").find((l) => l.startsWith("- `mechanics`"))!;
    expect(cell, "票 54 的原则不变").toContain("只在你能给它挑出一个对家时");
    expect(cell, "票 54 的原则不变").toContain("整条省掉");
    expect(cell, "⚠️ 这一格不再要求「至少一条」").not.toContain("至少一条");
    expect(cell, "要说清「一条都挑不出时可以是空的」").toContain("可以是空的");
    // ③ ⚠️ **意图层那一侧照旧** —— 它那条 gate（`game-intent.ts` 的 `mechanics` ≥ 1）**还在**，
    //   而两处散文住在**同一份文件**里 ⇒ 这条就是「别把两个面一起改了」的那道闸。
    const intentCell = intentPrompt({ requirementText: "x" }).split("\n").find((l) => l.startsWith("- `mechanics`"))!;
    expect(intentCell, "意图层的 `mechanics` 仍要求至少一条 —— 它那条 gate 没跟着动").toContain("至少一条");
  });

  it("③ id 分两种：意图已有的**原样沿用**（不许改/删/换桶）· 这一层新加的**允许**但**依据必须是需求**", () => {
    expect(DESIGN_TOOL_DESCRIPTION).toContain("原样沿用");
    expect(DESIGN_TOOL_DESCRIPTION).toContain("不许改、不许删、不许换桶");
    expect(DESIGN_TOOL_DESCRIPTION).toContain("允许");
    expect(DESIGN_TOOL_DESCRIPTION).toContain("新东西的依据是需求");
    expect(DESIGN_TOOL_DESCRIPTION).toContain("别加");        // 「你觉得总该有 X」那种不算依据
    expect(DESIGN_TOOL_DESCRIPTION).toContain("净水");        // 探针那个正例被写进去了
  });

  it("④ `levels[].entities` 是引用、必须解得开", () => {
    expect(DESIGN_TOOL_DESCRIPTION).toContain("引用");
    expect(DESIGN_TOOL_DESCRIPTION).toContain("真的存在");
    // ⚠️ **票 42（2026-10-13）**：引用面扩到**玩家**（Q6），并明说**不许把玩家复制进桶**（Q7 的提示词那一半）。
    //   两条都盯住：只锚「玩家」的话，「不许复制」那半句被删掉也不会红 ——
    //   而它正是 6/6 份真实设计撞出来的那个形状（NPC 桶里躺着「玩家控制的拾荒者本人」）。
    expect(DESIGN_TOOL_DESCRIPTION).toContain("玩家或上面四个桶里");
    // ⚠️ **2026-10-13 稍晚（票 53）**：上面那半句的**表述换过** —— 票 42 原本写的是
    //   「别在 `npcs[]` 里再写一条「玩家本人」」，而第八次真跑段 A 量到模型把它读成了
    //   「**把意图层那条删掉**」⇒ 撞上第 3 条（不许删）⇒ 7/7 跑死在 `intent-entity-missing`。
    //   锚跟着搬到新表述上：要钉的是**「改的是 `player.id`、不是删掉桶里那条」**这半句 ——
    //   只锚前一半不够（那接近旧话的意思），必须锚住**「不是删掉」**那一半。
    expect(DESIGN_TOOL_DESCRIPTION).toContain("要**另起**的是 `player.id`");
    expect(DESIGN_TOOL_DESCRIPTION).toContain("不是「把桶里那条删掉」");
  });

  it("工具名与提示词尾句对得上", () => {
    expect(DESIGN_TOOL_NAME).toBe("emit_game_design");
    expect(prompt()).toContain(DESIGN_TOOL_NAME);
  });
});
