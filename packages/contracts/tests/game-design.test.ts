// 票 03 给 `GameDesignSpec` 立的判据 —— 与 `game-intent.test.ts` 同规格。
//
//   最要看的两条：
//     §删掉的两个 Requirements —— 它们是 `GameSpec.requirements` 拆成三份长回来的，
//       封口之后它们**进不来**，而不是「靠自觉不写」。
//     §R12 是**结构性**的 —— 设计层填不出一条外壳没有的机制。拒绝不需要谁记得去判：
//       它填不出来。
import { describe, expect, it } from "vitest";
import { GAME_DESIGN_FORMAT, GameDesignSpecSchema, MECHANICS, PLATFORMER_V1, toolInputSchema } from "../src/index.js";

/** ⚠️ **身份冻结**（票 05 Q8）：`{id, version}` 只从契约取，**不许在这里写死字面量** ——
 *  写死两份之后，改一次身份要满仓库找 `"v1"` 那种拼法（它就在这里躺过）。 */
const REF = { id: PLATFORMER_V1.id, version: PLATFORMER_V1.version };

/** 一份**像样**的设计。注意 `mechanics` 里**没有**意图层那条 `m-double-jump`。 */
const DESIGN = {
  format: GAME_DESIGN_FORMAT,
  game: { title: "拾荒者", genre: "platformer", camera: "side-scroll", runtimeProfile: REF },
  coreLoop: ["探索废墟", "收集零件", "抵达终点"],
  player: { id: "p-scavenger", role: "拾荒者", abilities: ["run", "jump"], goals: ["在天黑前抵达"] },
  enemies: [{ id: "e-drone", behavior: "沿固定路线往复", threat: "接触即伤" }],
  npcs: [],
  interactables: [],
  resources: [{ id: "r-part", purpose: "收集目标" }],
  world: { theme: "废土", setting: "铁轨旁的废墟", structure: "三段式，每段一个收集点" },
  levels: [{ id: "l-1", purpose: "教学", layout: "左侧出发，右侧终点", entities: ["e-drone"] }],
  progression: { model: "linear", description: "三关" },
  mechanics: [
    { id: "m-jump", mechanic: "jump" },
    { id: "m-collect", mechanic: "collect-pickup" }
  ],
  winConditions: ["收集三枚零件并抵达终点"],
  loseConditions: ["生命归零"],
  runtimeRequirements: ["input:keyboard", "collision:aabb", "coord:delivery-pixels"]
};

/** 与意图层那份 fixture 的 id 对得上 —— 这是覆盖度能算的前提。 */
const INTENT_MECHANIC_IDS = ["m-jump", "m-double-jump"];

const parse = (over: Record<string, unknown> = {}) => GameDesignSpecSchema.safeParse({ ...DESIGN, ...over });

describe("§判别式", () => {
  it("`format` 必填且是 literal —— §4 今天**连 `schemaVersion` 都没有**，本契约是补的", () => {
    expect(parse().success).toBe(true);
    expect(parse({ format: "game-intent/v1" }).success).toBe(false);
    expect(parse({ format: "1.0" }).success).toBe(false);
  });
});

describe("§删掉的两个 Requirements：封口之后真的进不来", () => {
  it.each([
    ["assetRequirements", ["一张图"]],
    ["visualRequirements", ["黄昏调"]],
    ["interactionModel", ["推箱子"]],
  ])("`%s` 被拒", (k, v) => expect(parse({ [k]: v }).success).toBe(false));
});

describe("§runtimeProfile 是引用不是裸串（票 03 Q5）", () => {
  it("`{id, version}` 两样都要 —— 单一个名字对不上版本，拒绝时说不出是哪一代的能力", () => {
    expect(parse({ game: { ...DESIGN.game, runtimeProfile: "platformer" } }).success).toBe(false);
    expect(parse({ game: { ...DESIGN.game, runtimeProfile: { id: "platformer" } } }).success).toBe(false);
    expect(parse({ game: { ...DESIGN.game, runtimeProfile: REF } }).success).toBe(true);
  });
});

