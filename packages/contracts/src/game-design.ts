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
// ⚠️ **本层是「意图覆盖 + 需求补全」，不是「意图镜像」**（票 10 的 R2-Q1，2026-10-04）
//
//   裁定原文：*`GameDesignSpec` 可以新增 `GameIntentSpec` 未显式列出的实体，但新增实体必须
//   能够从原始需求语义中得到依据；`GameIntentSpec` 已存在的实体，其 `id` 必须原样延续，
//   不得修改、删除或串桶。*
//
//   ⇒ 于是两条集合关系的**方向是不对称的**：
//     · **意图 ⊆ 设计** —— **判据**（票 10 的 `build-design.ts` 逐条查；少了就是 R12 的拒绝）；
//     · **设计多出意图 = 允许** —— 那叫**补全**。先例是探针当场抓到的那个：意图层的 `coreLoop`
//       说了「收集废料与**净水**」，而 `entities[]` 里只有废料 —— 设计层补一个 `e-water`
//       **是对的**（依据在**需求/意图的语义**里，不在模型的口味里）。
//   ⚠️ **「多出来的那个有没有依据」不可机械判定** ⇒ 它**不是判据**（R3：判据只收
//     「精确可算 + 错了一定不是设计」），只活在提示词纪律与工具说明里。
//     **谁也别把它写成一条永远绿的判据** —— 那正是这张图一路在防的「长得像判据的空壳」。
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
//   ⇒ **这是一张欠条，不是永久判决。** 票 10 落地时人类把它读成了**两句话**（裁定原文：
//     「Intent 6 个必须作为输入具名读取；Design 12 个必须在本票 prompt 中明确生产，
//       但业务消费者在下游」）：
//
//     · **本层这 12 个** —— 票 10（`compile-design`）的提示词必须**逐条点名地生产**它们
//       （不是「随便发挥」）；而**具名插值**发生在**下游**：票 12（Asset Planner）与
//       票 14（Runtime Compiler）的模板。哪一个到最后没在下游模板里露脸，就**当场出局**。
//     · ⚠️ 所以上面那句「票 10 与票 14 写提示词时」**不要读成「票 10 也要插这 12 个」** ——
//       票 10 是**产出**它们的，插一个自己正要求模型填的字段是循环。
//       票 10 真正要具名插值的是**意图层**那 6 个（见 `game-intent.ts` 的文件头）。
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
import { RuntimeProfileRefSchema } from "./runtime-profile.js";

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

