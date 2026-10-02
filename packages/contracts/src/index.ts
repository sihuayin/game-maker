// 各阶段之间**唯一**的通信面（docs/文档.md 第 5.1 节 Contract First）。
//
// ⚠️ 这里只放**当前终点**用得到的契约。2026-09-24 的重画把自我修复闭环整体判出局
// （R2），随它出局的 schema 已从本文件删除 —— 明细见票 07 的 Answer。
// 需要历史的，去 git 历史里找 `demo/src/contracts/index.ts`。
import { z } from "zod";
import { PaletteSchema } from "./drawlist.js";
import { AssetSpecSchema } from "./asset-spec.js";

// ── 需求 ── 结构化类型已删除（票 09，2026-09-26）────────────────────────────
// 这里曾有 `RequirementPriority` + `RequirementSchema`。删它的理由：需求今天就是
// **一段文本**（`derive` 的输入），R2 之后没有任何消费者要结构化的它。
// 详见证 09 的 Answer §1。

// ── 风格 ──────────────────────────────────────────────────────────────────
/**
 * 从参考图提取出的**视觉语法**，不是参考图的描述（docs/文档.md 第 11 节）。
 *
 * ⚠️ `palette` 是**有序数组**，drawlist 用 `palette:<下标>` 引用它（票 24 / 票 36）。
 * 有序是硬约束：换掉整个色板时，创作态文本必须**一字不变**。
 */
export const StyleSpecSchema = z.object({
  id: z.string(),
  identity: z.array(z.string()),
  camera: z.record(z.unknown()).default({}),
  composition: z.record(z.unknown()).default({}),
  // ⚠️ 规范化色板（票 24 Q3 定的落点）：**有序**、小写 `#rrggbb`、不得重复色。
  // 「换掉整个色板 → 创作态文本一字不变」这条性质全靠它的**顺序**稳定。
  palette: PaletteSchema.default([]),
  lighting: z.record(z.unknown()).default({}),
  shapeLanguage: z.array(z.string()).default([]),
  material: z.array(z.string()).default([]),
  environment: z.array(z.string()).default([]),
  characterStyle: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1)
});
export type StyleSpec = z.infer<typeof StyleSpecSchema>;

// ── 游戏 ── `GameSpecSchema` 已删除（票 09，2026-09-26）──────────────────────
// 这里曾有 `GameSpecSchema`（设计文档：coreLoop / world / player / mechanics / entities /
// scenes / ui / rules / winConditions / loseConditions / requirements）。删它的理由：
// 它描述的是「这个游戏**设计上**是什么」（大半字段是 `z.record(z.unknown())` 逃生舱），
// 而 [[Game Config]] 描述的是「**外壳要执行的数据**是什么」—— **两件事，不是一件事的
// 粗细两个版本**。游戏配置现在是 `game-config.ts`，只读 manifest 与它两个东西。
// 详见证 09 的 Answer §1。

// ── 资源规格 ──────────────────────────────────────────────────────────────


// ── 产物引用 ── 已删除（票 18，2026-09-25）──────────────────────────────────
// 这里曾有 `ArtifactType` + `ArtifactRefSchema`。票 24 先判「资源包内不用 ArtifactRef」
// （包内每个文件只需 path/bytes/checksum，version 与 createdAt 本来就是包级的），
// 票 18 再确认它**零消费者**、且字段是为已出局的闭环模型设计的（ArtifactType 里
// evaluation / repair-plan / benchmark 三项随 R2 出局），遂连同 ArtifactType 一并删除。
// 「包**之间**的引用」若将来真需要，那时再设计 —— 留一个空壳 schema 只会让下一个
// 读代码的人以为它是活的。见 CONTEXT.md 的 ArtifactRef 词条。

// ── 创建项目 ── `CreationProjectSchema` 已删除（票 09，2026-09-26）──────────
// 曾是一个顶层容器（标题 + 需求文本 + 参考图）。它的字段为旧的闭环模型设计，
// **零消费者**，而地图说它的粒度「归票 24 / 28」——那两票都已 resolved 且没有给它留位置。
// 今天「一次创建」的载体是两样具体的东西：一份**资源清单**（输入侧）与一个**资源包**（输出侧）。

