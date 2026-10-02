// `game-design/v1` —— **这个游戏设计上是什么**（票 03，依据 R7 的门）。
//
// ⚠️ **本文件是 V2 契约 ⇒ 用 `zod/v4`**，**封口一律 `z.strictObject`**（票 28 定的边界，
//   理由与代价见 `structured-call.ts` 里 `toolInputSchema` 那一段）。
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **本层是「我们做成的」，与意图层 13 处重名是故意的**（票 03 Q2(a)）——
//   重名让 Intent QA 的覆盖度**有东西可减**。详见 `game-intent.ts` 的文件头。
//   ⇒ 本层与意图层的**唯一**分工：这里的每一个字段都必须**完整**，那边可以缺。
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **① 档字段的欠条**（R7 的门怎么算，见票 03 Q1(b)）
//
//   门收三种**具名**读取：① 提示词里按名字插值 · ② 判据 · ③ 映射进下游契约的具名字段。
//   本层靠 **① 单独**活着的是这些：
//
//     world.theme · world.setting · world.structure
//     player.role · player.abilities
//     enemies[].behavior · enemies[].threat
//     npcs[].role · npcs[].interaction
//     interactables[].type · interactables[].behavior
//     levels[].purpose
//
//   ⇒ **这是一张欠条，不是永久判决。** 票 10（`compile-design`）与票 14（`compile-runtime`）
//     写提示词时，**每个标了 ① 的字段必须在模板里出现一次具名插值**。
//     哪个字段到最后没在模板里露脸，就**当场出局**。
//     不留这段话，下一个人会以为它们过了门就永远安全 —— 而那就是 `GameSpec` 重演的方式
//     （`CONTEXT.md:64-69`：一个零消费者的空壳，会让下一个读代码的人以为它是活的）。
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **三个 `*Requirements` 里砍了两个** —— 它们是被删的 `GameSpec.requirements` 拆成三份
//   又长回来的（票 03 Q3）：
//     `assetRequirements`  → 砍。Asset Planner 的真实输入是**结构化的**
//                            `enemies` / `npcs` / `interactables` / `resources`（票 12），
//                            再来一份自由文本就是**同一事实的第二个来源**，而且它没有 id、减不了集。
//     `visualRequirements` → 砍。视觉语法**已经住在 `VisualWorldSpec`**。留它等于
//                            给「这个资产长什么样」造第三个来源（票 12 §2 正要吵的那件事）。
//     `runtimeRequirements`→ **留，但改成封闭能力集**（`CapabilitySchema`）——
//                            R12 要拿它跟 `RuntimeProfile` 比出**拒绝**，
//                            而两串自然语言求差集得到的**不是判据，是噪声**。
import { z } from "zod/v4";
import { CapabilitySchema, MechanicSchema } from "./vocabulary.js";

/** 判别式。⚠️ 票 03 Q4 按票 02 的判例补：`01-contracts.md §4` 今天**连 `schemaVersion`
 *  都没有**，两份契约里只有它是**匿名**的 —— 落盘之后没有任何东西能证明某个 JSON 是哪一族。 */
export const GAME_DESIGN_FORMAT = "game-design/v1" as const;

/** 跨阶段**稳定**的身份：集合差的键，也是 Asset Planner / Runtime Compiler 的引用族（票 03 Q3(a)）。 */
const Id = z.string().min(1);

/** 一条**被做成的**机制。
 *  ⚠️ 与意图层的 `mechanics[].name`（自由文本）**不对称，是故意的**：这里填不出来，
 *  就是「外壳不做这个」的**信号本身**（R12 在生图之前拒绝，见 `vocabulary.ts`）。 */
export const GameDesignMechanicSchema = z.strictObject({
  id: Id,
  mechanic: MechanicSchema
});

export const GameDesignSpecSchema = z.strictObject({
  format: z.literal(GAME_DESIGN_FORMAT),

  game: z.strictObject({
    /** ⚠️ **必填**（意图层的 `title` 可空）：起名是**设计行为**，空着 `compile-design` 得造一个。 */
    title: z.string().min(1),
    genre: z.string(),
    camera: z.string(),
    /** ⚠️ **改成一个引用，不是一个裸串**（票 03 Q5）：单一个名字对不上版本，
     *  拒绝时说不出是哪一代的能力。`id` + `version` 一起才是 `RuntimeProfile` 的身份。 */
    runtimeProfile: z.strictObject({ id: z.string().min(1), version: z.string().min(1) })
  }),

  /** ② 判据：Intent QA 拿它与意图层的同名数组相减。 */
  coreLoop: z.array(z.string()),

  player: z.strictObject({
    id: Id,
    role: z.string(),
    abilities: z.array(z.string()),
    goals: z.array(z.string())
  }),

  // ⚠️ 四个桶与意图层 `entities[].type` 的封闭枚举**一一对应**（票 03 Q3）：
  //   enemy → enemies · npc → npcs · interactable → interactables · resource → resources。
  //   每一桶的 `id` **沿用意图层**（票 03 Q2(b)：不加 `fromIntent` 回指，靠 id 延续）——
  //   `compile-design` 被要求**沿用而非改名**，改名就是误报，这笔噪声见票 19。
  enemies: z.array(z.strictObject({ id: Id, behavior: z.string(), threat: z.string() })),
  npcs: z.array(z.strictObject({ id: Id, role: z.string(), interaction: z.string() })),
  interactables: z.array(z.strictObject({ id: Id, type: z.string(), behavior: z.string() })),
  resources: z.array(z.strictObject({ id: Id, purpose: z.string() })),

  world: z.strictObject({ theme: z.string(), setting: z.string(), structure: z.string() }),

  levels: z.array(
    z.strictObject({
      id: Id,
      purpose: z.string(),
      /** ③ 档：票 14 拿它出 `GameConfig` 的 `scene` / `terrain`（关卡属于 Game Config，
       *  不是一种 Asset —— `CONTEXT.md:223-225`）。 */
      layout: z.string(),
      /** ③ 档：**引用族**，指向实体 id。 */
      entities: z.array(z.string())
    })
  ),

  progression: z.strictObject({ model: z.string(), description: z.string() }),
  difficulty: z.strictObject({ model: z.string(), description: z.string() }).optional(),

  /** ⚠️ 封闭枚举（票 03 Q1(b)）。对着 `RuntimeProfile.mechanics` 求差 —— 见 `vocabulary.ts`。 */
  mechanics: z.array(GameDesignMechanicSchema),

  winConditions: z.array(z.string()),
  loseConditions: z.array(z.string()),

  /** 外壳能力需求。⚠️ R12 的拒绝 = `runtimeRequirements − RuntimeProfile.capabilities`（票 03 Q3）。 */
  runtimeRequirements: z.array(CapabilitySchema)

  // ⚠️ 被砍掉的（票 03 Q5）：`interactionModel` —— 它与 `player.abilities` +
  //   `interactables[].behavior` **说的是同一件事**，而那两个在场上；留它等于给「交互」两个来源。
});

export type GameDesignSpec = z.infer<typeof GameDesignSpecSchema>;
export type GameDesignMechanic = z.infer<typeof GameDesignMechanicSchema>;
