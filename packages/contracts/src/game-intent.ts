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
//
//   ⚠️ **但可减的只有 id 那一半 —— 描述性文本那一半被测死了**（票 19 的 Q1，2026-10-09）。
//     票 03 当年把 `coreLoop` / `winConditions` / `loseConditions` / `progression` 也划进了
//     「按文本相等相减」，而票 19 拿票 10 探针的 **4 发真输出**量出它 **0% 命中**
//     （意图 3 条 `coreLoop` → 设计 4 条，措辞全不一样）—— 因为**设计层要的就是「放大」**，
//     不是复述。⇒ 那一条**砍掉了**，测量与理由在 `contracts/intent-coverage.ts` 的头一。
//   ⇒ 于是这几条自由文本**今天的读者是提示词**（① 档那张欠条，见下面那一段），**不是判据**。
//     ⚠️ 它们**该在的位置没变**（两层同名、意图 ⊆ 设计），只是「同名 ⇒ 一定能相减」到此为止。
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

// ── 顶层 gate：**「模型没做决定」与「用户要的就是这样」不许长得一样**（票 09 的 R2-Q1）────────
//
//   本契约的必填字段**没有 `.min(1)`**（`genre: z.string()`、`coreLoop: z.array(z.string())`），
//   于是 `genre: ""` 与 `coreLoop: []` **完全合法** —— 而它们在文件里与「用户要的就是这样」
//   **一模一样**。票 04 砍 `bodyProportions`、票 05 砍 `cameraModel` 都是同一种病：
//   两个不同的东西在文件里长得一样，下一个人分不出来。
//
//   **这条 gate 管什么** —— 分界线是「结构性 / 语义性」（人类拍板，票 09 第 2 轮 R2-Q1）：
//     凡「空了就说明**这一趟没说出一件事**」的 ⇒ 进 gate（这一发算 `schema` 失败、重采样）；
//     凡「空了**本身是一句设计陈述**」的 ⇒ **不进**。
//   进：必填字符串非空 · 数组元素非空 · `coreLoop` / `player.goals` / `mechanics` ≥ 1 ·
//       可选对象出现时不得是空壳 · id 不得重复。
//   不进（**逐条写下来，免得下一个人往里加**）：
//     · `winConditions: []` / `loseConditions: []` —— 「不会死 / 没有终点」是真设计
//       （仓库里就有原话：「没有血量条，也不会死」，`out/__probe-derive/vague.md`）；
//     · `ambiguity: []` —— 需求说得够全时它就该是空的；
//     · **`entities: []`** —— 障碍跑式的关卡（只有平台，没有敌人/拾取物/交互物）是**对的**，
//       横版外壳里地形与终点根本不算实体 ⇒ 空不是「模型没干活」，是设计如此。
//       ⚠️ 这一格是**人类专门从 gate 里划出去的**（票 09 第 2 轮：与 `mechanics ≥ 1` 二选一），
//          **别再挪回来** —— 挪回来就是把合法设计判成失败，烧掉一次静默的重采样；
//     · `title` / `subgenre` / `camera` 缺席 · `progression` / `challenge` 整个缺席。
//
//   ⚠️ **它管「有没有做决定」，不管「决定对不对」**：`genre` 填成 `platformer` 而用户其实要塔防，
//     那是**理解错**，判据碰不到 —— **别把这条 check 当垃圾桶。**
//
//   ⚠️ **「那归票 19」这句已经收回**（2026-10-09，票 19 的 Q6）：票 19 **也**碰不到它。
//     本层的 `genre` 是**自由文本**，而设计层的 `game.genre` 是**装配时注入的 `profile.id`**
//     —— 两边**不在一个词表里**，求差求不出东西；真要判「模型把需求读错了」，得拿它跟
//     `run/v<N>/intent.md` 的**原文**比，那不是判据碰得到的东西。
//     ⇒ 今天真在守这件事的是两处：`camera`（`vws.camera.mode` 与 profile 的 `camera:*` **都是闭集**
//       ⇒ 拒得出 `camera-unsupported`），以及 **R9 的检查点**（那时人手上同时有 `intent.md` 与清单）。
//     ⚠️ 「语义映射」进地图的 Not yet specified —— 本层**不**为此把 `genre` 封成枚举。
//
//   ⚠️ **这条 check 模型看不见**：`toJSONSchema` 会静默丢掉 `superRefine`（票 08 探针实测）。
//     这正是它该有的样子（它是 gate，不是提示）—— 而「让模型知道有这条规矩」那件事，
//     由 `game-design/src/prompts.ts` 在工具 `description` 里补（票 08 的 R2-Q5 那个杠杆）。
//
//   ⚠️ **它同时也管从磁盘上读回来的 `game-intent.json`**（与 VWS 那条 gate 同理）。
//     票 09 的探针实测：两发过 Zod 的 verbose 里，这张射程表**一处都没踩中** ⇒
//     它在正常输入上很安静 —— 安静是预期的，别以为它坏了。
//
//   ⚠️ **`.omit()` 会摘掉 `superRefine`**（票 08 实测），而本契约**没有**要摘掉的键
//     （没有任何「调用方才知道」的字段，票 09 第 1 轮 Q6）⇒ gate 一直跟着模型面向的 schema 走。
//     但模型**仍然看不见它** —— 丢它的是 `toJSONSchema`，不是 `.omit()`。两件事别混。
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
}).superRefine((v, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const blank = (s: string | undefined) => (s ?? "").trim() === "";
  const HINT = " —— ⚠️ 「**用户没说**」要写成 `ambiguity[]` 里**指得出字段名**的一条，**不许**拿空值占位";

  // ① 必填的**字符串**：空了 = 这一趟没说出一件事
  const strings: [string, string][] = [
    ["genre", v.genre],
    ["targetExperience", v.targetExperience],
    ["player.role", v.player.role],
    ["world.theme", v.world.theme],
    ["world.setting", v.world.setting],
    ["world.atmosphere", v.world.atmosphere]
  ];
  for (const [label, s] of strings) if (blank(s)) issue(label.split("."), `\`${label}\` 是空的${HINT}`);

  // ② 数组的**元素**：空串不是「没有这一条」，是一个占位符
  const arrays: [string, string[]][] = [
    ["coreLoop", v.coreLoop],
    ["player.goals", v.player.goals],
    ["winConditions", v.winConditions],
    ["loseConditions", v.loseConditions],
    ["ambiguity", v.ambiguity]
  ];
  for (const [label, arr] of arrays)
    arr.forEach((x, i) => { if (blank(x)) issue([...label.split("."), i], `\`${label}[${i}]\` 是空串${HINT}`); });
  v.entities.forEach((e, i) => { if (blank(e.role)) issue(["entities", i, "role"], `\`entities[${i}].role\` 是空串${HINT}`); });

  // ③ 「一条都说不出」的数组（⚠️ `entities` **不在**这一档 —— 理由见上面那段）
  const nonEmpty: [string, number][] = [
    ["coreLoop", v.coreLoop.length],
    ["player.goals", v.player.goals.length],
    ["mechanics", v.mechanics.length]
  ];
  for (const [label, n] of nonEmpty)
    if (n === 0) issue(label.split("."), `\`${label}\` 是空数组 —— 一条都说不出来的需求是**模型没干活**，不是设计如此`);

  // ④ 可选对象**若出现**，不得是空壳（整个省掉合法，`{}` 不合法）
  for (const label of ["progression", "challenge"] as const) {
    const o = v[label];
    if (o !== undefined && blank(o.type) && blank(o.description))
      issue([label], `\`${label}\` 出现了但 \`type\` 与 \`description\` 都是空的 —— 要么**整个省掉**、要么给一句；空壳是第三种东西，没人分得出它是哪一种`);
  }

  // ⑤ id 不得重复：跨阶段的 id 延续靠它，重了就说不出「是哪一个」（与 08 的「色板不得重色」同形）
  const dupIds = (arr: readonly { id: string }[], where: string) => {
    const seen = new Set<string>();
    arr.forEach((x, i) => {
      if (seen.has(x.id))
        issue([where, i, "id"], `\`${where}[${i}].id\` 与前面某一条重复（${x.id}）—— 设计层按 **id 延续**（票 03 Q2(b)），重了就对不上是哪一个`);
      seen.add(x.id);
    });
  };
  dupIds(v.entities, "entities");
  dupIds(v.mechanics, "mechanics");

  // ⚠️ 被砍掉的，连同理由（票 03 的三轮）：
  //   `confidence`   —— 零消费者 + 长得像分数，与 Destination 的「不带分数」正面冲突。
  //                     有人想拿它当阈值驱动「低置信度就反问」，但那扇门**够不着人**：
  //                     R9 只留了一个人工点，且在**清单处**，那时本契约早就过去了。
  //                     与票 02 删 `VisualWorldSpec.confidence` 同一份理由。
  //   `interactions` —— ① 档，但**没有独有的活**：用户说的「能推箱子」要么是实体
  //                     （进 `entities[]`），要么是机制（进 `mechanics[]`）。
  //                     与设计层砍 `interactionModel` 对称。
  //   `schemaVersion` —— → `format: z.literal(...)`。
  //   `resources`    —— **同层之内**与 `entities[].type === "resource"` 重复（票 09 Q5）。
  //                    设计层的那个桶**只认** `entities[].type = "resource"`（见 `game-design.ts`
  //                    四个桶的注释），于是「两个家 → 下游同一个桶」：模型每跑一次就在两个家之间
  //                    猜一次，猜错就是串桶。⇒ 顶层这份出局，唯一来源是 `entities[]`。
  //                    ⚠️ 它不是票 03 Q2 说的那「13 处**跨层**重名」之一 —— 那些是
  //                    意图层 X ↔ 设计层 X（供 Intent QA 减集），这一处是**同层**的两个家。
});

export type GameIntentSpec = z.infer<typeof GameIntentSpecSchema>;
export type GameIntentEntity = z.infer<typeof GameIntentEntitySchema>;
export type GameIntentMechanic = z.infer<typeof GameIntentMechanicSchema>;