// ── 顶层 gate：**「模型没做决定」与「设计如此」不许长得一样**（票 10 的 Q4）──────────────
//
//   本契约除 `difficulty` 外**全部必填**，而必填字符串**没有 `.min(1)`**（`game.genre` /
//   `world.structure` / `levels[].layout` … 全都能是 `""`），`levels` 也能是 `[]`。
//   ⇒ 与 `game-intent.ts` 同一种病（那张票的 gate 文件头在它自己那里）。
//
//   **进 gate**（这一发算 `schema` 失败、重采样）：
//     · 必填字符串非空（`game.*` · `player.role` · `world.*` · `progression.*` · 四桶每一项 ·
//       `levels[].purpose` / `levels[].layout`）
//     · 数组**元素**非空（`coreLoop[]` · `player.abilities[]` · `player.goals[]` ·
//       `winConditions[]` · `loseConditions[]` · `runtimeRequirements[]` · `levels[].entities[]`）
//     · 数组**本身 ≥ 1**：`levels` · `player.abilities` · `mechanics` · `coreLoop` · `player.goals`
//     · **id 跨四桶唯一** —— 一个实体只有一种 `type`（票 03 Q3），跨桶重了就说不出是哪一个
//     · **`levels[].entities[]` 解得到** —— 引用族：每一项都要在四桶里有家。
//       ⚠️ 与票 08 的 `palette:N` 越界**同形**：都是「**文书自己跟自己对不对**」，
//       而不是「模型懂不懂设计」。
//
//   **不进 gate**（⚠️ **逐条写下来，免得下一个人往里加**）：
//     · 四桶**本身可空** —— 障碍跑式关卡（只有平台，没有敌人/拾取物/交互物）是**对的**；
//       与票 09 把 `entities: []` 从意图层 gate 里划出去**同一条理由**
//     · `winConditions: []` / `loseConditions: []` —— 「不会死 / 没有终点」是真设计
//     · `difficulty` 整个缺席 —— 它是本契约**唯一**的可选字段
//     · **`levels` 只要求 ≥ 1，不要求恰好 1**（票 10 的 Q4 子裁）—— 「一次 `create` 出一个关卡」
//       是**今天的产品形状**，不是契约形状；多关索引那团雾还在地图上，别在契约里假装支持它。
//
//   ⚠️ **它管「有没有做决定」，不管「决定对不对」**：设计得好不好，判据碰不到。
//
//   ⚠️ **这条 check 模型看不见**：`toJSONSchema` 静默丢掉 `superRefine`。
//     ⇒ 规矩由 `game-design/src/prompts.ts` 在工具 `description` 里补（票 08 的 R2-Q5 那个杠杆）。
//     ⚠️ 而本契约**同时**是「`.omit()` 与 gate 必须配对」那条规矩的现场：
//       `compile-design` 的装配步要**注入三个调用方才知道的值**再**重过一次契约**，
//       gate 的落点就是那次重过 —— 不是模型那一份。
export const GameDesignSpecSchema = z.strictObject({
  format: z.literal(GAME_DESIGN_FORMAT),

  game: z.strictObject({
    /** ⚠️ **必填**（意图层的 `title` 可空）：起名是**设计行为**，空着 `compile-design` 得造一个。 */
    title: z.string().min(1),
    /** ⚠️ **调用方注入**：值就是 `runtimeProfile.id`（票 05 Q7 的原话：「`genre` 的值就是 `id`」）。
     *  模型被要求**照抄**，装配时**强制覆盖**（票 10 的 Q5）。
     *  ⚠️ 它是**可派生的副本** —— 与票 04 砍 `bodyProportions`、票 05 砍 `cameraModel` 是**同一种病**。
     *  留它的代价明写在这里：读者是**人**（报告里那句「这是个 `platformer`」）与下游模板。
     *  留一个副本不是罪，**不写清它为什么在**才是 —— 这就是票 05 给两个数组写自白的同一条纪律。 */
    genre: z.string(),
    /** ⚠️ **调用方注入**：值取 `vws.camera.mode` 的**字面**（`side` / `top-down` / …），装配时强制覆盖
     *  （票 10 的 Q5）。
     *  ⚠️ 它的 **② 读者就是 R12 的相机拒绝**：拿它与 `RuntimeProfile.capabilities` 里的 `camera:*`
     *  对照，对不上就**拒绝**（票 10 的 Q3b(ii)）。⚠️ 别把它填成 profile 那条能力名 ——
     *  那样这条对照**恒真**，拒绝面当场死掉。 */
    camera: z.string(),
    /** ⚠️ **改成一个引用，不是一个裸串**（票 03 Q5）：单一个名字对不上版本，
     *  拒绝时说不出是哪一代的能力。`id` + `version` 一起才是 `RuntimeProfile` 的身份。
     *  ⚠️ 形状引 `runtime-profile.ts` 的 `RuntimeProfileRefSchema`（票 05 Q8）——
     *  「身份冻结」的意思就是**只此一处**定义它，不在这里再写一个内联的 strictObject。 */
    runtimeProfile: RuntimeProfileRefSchema
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

  /** 外壳能力需求。⚠️ R12 的拒绝 = `runtimeRequirements − RuntimeProfile.capabilities`（票 03 Q3）。
   *  ⚠️ **今天这条差集恒空**：`PLATFORMER_V1.capabilities ⟺ CAPABILITIES`（票 05 的自白）。
   *  它是**给第二个成员留的位** —— 今天不响是**预期的**。同一条自白也适用于
   *  `mechanics[].mechanic − profile.mechanics`。
   *  R12 今天**真正**在拒的是三件事，全部落在票 10（见该票的 Q3）：① 封闭枚举本身
   *  （想填 `double-jump` 就填不出来）② 意图→设计的 id 覆盖 ③ `vws.camera.mode` 对不上 profile。 */
  runtimeRequirements: z.array(CapabilitySchema)

  // ⚠️ 被砍掉的（票 03 Q5）：`interactionModel` —— 它与 `player.abilities` +
  //   `interactables[].behavior` **说的是同一件事**，而那两个在场上；留它等于给「交互」两个来源。
}).superRefine((v, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const blank = (s: string | undefined) => (s ?? "").trim() === "";
  const HINT = " —— ⚠️ 这一层没有「不知道」这个选项：设计层必须**完整**（`game-design.ts` 的文件头）";

  // ① 必填字符串非空
  const strings: [string, string][] = [
    ["game.genre", v.game.genre],
    ["game.camera", v.game.camera],
    ["player.role", v.player.role],
    ["world.theme", v.world.theme],
    ["world.setting", v.world.setting],
    ["world.structure", v.world.structure],
    ["progression.model", v.progression.model],
    ["progression.description", v.progression.description]
  ];
  for (const [label, s] of strings) if (blank(s)) issue(label.split("."), `\`${label}\` 是空的${HINT}`);

  // ② 四桶与 levels 的**逐项**字符串
  const perItem: [string, readonly { [k: string]: unknown }[], readonly string[]][] = [
    ["enemies", v.enemies, ["behavior", "threat"]],
    ["npcs", v.npcs, ["role", "interaction"]],
    ["interactables", v.interactables, ["type", "behavior"]],
    ["resources", v.resources, ["purpose"]],
    ["levels", v.levels, ["purpose", "layout"]]
  ];
  for (const [bucket, arr, fields] of perItem)
    arr.forEach((item, i) => {
      for (const f of fields) if (blank(item[f] as string)) issue([bucket, i, f], `\`${bucket}[${i}].${f}\` 是空的${HINT}`);
    });

  // ③ 数组的**元素**非空
  const elems: [string, readonly string[]][] = [
    ["coreLoop", v.coreLoop],
    ["player.abilities", v.player.abilities],
    ["player.goals", v.player.goals],
    ["winConditions", v.winConditions],
    ["loseConditions", v.loseConditions],
    ["runtimeRequirements", v.runtimeRequirements]
  ];
  for (const [label, arr] of elems)
    arr.forEach((x, i) => { if (blank(x)) issue([...label.split("."), i], `\`${label}[${i}]\` 是空串 —— 空串不是「没有这一条」，是占位符`); });
  v.levels.forEach((l, i) => l.entities.forEach((x, j) => { if (blank(x)) issue(["levels", i, "entities", j], `\`levels[${i}].entities[${j}]\` 是空串`); }));

  // ④ 「一条都说不出」的数组 —— ⚠️ 四桶**不在**这一档（障碍跑式关卡是对的）
  const nonEmpty: [string, number][] = [
    ["coreLoop", v.coreLoop.length],
    ["player.abilities", v.player.abilities.length],
    ["player.goals", v.player.goals.length],
    ["mechanics", v.mechanics.length],
    ["levels", v.levels.length]
  ];
  for (const [label, n] of nonEmpty)
    if (n === 0) issue(label.split("."), `\`${label}\` 是空数组 —— 这一层说的就是「我们做成了什么」，做成了零条就是没干活`);

  // ⑤ id 跨四桶唯一（一个实体只有一种 `type`：票 03 Q3）
  const seen = new Map<string, string>();
  for (const bucket of ["enemies", "npcs", "interactables", "resources"] as const)
    v[bucket].forEach((item, i) => {
      const where = `${bucket}[${i}]`;
      const first = seen.get(item.id);
      if (first !== undefined)
        issue([bucket, i, "id"], `\`${where}.id\` 与 \`${first}\` 重复 —— 同一个 id 落在两个桶里，设计层就**说不出它是什么**（意图层按 \`type\` 只认一个桶）`);
      else seen.set(item.id, where);
    });

  // ⑥ `levels[].entities[]` 解得到（引用族 —— 与票 08 的越界 gate 同形）
  v.levels.forEach((level, i) =>
    level.entities.forEach((ref, j) => {
      if (!seen.has(ref))
        issue(["levels", i, "entities", j], `\`levels[${i}].entities[${j}]\` 指向 \`${ref}\`，而四桶里没有这个 id —— ⚠️ 悬空引用：关卡与实体是同一次调用里写出来的，对不上就是**文书自己跟自己矛盾**`);
    })
  );
});

export type GameDesignSpec = z.infer<typeof GameDesignSpecSchema>;
export type GameDesignMechanic = z.infer<typeof GameDesignMechanicSchema>;
