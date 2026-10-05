// 票 03 给 `GameIntentSpec` 立的判据：**门筛过之后剩下的形状，必须真的是那个形状**。
//
//   每条断言背后都有一个在票 03 里被**裁决**过的字段，不是「顺手加的覆盖率」。
//   最关键的一条在最下面（`name` 收得下外壳做不了的机制）——
//   没有它，R12 的构建期拒绝就没有素材，只剩一句口号。
import { describe, expect, it } from "vitest";
import { GAME_INTENT_FORMAT, GameIntentSpecSchema, toolInputSchema } from "../src/index.js";

/** 一份**像样**的意图：废土横版，且**故意**要了一个外壳做不了的东西（二段跳）。 */
const INTENT = {
  format: GAME_INTENT_FORMAT,
  title: "拾荒者",
  genre: "platformer",
  subgenre: "metroidvania-lite",
  camera: "横向卷轴",
  targetExperience: "孤独但一直向上",
  coreLoop: ["探索废墟", "收集零件", "抵达终点"],
  player: { role: "拾荒者", goals: ["在天黑前抵达"] },
  world: { theme: "废土", setting: "铁轨旁的废墟", atmosphere: "黄昏，尘土悬浮" },
  mechanics: [
    { id: "m-jump", name: "跳跃" },
    { id: "m-double-jump", name: "二段跳" } // ⚠️ 外壳做不了 —— 见文件末尾
  ],
  entities: [{ id: "e-drone", type: "enemy", role: "沿固定路线巡逻的无人机" }],
  progression: { type: "linear", description: "三关" },
  challenge: { type: "timing", description: "跳跃时机" },
  winConditions: ["收集三枚零件并抵达终点"],
  loseConditions: ["生命归零"],
  ambiguity: ["没说共几关"]
};

const parse = (over: Record<string, unknown> = {}) => GameIntentSpecSchema.safeParse({ ...INTENT, ...over });

describe("§判别式", () => {
  it("`format` 是必填的 literal —— 落盘之后要能证明它属于哪一族", () => {
    expect(parse().success).toBe(true);
    expect(parse({ format: "game-design/v1" }).success).toBe(false);
    expect(parse({ format: "1.0" }).success).toBe(false); // ⚠️ 自由字符串判别式写不出来（R1-Q7 判例）
  });

  it("除了 `format`，其余必需项缺一不可", () => {
    for (const k of ["genre", "targetExperience", "mechanics", "entities", "ambiguity"]) {
      const { [k]: _drop, ...rest } = INTENT as Record<string, unknown>;
      expect(GameIntentSpecSchema.safeParse(rest).success, `缺 ${k} 应当不过`).toBe(false);
    }
  });
});

describe("§砍掉的字段：封口之后它们真的进不来", () => {
  it.each([
    ["confidence", 0.8],       // 零消费者 + 长得像分数（票 03 Q4）
    ["interactions", ["推"]],  // 与 entities / mechanics 重合（票 03 Q1）
    ["schemaVersion", "1.0"],  // → format
  ])("`%s` 被拒", (k, v) => expect(parse({ [k]: v }).success).toBe(false));
});

describe("§title 的不对称（票 03 Q1）", () => {
  it("意图层**可空** —— 用户真可能不起名", () => {
    const { title: _drop, ...rest } = INTENT as Record<string, unknown>;
    expect(GameIntentSpecSchema.safeParse(rest).success).toBe(true);
  });
  it("但给了就得是个字符串", () => expect(parse({ title: 123 }).success).toBe(false));
});

describe("§id 是集合差的键（票 03 Q3(a)）", () => {
  it("`mechanics` 的每一项都必须带 id —— 裸串不行", () => {
    expect(parse({ mechanics: ["跳"] }).success).toBe(false);
    expect(parse({ mechanics: [{ name: "跳" }] }).success).toBe(false);
    expect(parse({ mechanics: [{ id: "m-1", name: "跳" }] }).success).toBe(true);
  });

  it("而 `coreLoop` / `winConditions` 保持裸串 —— 它们是被**沿用**的描述，不是被造出来的东西", () => {
    expect(parse({ coreLoop: [{ id: "c-1", text: "探索" }] }).success).toBe(false);
    expect(parse({ coreLoop: ["探索"] }).success).toBe(true);
  });
});

describe("§type 是封闭枚举（票 03 Q3）", () => {
  it("四个桶名收，第五个不收 —— 多一个桶就没人能接到它", () => {
    for (const t of ["enemy", "npc", "interactable", "resource"])
      expect(parse({ entities: [{ id: "e", type: t, role: "r" }] }).success, t).toBe(true);
    expect(parse({ entities: [{ id: "e", type: "boss", role: "r" }] }).success).toBe(false);
  });
});

describe("§工具协议（R16 新）", () => {
  it("能转成 tool 的 input_schema，且**封口**（`io: \"input\"` 下普通 `z.object` 不封）", () => {
    const js = toolInputSchema(GameIntentSpecSchema) as Record<string, unknown>;
    expect(js["additionalProperties"]).toBe(false);
    expect(js["required"]).toContain("format");
  });
});

describe("§这一条是本契约存在的理由（R12 的素材）", () => {
  it("`mechanics[].name` 收得下**外壳做不了**的机制", () => {
    // ⚠️ 若这里改成封闭枚举，用户要的二段跳**根本记不下来** ——
    //   于是没有东西可以被 `compile-design` 拒绝，只能偷偷实现或偷偷丢掉。
    //   `03 §11` 的「不要偷偷实现」正是死在这里。
    expect(parse({ mechanics: [{ id: "m-x", name: "二段跳" }] }).success).toBe(true);
    expect(parse({ mechanics: [{ id: "m-y", name: "boss 战与对话树" }] }).success).toBe(true);
  });
});