// ── 创作态：drawlist ──────────────────────────────────────────────────────
export * from "./drawlist.js";
export * from "./geometry.js";

// ── 交付态：资源包自描述 ──────────────────────────────────────────────────
export * from "./assetpack.js";

// ── Zod 错误 → 人可读（**只此一份**，v3 与 v4 都吃；票 28 起住这儿）─────────
export * from "./zod-issues.js";

// ── V2 的**理解层**契约：从参考图到「这个世界长什么样」 ────────────────────
// ⚠️ 本契约与它后面的 V2 诸契约**一律用 `zod/v4` 写**（票 28 定的边界）；
//   旧契约（本文件上面那些）继续用 `zod`。两边**不许互相嵌套** —— 镜像的代价见该文件头。
export * from "./visual-world.js";

// ── V2 的理解层下半：用户要什么 → 设计上是什么（票 03）────────────────────
// ⚠️ 机制/能力的**封闭词表**单独一层（`vocabulary.ts`）—— 三份契约引它，谁也不拥有它。
//   票 05（`runtime-profile`）必须采纳同一份，不许再立第二张表。
export * from "./vocabulary.js";
export * from "./game-intent.js";
// ⚠️ `RuntimeProfile`（票 05）—— **外壳能力的事实投影**（R12），被 `game-design` 引用。
//   ⚠️ 它**不落盘**（不在 `01 §13` 的九项里），也**不被外壳 import** —— 它是**读侧**的契约。
export * from "./runtime-profile.js";
export * from "./game-design.js";
// ⚠️ 角色基因（票 04）—— 落 `run/v<N>/character-dna.json`，**不交付**。
//   它的消费者是 R13 的资源级重生成：没有它，修复会**静默换掉角色**。
export * from "./character-dna.js";

// ── V2 的结构化调用底座：失败闭集 + 工具入参的取与验（票 27 / 28）──────────
// ⚠️ **纯的**：没有 fetch。I/O 那一半各包自理 —— 结构上新包够不着彼此（R11）。
export * from "./structured-call.js";

// ── 一次资源生成「花了什么」的账（跟着包走的收据）──────────────────────────
export * from "./ledger.js";
export * from "./coverage.js";

// ── 一次操作的对外回报形状（两个壳与所有 core 操作用同一份）────────────────
export * from "./command.js";

// ── 游戏配置：AI 与手写 runtime 之间唯一的语义接口 ─────────────────────────
// ⚠️ **两个变体、两个 format 串**（2026-09-29）：`game-config/v1` 是横版，
// `td-config/v1` 是塔防。它们是**平级的兄弟格式**，不是同一份 schema 的 v1/v2 ——
// 「一个文件 = 一个关卡」这条本来就允许关卡文件是不同形状，而判别式会让磁盘上
// 已经存在的每一份横版关卡当场读不出来（那个坑 assetpack 的 v1→v2 踩过一次）。
export * from "./game-config.js";
export * from "./td-config.js";

// ── 屏幕空间：两种玩法共用的那条判据与各自的 HUD 项清单（票 03 · 09）────
export * from "./screen-space.js";

// ── 资源规格（四类）与确定性校验 ──────────────────────────────────────────
export * from "./asset-spec.js";
export * from "./audit.js";
export * from "./recipe.js";

// ── 三个 QA 跑完之后留下的那一份东西（票 06）──────────────────────────────
// ⚠️ **判据阻断、观察只报**（R3）—— 落实它的办法不是注释，是**让「通过」那个位置
//   根本不存在**：`status` 是 `failures` 的纯函数（`qaVerdict`），它**不是字段**。
// ⚠️ 判据是**六条**，名字只住 `QA_JUDGEMENTS` 一处，同时被 `checked` 与
//   `QAFailure.judgement` 取用 —— 于是「码的条数 = 判据的条数」在类型上只有一份。
export * from "./qa.js";
