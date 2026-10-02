// `game-intent/v1` —— **用户要什么**（票 03，依据 R7 的门）。
//
// ⚠️ **本文件是 V2 契约 ⇒ 用 `zod/v4`**（票 28 定的边界：旧契约 `zod`、V2 新契约 `zod/v4`，
//   两边**不许互相嵌套** —— `toolInputSchema` 只吃 v4，v3 的 `ZodObject` 连 `_zod` 都没有）。
// ⚠️ **封口一律用 `z.strictObject`**：`io: "input"` 下普通的 `z.object` **不产出**
//   `additionalProperties: false`（票 28 实测）。
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **这一层与 `GameDesignSpec` 有 13 处重名 —— 那是故意的**（票 03 Q2(a)）。
//
//   意图层 =「**用户说的**」（可以缺、可以说错、可以说得不清楚）
//   设计层 =「**我们做成的**」（必须完整、必须可执行）
//
//   ⇒ 重名**不是**冗余：Intent QA（§23）的覆盖度判据**正是拿两层的同名字段相减**
//     （「用户要的实体，设计里有没有对应项」）。若两层不重名而是各存一份不相干的东西，
//     **没有可以相减的两个集合**，R3 的判据当场蒸发、退回 LLM 打分。
//   ⇒ 反面同样成立：**本层的自由文本不许因为「设计层也有」就被砍**。
//     `coreLoop` / `winConditions` 在这里活着的理由是**它们要被相减**。
//
//   ⇒ 唯一的不对称：`title` 在**本层可空**（用户真可能不起名），
//     在**设计层必填**（起名是**设计行为**，空着 `compile-design` 就得造一个）。
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **`mechanics` 在这里是自由文本，是故意的** —— 不要「顺手」改成 `MechanicSchema`。
//
//   用户要二段跳、要 boss 战、要对话 —— 这些**必须记得下来**，哪怕外壳做不了。
//   记下来之后，`compile-design` 一填 `GameDesignSpec.mechanics`（**封闭枚举**）就填不出来，
//   ⇒ R12 的构建期拒绝**在生图之前**发生。两边都上枚举的话，用户要的东西根本进不了契约，
//     也就**没有东西可以被拒绝**，只能偷偷实现或偷偷丢掉 —— `03 §11` 要防的正是这个。
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **① 档字段的欠条**（R7 的门怎么算，见票 03 Q1(b)）
//
//   门收三种**具名**读取：① 提示词里按名字插值 · ② 判据 · ③ 映射进下游契约的具名字段。
//   本层靠 ① 活着的是这几个（**连 `title` 那种可空的都算**）：
//
//     subgenre · camera · targetExperience · world.atmosphere · player.role · entities[].role
//
//   ⇒ **这是一张欠条，不是永久判决。** 票 10（`compile-design`）写提示词时，
//     **每个标了 ① 的字段必须在模板里出现一次具名插值**（`spec.world.atmosphere`，
//     **不是** `JSON.stringify(spec)` 整份兜底 —— 整包 JSON 消费**不算**读）。
//     哪个字段到最后没在模板里露脸，就**当场出局**。
//     这句话必须留在这里：不留的话，票 10 的人会以为它们过了门就永远安全 ——
//     而那就是 `GameSpec` 重演的方式（`CONTEXT.md:64-69`：一个零消费者的空壳，
//     会让下一个读代码的人以为它是活的）。
import { z } from "zod/v4";
import { IntentEntityTypeSchema } from "./vocabulary.js";

/** 判别式。⚠️ **用 `format` 而不是 doc 里的自由字符串 `schemaVersion`**（票 02 的 R1-Q7 判例，
 *  票 03 Q4 沿用）：自由字符串**判别式写不出来**。仓里四处（drawlist / recipe / assetpack /
 *  game-config）全是这个形状 —— 「`format` 这个字段存在的意义就是把契约变了这件事说出来」。 */
export const GAME_INTENT_FORMAT = "game-intent/v1" as const;

/** 跨阶段**稳定**的身份。⚠️ 不是给人读的标签，是**集合差的键**（票 03 Q3(a)）。 */
const Id = z.string().min(1);

/** 意图里的一个实体。
 *  ⚠️ `type` 是**封闭枚举**且与设计层四个数组一一对应（票 03 Q3）——
 *  它若自由，覆盖度就判不了「串桶」（「要的是敌人，做成了 NPC」）。
 *  ⚠️ `role` 是 ① 档（进上面那张欠条）：它给提示词一句话说这个实体是干嘛的。 */
