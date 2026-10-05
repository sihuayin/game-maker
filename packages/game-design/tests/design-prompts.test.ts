// 设计编译那一步的**问话面** —— 两条**结构性**判据住在这里：
//   ① 提示词骨架必须把契约的**每一个键**都点名（① 档欠条要的「逐个点名」）；
//   ② **设计层那 12 个 ① 档字段**必须被**明确生产**（票 10 落地时的裁定原话：
//      「Design 12 个必须在本票 prompt 中明确生产，但业务消费者在下游」）。
import { describe, expect, it } from "vitest";
import { GameDesignSpecSchema } from "@game-maker/contracts";
import { DESIGN_TOOL_DESCRIPTION, DESIGN_TOOL_NAME, designPrompt } from "../src/index.js";
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

  it("⚠️ **「覆盖 + 补全」写进了提示词**（R2-Q1 的裁定：这一层可以多，不可以少、不可以改）", () => {
    const p = prompt();
    expect(p).toContain("意图覆盖 + 需求补全");
    expect(p).toContain("不是**意图的镜像");
    expect(p).toContain("补全");   // 「这一层可以补全」那句
    expect(p).toContain("**可以多，不可以少、不可以改**");
    // ⚠️ 而依据必须是**需求**，不是模型自己的口味 —— 探针那次 `e-water` 是对的，
    //   因为意图层的 `coreLoop` 说了「收集废料与净水」
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
  });

  it("工具名与提示词尾句对得上", () => {
    expect(DESIGN_TOOL_NAME).toBe("emit_game_design");
    expect(prompt()).toContain(DESIGN_TOOL_NAME);
  });
});
