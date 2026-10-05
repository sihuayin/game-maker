// 票 09 往 `game-intent.ts` 里加的那条**结构性空值 gate**，与它**故意不管**的那几格。
//
// ⚠️ 它与 `visual-world-gate.test.ts` 是同一款东西的两面：
//   那条盯的是「文书**自己跟自己对不上**」（色板与 `palette:N` 同一次调用写出）；
//   这条盯的是「**模型没做决定**」—— 本契约的必填字段没有 `.min(1)`，所以
//   `genre: ""` 与「用户要的就是这样」在文件里**长得一模一样**。
//
// ⚠️ **「不进 gate」那几条和「进 gate」那几条一样重要** —— 它们是**合法设计**，
//   不是模型偷懒。把合法设计判成失败 = 静默烧掉一次重采样（票 08 学到的同一条）。
import { describe, expect, it } from "vitest";
import { GAME_INTENT_FORMAT, GameIntentSpecSchema, toolInputSchema } from "../src/index.js";

/** 一份**最小合法**的意图。⚠️ 它自己必须过 gate —— 否则下面每条断言测的都不是那条规矩。 */
const INTENT = {
  format: GAME_INTENT_FORMAT,
  genre: "platformer",
  targetExperience: "孤独但一直向上",
  coreLoop: ["探索废墟"],
  player: { role: "拾荒者", goals: ["在天黑前抵达"] },
  world: { theme: "废土", setting: "铁轨旁的废墟", atmosphere: "黄昏，尘土悬浮" },
  mechanics: [{ id: "m-jump", name: "跳跃" }],
  entities: [{ id: "e-drone", type: "enemy", role: "沿固定路线巡逻的无人机" }],
  winConditions: ["抵达终点"],
  loseConditions: [],
  ambiguity: []
};
const parse = (over: Record<string, unknown> = {}) => GameIntentSpecSchema.safeParse({ ...INTENT, ...over });

describe("⚠️ 结构性空值 gate（票 09 的 R2-Q1）", () => {
  it("先自证：这份 fixture 自己是合法的 —— 不然下面测的不是那条规矩", () => {
    expect(parse().success).toBe(true);
  });

  it("必填字符串为空 ⇒ 拒，且 `path` 指得到**那一格**", () => {
    const r = parse({ genre: "   " });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues[0]!.path).toEqual(["genre"]);
    expect(r.error.issues[0]!.message).toContain("用户没说");
  });

  it("嵌套的必填字符串同样管（`player.role` / `world.*`）", () => {
    const r = parse({ world: { ...INTENT.world, atmosphere: "" } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(["world", "atmosphere"]);
  });

  it("数组元素是**空串** ⇒ 拒（空串不是「没有这一条」，是占位符）", () => {
    const r = parse({ coreLoop: ["探索废墟", ""] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(["coreLoop", 1]);
  });

  it("`entities[].role` 是空串 ⇒ 拒（它是 ① 档，空了这个实体就只是半个）", () => {
    const r = parse({ entities: [{ id: "e", type: "npc", role: " " }] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(["entities", 0, "role"]);
  });

  it("`coreLoop` / `player.goals` / `mechanics` 是**空数组** ⇒ 拒 —— 「一条都说不出」是模型没干活", () => {
    for (const [over, path] of [
      [{ coreLoop: [] }, ["coreLoop"]],
      [{ player: { ...INTENT.player, goals: [] } }, ["player", "goals"]],
      [{ mechanics: [] }, ["mechanics"]]
    ] as const) {
      const r = parse(over as Record<string, unknown>);
      expect(r.success, `空 ${path.join(".")} 应当不过`).toBe(false);
      if (!r.success) expect(r.error.issues[0]!.path).toEqual([...path]);
    }
  });

  it("可选对象**出现了但是空壳** ⇒ 拒（整个省掉合法，`{}` 是第三种东西）", () => {
    const r = parse({ progression: {} });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(["progression"]);
  });

  it("可选对象**只给一半** ⇒ 放行（给一句就够，两个都要填是另一种病）", () => {
    expect(parse({ challenge: { description: "跳跃时机" } }).success).toBe(true);
  });

  it("id 重复 ⇒ 拒 —— 设计层按 id 延续，重了就说不出「是哪一个」（与「色板不得重色」同形）", () => {
    const rEnt = parse({ entities: [{ id: "e", type: "enemy", role: "a" }, { id: "e", type: "npc", role: "b" }] });
    expect(rEnt.success).toBe(false);
    if (!rEnt.success) expect(rEnt.error.issues[0]!.path).toEqual(["entities", 1, "id"]);
    const rMech = parse({ mechanics: [{ id: "m", name: "a" }, { id: "m", name: "b" }] });
    expect(rMech.success).toBe(false);
    if (!rMech.success) expect(rMech.error.issues[0]!.path).toEqual(["mechanics", 1, "id"]);
  });

  it("⚠️ 它**同时管从磁盘上读回来的文档** —— 一份空壳的 `game-intent.json` 解析时就会被拒", () => {
    const fromDisk = JSON.parse(JSON.stringify(parse({ genre: "" }) && { ...INTENT, genre: "" }));
    expect(GameIntentSpecSchema.safeParse(fromDisk).success).toBe(false);
  });
});

describe("⚠️ 明确**不进** gate 的那几格 —— 空是设计陈述，不是偷懒", () => {
  it("`entities: []` 放行 —— 障碍跑式关卡（只有平台）是真的；横版外壳里地形与终点不算实体", () => {
    expect(parse({ entities: [] }).success).toBe(true);
  });

  it("`winConditions` / `loseConditions` / `ambiguity` 为空放行 ——「不会死 / 没有终点」是真设计", () => {
    expect(parse({ winConditions: [], loseConditions: [], ambiguity: [] }).success).toBe(true);
  });

  it("`title` / `subgenre` / `camera` / `progression` / `challenge` **全缺席**放行 —— 这一层「可以缺」", () => {
    const { ...rest } = INTENT;
    expect(GameIntentSpecSchema.safeParse(rest).success).toBe(true);
  });

  it("`mechanics` 恰好 1 条放行 —— gate **不许**把合法的也拦下", () => {
    expect(parse({ mechanics: [{ id: "m", name: "走" }] }).success).toBe(true);
  });
});

describe("gate 的「看不见」性质 —— 它解释了这段代码为什么长这样", () => {
  it("⚠️ 工具 schema 里**一点痕迹都没有**（`toJSONSchema` 丢 `superRefine`）⇒ 模型看不见它", () => {
    const json = JSON.stringify(toolInputSchema(GameIntentSpecSchema));
    expect(json).not.toContain("模型没干活");
    expect(json).not.toContain("superRefine");
    expect(json).not.toContain("空数组");
  });

  it("而本契约**没有** `.omit()` ⇒ gate 一直跟着模型面向的那一份（但模型仍看不见它）", () => {
    // 与 VWS 那边不同：那里 `.omit({styleReferences})` 会把 gate 一起摘掉、必须靠装配后重校验接住；
    // 这里没有任何「调用方才知道」的字段（票 09 第 1 轮 Q6），所以没有那一层。
    expect(Object.keys(GameIntentSpecSchema.shape)).toHaveLength(16);
  });
});