export const GameIntentEntitySchema = z.strictObject({
  id: Id,
  type: IntentEntityTypeSchema,
  role: z.string()
});

/** 意图里的一条**机制**。
 *  ⚠️ `name` 故意是**自由文本**（见文件头）：这是「用户说的」，可以超出外壳能力。
 *  ⚠️ 它带 `id` 而 `winConditions` 那种不带（票 03 Q3(a)）—— 分界线是
 *  **「这一项有没有一个被造出来的东西与之对应」**：机制会变成设计层的一条 `Mechanic`，
 *  需要一个跨阶段稳定的身份；条件只是描述，沿用原文就够了。 */
export const GameIntentMechanicSchema = z.strictObject({
  id: Id,
  name: z.string().min(1)
});

export const GameIntentSpecSchema = z.strictObject({
  format: z.literal(GAME_INTENT_FORMAT),

  /** ⚠️ **可选**：用户真可能不起名。设计层的 `game.title` 则**必填**（见文件头）。 */
  title: z.string().optional(),

  genre: z.string(),
  subgenre: z.string().optional(),
  camera: z.string().optional(),

  /** 「想要什么感觉」。⚠️ ① 档，且**没有任何判据读它** —— 票 10 若不在模板里具名插值，它出局。 */
  targetExperience: z.string(),

  /** 核心循环。⚠️ **裸串且不封口**（Q3(a)）—— 减集靠**沿用原文**，见该票已认的噪声。 */
  coreLoop: z.array(z.string()),

  player: z.strictObject({
    role: z.string(),
    goals: z.array(z.string())
  }),

  world: z.strictObject({
    theme: z.string(),
    setting: z.string(),
    /** ⚠️ ① 档。设计层的 `world.structure` **不是**它的对应物（那是「结构」，这是「氛围」）。 */
    atmosphere: z.string()
  }),

  /** 用户说的机制，**自由文本**（见文件头）。设计层那条才是封闭枚举。 */
  mechanics: z.array(GameIntentMechanicSchema),

  entities: z.array(GameIntentEntitySchema),

  progression: z
    .strictObject({ type: z.string().optional(), description: z.string().optional() })
    .optional(),

  challenge: z
    .strictObject({ type: z.string().optional(), description: z.string().optional() })
    .optional(),

  /** ⚠️ **裸串**（Q3(a)）：设计层那份 `{id, purpose}[]` 才是被造出来的东西。 */
  resources: z.array(z.string()),

  winConditions: z.array(z.string()),
  loseConditions: z.array(z.string()),

  /** 「**需求没说清楚的地方**」—— ⚠️ 与「缺项」**不是一回事**（票 19 §3）：
   *  缺项说「**我们没做**」（指向我们），歧义说「**你没说**」（指向用户）。
   *  混起来会让报错指错一方。
   *
   *  ⚠️ **它的消费者是 R9 的那个检查点**（票 03 Q2(b)）—— 不是终点那份 QA 报告。
   *  理由：一份「你没说清」的报告在**生图之后**递给人，没有任何一刻能改变结局；
   *  检查点在**清单之前**，是唯一一个它真正起作用的时刻。
   *  ⇒ 因此它必须 ① 在检查点的展示清单里**具名出现** ② `--yes` 跳过时**进日志**。
   *  ⇒ **这两条若不成立，本字段当场出局** —— 别把它养成「将来可能会用」的空壳。 */
  ambiguity: z.array(z.string())

  // ⚠️ 被砍掉的，连同理由（票 03 的三轮）：
  //   `confidence`   —— 零消费者 + 长得像分数，与 Destination 的「不带分数」正面冲突。
  //                     有人想拿它当阈值驱动「低置信度就反问」，但那扇门**够不着人**：
  //                     R9 只留了一个人工点，且在**清单处**，那时本契约早就过去了。
  //                     与票 02 删 `VisualWorldSpec.confidence` 同一份理由。
  //   `interactions` —— ① 档，但**没有独有的活**：用户说的「能推箱子」要么是实体
  //                     （进 `entities[]`），要么是机制（进 `mechanics[]`）。
  //                     与设计层砍 `interactionModel` 对称。
  //   `schemaVersion` —— → `format: z.literal(...)`。
});

export type GameIntentSpec = z.infer<typeof GameIntentSpecSchema>;
export type GameIntentEntity = z.infer<typeof GameIntentEntitySchema>;
export type GameIntentMechanic = z.infer<typeof GameIntentMechanicSchema>;