describe("§title 的不对称的另一半", () => {
  it("设计层**必填**且非空 —— 起名是设计行为，空着 `compile-design` 得造一个", () => {
    expect(parse({ game: { ...DESIGN.game, title: "" } }).success).toBe(false);
    const { title: _drop, ...game } = DESIGN.game as Record<string, unknown>;
    expect(parse({ game }).success).toBe(false);
  });
});

describe("§封闭的能力集（票 03 Q3）", () => {
  it("`runtimeRequirements` 只收词表里的值 —— 自由文本比不了 `RuntimeProfile`", () => {
    expect(parse({ runtimeRequirements: ["input:keyboard"] }).success).toBe(true);
    expect(parse({ runtimeRequirements: ["需要键盘"] }).success).toBe(false);
    expect(parse({ runtimeRequirements: ["gpu:raytracing"] }).success).toBe(false);
  });
});

describe("§R12 是结构性的：外壳没有的机制，**填不出来**", () => {
  it("`mechanics[].mechanic` 是封闭枚举", () => {
    expect(parse({ mechanics: [{ id: "m-x", mechanic: "double-jump" }] }).success).toBe(false);
    expect(parse({ mechanics: [{ id: "m-x", mechanic: "attack" }] }).success).toBe(false);
    expect(parse({ mechanics: [{ id: "m-x", mechanic: "jump" }] }).success).toBe(true);
  });

  it("词表里每一个值都真的填得进去（负判据不许误伤正例）", () => {
    for (const m of MECHANICS)
      expect(parse({ mechanics: [{ id: "m", mechanic: m }] }).success, m).toBe(true);
  });
});

describe("§四项引用族都要 id（票 03 Q3(a)）", () => {
  it.each(["enemies", "npcs", "interactables", "resources"])("`%s` 的每一项都要求 id", (bucket) => {
    const item = bucket === "enemies" ? { behavior: "b", threat: "t" }
      : bucket === "npcs" ? { role: "r", interaction: "i" }
      : bucket === "interactables" ? { type: "t", behavior: "b" }
      : { purpose: "p" };
    // ⚠️ 桶的 id 与 `levels[].entities` 现在**连着**了（票 10 加的那条引用族 gate）——
    //   所以改桶就得同时改关卡的引用，否则红的是「悬空引用」而不是这一条。
    const withRef = (items: unknown[]) =>
      parse({ [bucket]: items, levels: [{ ...DESIGN.levels[0], entities: (items as { id: string }[]).map((i) => i.id) }] });
    expect(withRef([{ id: "x", ...item }]).success, `${bucket} 带 id`).toBe(true);
    expect(withRef([item]).success, `${bucket} 缺 id`).toBe(false);
  });
});

describe("§工具协议（R16 新）", () => {
  it("能转成 tool 的 input_schema，且封口", () => {
    const js = toolInputSchema(GameDesignSpecSchema) as Record<string, unknown>;
    expect(js["additionalProperties"]).toBe(false);
    expect(js["required"]).toContain("mechanics");
  });
});

describe("§契约支持覆盖度判据（票 19 的地基）", () => {
  it("意图要向、设计要到的，两个集合**减得出来**，且差集指向那条被丢的机制", () => {
    const intent = new Set(INTENT_MECHANIC_IDS);
    const design = new Set((DESIGN.mechanics as Array<{ id: string }>).map((m) => m.id));
    const missing = [...intent].filter((id) => !design.has(id));
    expect(missing).toEqual(["m-double-jump"]);
    // ⚠️ 而它**同时**是 R12 要拒的那条：外壳的机制表里没有 `double-jump`。
    //   一次求差，两个判据 —— 这正是票 03 Q1(b) 花一个字段换来的东西。
  });
});
