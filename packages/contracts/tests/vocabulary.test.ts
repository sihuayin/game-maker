// 票 03 给 `vocabulary.ts` 立的两条判据 —— 它把「词表」从一句宣言变成一个**可证伪**的东西。
//
//   **§壳对齐判据** —— 机制词表是 `game-config/v1` 那些构造的**事实投影**（R12），
//     不是一张许愿单。外壳加一种 `EntityKind` 而这里没给它的机制一个交代 ⇒ 本判据要红。
//     ⚠️ 这是本文件存在的理由：没有它，词表会在某一次「顺手加一个」里悄悄变成许愿单，
//       而许愿单一变，R12 的拒绝就**不会发生**（什么都能填）。
//
//   **§负判据** —— 外壳**做不了**的那些，必须**不在**表里。它们正是用户最常要的，
//     所以它们是 R12 拒绝的**唯一素材**：少了这个，拒绝逻辑没有东西可拒。
//
//   ⚠️ **能力**（`CAPABILITIES`）那一侧的见证不在这里 —— 它住在
//     `packages/demo/tests/shell-capability-witness.test.ts`：那八条要读外壳的**源码文本**
//     才验得了（`shell/scene.ts` import 了 Phaser，node 里 import 不动，票 05 Q11）。
import { describe, expect, it } from "vitest";
import {
  CAPABILITIES, CapabilitySchema, INTENT_ENTITY_TYPES, IntentEntityTypeSchema,
  MECHANICS, MechanicSchema,
} from "../src/vocabulary.js";
import { EntityKind } from "../src/game-config.js";
import { GameDesignSpecSchema } from "../src/game-design.js";
import { PLATFORMER_V1 } from "../src/runtime-profile.js";

/** 每一种 `EntityKind` 必须在这里有个交代 —— 要么推出一个机制，要么**明写**它没有。
 *  ⚠️ `Record<EntityKind, …>` 是**穷尽的**：`game-config/v1` 加一种 kind，这里当场编译不过。 */
const ENTITY_KIND_FATE: Record<string, string | null> = {
  solid: "collide-terrain",
  pickup: "collect-pickup",
  hazard: "hazard-contact",
  goal: "reach-goal",
  decor: null // 装饰：不可交互，没有机制。null 是**表态**，不是遗漏。
};

describe("§壳对齐：机制词表是 game-config/v1 的事实投影", () => {
  it("每一种 EntityKind 都有交代（加一种 kind 而没想它的机制 ⇒ 红）", () => {
    for (const kind of EntityKind.options) expect(ENTITY_KIND_FATE).toHaveProperty(kind);
  });

  it("有交代的 kind，它推出的机制必须在词表里真的存在", () => {
    for (const m of Object.values(ENTITY_KIND_FATE)) if (m !== null) expect(MECHANICS).toContain(m);
  });

  it("`Motion{kind:'cycle'}` 与 `Objective{'collect-then-reach'}` 也各有一条机制", () => {
    expect(MECHANICS).toContain("moving-platform"); // ← Motion（game-config.ts:49）
    expect(MECHANICS).toContain("reach-goal");      // ← Objective（game-config.ts:154）
  });
});

describe("§负判据：外壳做不了的不许偷偷进表", () => {
  // ⚠️ 这几条**正是用户最常要的**。它们留在表外，R12 的拒绝才有东西可拒。
  const SHELL_CANNOT_DO = ["double-jump", "attack", "health", "enemy-ai", "dialogue", "inventory"];
  const asStrings: readonly string[] = MECHANICS;

  it.each(SHELL_CANNOT_DO)("`%s` 不在机制词表里", (m) => expect(asStrings).not.toContain(m));
});

describe("§形状：两份词表本身", () => {
  it("非空 · 无重复 · 全是非空串", () => {
    for (const table of [MECHANICS, CAPABILITIES, INTENT_ENTITY_TYPES]) {
      expect(table.length).toBeGreaterThan(0);
      expect(new Set(table).size).toBe(table.length);
      for (const v of table) expect(typeof v === "string" && v.length > 0).toBe(true);
    }
  });

  it("两侧都是**封闭**的：表外的值解析不过", () => {
    expect(MechanicSchema.safeParse("double-jump").success).toBe(false);
    expect(MechanicSchema.safeParse("jump").success).toBe(true);
    expect(CapabilitySchema.safeParse("gpu:raytracing").success).toBe(false);
    expect(IntentEntityTypeSchema.safeParse("boss").success).toBe(false);
  });
});

describe("§桶对齐：意图层的 type 与设计层四个数组一一对应", () => {
  /** 桶名映射。⚠️ 它是**全的**（每个 type 有家）且**单的**（没有两个 type 挤一个家）。 */
  const BUCKET: Record<(typeof INTENT_ENTITY_TYPES)[number], string> = {
    enemy: "enemies", npc: "npcs", interactable: "interactables", resource: "resources"
  };

  it("映射是全的、单的 —— 每个 type 恰好一个家", () => {
    const homes = INTENT_ENTITY_TYPES.map((t) => BUCKET[t]);
    expect(homes.length).toBe(INTENT_ENTITY_TYPES.length);
    expect(new Set(homes).size).toBe(homes.length);
  });

  it("四个桶在设计层都真的存在，且每一项都要求 `id`（id 是集合差的键）", () => {
    const shape = GameDesignSpecSchema.shape as Record<string, unknown>;
    for (const home of Object.values(BUCKET)) expect(shape).toHaveProperty(home);
    // 行为验证：一个缺 id 的敌人项解析不过 —— 若哪天有人把 id 改成可选，`compile-design`
    // 就没法沿用意图层的 id，覆盖度判据**当场失效**（票 03 Q2(b)）。
    const bare = { format: "game-design/v1", game: { title: "t", genre: "g", camera: "c", runtimeProfile: { id: PLATFORMER_V1.id, version: PLATFORMER_V1.version } }, coreLoop: [], player: { id: "p", role: "r", abilities: [], goals: [] }, enemies: [{ behavior: "b", threat: "t" }], npcs: [], interactables: [], resources: [], world: { theme: "", setting: "", structure: "" }, levels: [], progression: { model: "m", description: "d" }, mechanics: [], winConditions: [], loseConditions: [], runtimeRequirements: [] };
    expect(GameDesignSpecSchema.safeParse(bare).success).toBe(false);
  });
});
