// 票 10 往 `game-design.ts` 里加的那条 **gate**，与它**故意不管**的那几格。
//
// ⚠️ 它与 `game-intent-gate.test.ts` 是同一款东西的两面（那张票起的分界线：
//   「空了就说明这一趟没说出一件事」进、「空了本身是一句设计陈述」不进），
//   外加两条**层内可算**的引用族规矩（id 跨桶唯一 · `levels[].entities` 解得到）。
import { describe, expect, it } from "vitest";
import { GAME_DESIGN_FORMAT, GameDesignSpecSchema, PLATFORMER_V1, toolInputSchema } from "../src/index.js";

/** 一份**最小但完整**的设计。⚠️ 它自己必须过 gate —— 否则下面每条断言测的都不是那条规矩。 */
const DESIGN = {
  format: GAME_DESIGN_FORMAT,
  game: { title: "拾荒者", genre: "platformer", camera: "side", runtimeProfile: { id: PLATFORMER_V1.id, version: PLATFORMER_V1.version } },
  coreLoop: ["探索废墟"],
  player: { id: "p-scavenger", role: "拾荒者", abilities: ["run", "jump"], goals: ["在天黑前抵达"] },
  enemies: [{ id: "e-drone", behavior: "沿固定路线往复", threat: "接触即伤" }],
  npcs: [],
  interactables: [],
  resources: [{ id: "r-part", purpose: "收集目标" }],
  world: { theme: "废土", setting: "铁轨旁的废墟", structure: "三段式" },
  levels: [{ id: "l-1", purpose: "教学", layout: "左侧出发，右侧终点", entities: ["e-drone", "r-part"] }],
  progression: { model: "linear", description: "三关" },
  mechanics: [{ id: "m-jump", mechanic: "jump" }],
  winConditions: ["抵达终点"],
  loseConditions: [],
  runtimeRequirements: ["input:keyboard"]
};
const parse = (over: Record<string, unknown> = {}) => GameDesignSpecSchema.safeParse({ ...DESIGN, ...over });

describe("⚠️ 结构性空值 + 层内引用族 gate（票 10 的 Q4）", () => {
  it("先自证：这份 fixture 自己是合法的", () => {
    expect(parse().success).toBe(true);
  });

  it("必填字符串为空 ⇒ 拒，且 `path` 指得到**那一格**", () => {
    const r = parse({ world: { ...DESIGN.world, structure: "   " } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(["world", "structure"]);
  });

  it("四桶与 `levels` 的**逐项**字符串同样管（`enemies[].behavior` / `levels[].layout`）", () => {
    const r1 = parse({ enemies: [{ id: "e-drone", behavior: " ", threat: "t" }] });
    expect(r1.success).toBe(false);
    if (!r1.success) expect(r1.error.issues[0]!.path).toEqual(["enemies", 0, "behavior"]);
    const r2 = parse({ levels: [{ ...DESIGN.levels[0], layout: "" }] });
    expect(r2.success).toBe(false);
    if (!r2.success) expect(r2.error.issues[0]!.path).toEqual(["levels", 0, "layout"]);
  });

  it("数组**元素**是空串 ⇒ 拒（空串不是「没有这一条」，是占位符）", () => {
    const r = parse({ coreLoop: ["探索废墟", ""] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(["coreLoop", 1]);
  });

  it("`coreLoop` / `player.abilities` / `player.goals` / `mechanics` / `levels` 是**空数组** ⇒ 拒", () => {
    for (const [over, path] of [
      [{ coreLoop: [] }, ["coreLoop"]],
      [{ player: { ...DESIGN.player, abilities: [] } }, ["player", "abilities"]],
      [{ player: { ...DESIGN.player, goals: [] } }, ["player", "goals"]],
      [{ mechanics: [] }, ["mechanics"]],
      [{ levels: [] }, ["levels"]]
    ] as const) {
      const r = parse(over as Record<string, unknown>);
      expect(r.success, `空 ${path.join(".")} 应当不过`).toBe(false);
      if (!r.success) expect(r.error.issues[0]!.path).toEqual([...path]);
    }
  });

  it("⚠️ id **跨四桶**重复 ⇒ 拒 —— 一个实体只有一种 `type`，跨桶重了就说不出是哪一个", () => {
    const r = parse({ npcs: [{ id: "e-drone", role: "r", interaction: "i" }] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(["npcs", 0, "id"]);
  });

  it("⚠️ `levels[].entities[]` **解得到** —— 悬空引用即拒（与票 08 的「色板下标越界」同形）", () => {
    const r = parse({ levels: [{ ...DESIGN.levels[0], entities: ["e-drone", "e-幽灵"] }] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]!.path).toEqual(["levels", 0, "entities", 1]);
      expect(r.error.issues[0]!.message).toContain("悬空引用");
    }
  });

  it("边界：引用恰好指到四桶里那些 id ⇒ 放行（gate **不许**把合法的也拦下）", () => {
    expect(parse({ levels: [{ ...DESIGN.levels[0], entities: ["e-drone"] }] }).success).toBe(true);
    expect(parse({ levels: [{ ...DESIGN.levels[0], entities: [] }] }).success).toBe(true); // 这一关没有实体
  });

  it("⚠️ 它**同时管从磁盘上读回来的** `game-design.json`", () => {
    const fromDisk = JSON.parse(JSON.stringify({ ...DESIGN, levels: [{ ...DESIGN.levels[0], entities: ["没有这个"] }] }));
    expect(GameDesignSpecSchema.safeParse(fromDisk).success).toBe(false);
  });
});

describe("⚠️ 明确**不进** gate 的那几格 —— 空是设计陈述，不是偷懒", () => {
  it("四个桶**全空**放行 —— 障碍跑式关卡（只有平台）是真的（与意图层把 `entities: []` 划出去同一条理由）", () => {
    const r = parse({
      enemies: [], npcs: [], interactables: [], resources: [],
      levels: [{ ...DESIGN.levels[0], entities: [] }],
      // ⚠️ 桶空了，引用就得跟着空 —— 这是 gate ⑥ 与「桶可空」两条**共存**的样子
    });
    expect(r.success).toBe(true);
  });

  it("`winConditions` / `loseConditions` 为空放行；`difficulty` 整个缺席也放行（它是唯一可选字段）", () => {
    expect(parse({ winConditions: [], loseConditions: [] }).success).toBe(true);
    expect(Object.keys(DESIGN)).not.toContain("difficulty");
    expect(parse({ difficulty: { model: "m", description: "d" } }).success).toBe(true);
  });

  it("⚠️ `levels` 只要 **≥1**、不要求**恰好 1**（多关索引那团雾没有进契约）", () => {
    const r = parse({
      levels: [
        { id: "l-1", purpose: "p1", layout: "a", entities: [] },
        { id: "l-2", purpose: "p2", layout: "b", entities: ["e-drone"] }
      ]
    });
    expect(r.success).toBe(true);
  });
});

describe("gate 的「看不见」性质", () => {
  it("⚠️ 工具 schema 里**一点痕迹都没有**（`toJSONSchema` 丢 `superRefine`）⇒ 模型看不见它", () => {
    const json = JSON.stringify(toolInputSchema(GameDesignSpecSchema));
    expect(json).not.toContain("悬空引用");
    expect(json).not.toContain("superRefine");
    expect(json).not.toContain("文书自己跟自己矛盾");
  });
});
