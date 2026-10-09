// **意图覆盖** —— `03 §23` 那条 Intent QA，判据的名字是 `intent-coverage`（票 06 定，票 19 落地）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、⚠️ **只有 id 那一半活下来 —— 文本那一半被测死了**（票 19 的 Q1）
//
//   票 03 当年定的是两半：`entities` / `mechanics` 按 **id** 相减，
//   `coreLoop` / `winConditions` / `loseConditions` / `progression` 按**文本相等**相减。
//   票 10 把 id 那一半做进了 `compile-design` 的拒绝，并把「剩下的文本那一半」播给了票 19。
//
//   ⚠️ 票 19 拿票 10 探针留下的 **4 发真输出**（`experiments/design-first-shot/raw/*.json`，
//     两份 `ok` + 两份 `hostile`）量了文本那一半，结果是 **0% 命中**：
//
//       `coreLoop`       0/3 · 0/3 · 0/3 · 0/3
//       `winConditions`  0/1 ×4        `loseConditions`  0/1 ×4      `player.goals`  0/1 ×4
//       `player.role` · `world.theme` · `world.setting` —— 四条全是 ≠
//
//     意图 3 条 `coreLoop` → 设计 4 条，每条更长更具体
//     （「在废土平台上跳跃移动」→「在废土平台上左右移动，跨过断裂的台阶与地缝。」）。
//     ⇒ **设计层不复述意图层，它放大意图层** —— 那不是模型不听话，那是 `game-design.ts`
//       要的东西（「设计层必须**完整**、必须**可执行**」），它照做了。
//
//   ⇒ 把文本相等接成 `error`，`qaVerdict` 会在**每一个**游戏上 `fail`，包括那两发 R12
//     一条都挑不出来的。那不是「脆」，是**恒错** —— 判据的门槛是「**错了一定不是设计**」（R3），
//     而这一条错的时候，设计恰恰是对的。⇒ **砍掉**，而且**不是**降成 `warning`
//     （一条永远响的警告不带信息，还会把 `qa.ts` 那句「`warning` 今天一条都不报」的自白推翻）。
//
//   ⚠️ 顺带两笔，免得下一个人回头找：
//     · `progression` 两边**连字段名都不一样**（意图 `{type?, description?}` **可选** /
//       设计 `{model, description}` **必填**），「文本相等」在它身上**根本没有定义**；
//       而 4/4 发意图里压根没有 `progression`，设计层各造了一份。
//     · 票 10 播过来的那笔残余噪声（模型把做不了的机制**挑个近似的**顶上去，如
//       `m-double-jump` → `jump`）**本函数抓不住**，而它今天**没有机械的落点**：
//       探针里它甚至漏进了散文（04-hostile 的 `progression.description` 写着「越来越依赖二段跳」，
//       而 `mechanics` 里没有它）。反制只在提示词与工具说明里（「做不了就整条省掉」）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、⚠️ **本函数只返回「缺了哪几项」—— 它既不是 `Rejection`，也不是 `QAFinding`**
//
//   它有两个调用方，而两边要说的话**不一样**（票 19 的 Q9）：
//     · `compile-design`（`build-design.ts`）—— 渲染成 R12 的 `Rejection`，人拿去**改需求**；
//     · **意图族**（`packages/qa/src/intent.ts`）—— 渲染成**一条** `QAFinding`，
//       `target` 是 `game-design`（账的词汇）。
//   ⇒ 返回任何一方的形状，都会让 contracts 认识那一方的词汇（或反过来）。
//     返回**中性的** `MissingIntentItem[]`，那两句话各自留在各自那一侧 ✓
//     （与 `auditReferences` 返回 `ConfigIssue[]`、由 QA 那边合成一条 finding 同款）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、**串桶也算缺**，而 `foundIn` 说得清是哪一种（票 19 的 Q9 / Q12）
//
//   意图层的 `entities[].type` 是**封闭枚举**，为的就是这一件事（`game-intent.ts` 明写：
//   「它若自由，覆盖度就判不了**串桶**（要的是敌人，做成了 NPC）」）。
//   ⇒ 找的是**按 `type` 落进去的那个桶**，**不是**「任意桶里有就算」。
//
//   ⚠️ 于是「同一个 id 躺在**别的**桶里」与「压根没有它」是**两种**结论，`foundIn` 分开它们：
//     · 串桶 —— `foundIn` 出现（它其实在哪个桶）；
//     · 真缺失 —— `foundIn` **根本不存在**。⚠️ **别写 `foundIn: undefined`**：optional 就是它的语义。
//   ⚠️ **两个调用方都读它**：`build-design.ts` 拿它把「没做」与「放错桶」分开说（那句话是给人
//     改需求用的，说反了人就会去空桶里找一个就在隔壁的东西），QA 拿它点名。
//
// ─────────────────────────────────────────────────────────────────────────────
// 四、**单向**（票 10 的 R2-Q1）：查的是 **意图 ⊆ 设计**
//
//   设计层是「**意图覆盖 + 需求补全**」，不是意图的镜像 —— 它**可以多**
//   （依据在需求语义里的补全，先例是探针那个 `e-water`），**不可以少、不可以改、不可以串桶**。
//   ⇒ 这里**不查**「设计里多出来的东西」：那是合法的，而「多出来的那个有没有依据」**不可机械判定**
//     ⇒ 它**不是判据**（R3），只活在提示词纪律里。**谁也别把它写成一条永远绿的判据。**
//     ⚠️ 「补了多少、补了什么」今天在报告里**没有落点**：QA 的观察是两个**已有**家的原样引用
//       （`inspect` / `review`，票 06），而人真正看得见它的时刻是 **R9 的检查点**（那时他手上有
//       清单，也有 `intent.md`）。票 19 的 Q7 判过这件事，别再去找一个不存在的字段。
import { ENTITY_BUCKETS, type EntityBucket, type IntentEntityType } from "./vocabulary.js";
import type { GameDesignSpec } from "./game-design.js";
import type { GameIntentSpec } from "./game-intent.js";

/** 四个桶的家 = `ENTITY_BUCKETS` 的值（**不重抄一遍那四个字面量**）。 */
const BUCKETS: readonly EntityBucket[] = Object.values(ENTITY_BUCKETS);

/** 意图里的某一项，在设计层**没有对家**。⚠️ 二态联合：一个分支里**无意义**的字段**根本不存在**
 *  （与 `qa.ts` 的 `JudgementResult` / `Observation` 同一条纪律）。
 *  ⚠️ `saidAs` 是「**用户当时怎么说的**」（实体的 `role` / 机制的 `name`）—— 它刻意**不叫**
 *    `label`：那是设计层展示名会用的词，而这里要的是**意图的原话**（报错要点用户自己的话）。 */
export type MissingIntentItem =
  | {
      kind: "entity";
      id: string;
      /** 用户对这个实体的说法（意图层的 `entities[].role`）。 */
      saidAs: string;
      /** 意图层给它定的 `type`（封闭枚举）。 */
      type: IntentEntityType;
      /** 按 `type` 它**本该**落在哪个桶。 */
      bucket: EntityBucket;
      /** ⚠️ **只在串桶时存在**：同一个 id 其实躺在哪个桶里。 */
      foundIn?: EntityBucket;
    }
  | {
      kind: "mechanic";
      id: string;
      /** 用户对这条机制的说法（意图层的 `mechanics[].name`，**自由文本** —— 所以报得出「二段跳」）。 */
      saidAs: string;
    };

const hasId = (arr: readonly { id: string }[], id: string): boolean => arr.some((x) => x.id === id);

/**
 * **意图里的每个实体 / 机制，在设计层里有对家吗**（`01-contracts.md §10` 的 `intent-coverage`）。
 *
 * @returns 逐条**缺了的**项（`entities` 先、`mechanics` 后 —— 与票 10 落地的那个次序一致）；
 *          **空数组 = 覆盖成立**。
 * ⚠️ 遍历次序是**接口的一部分**：两个调用方都按它渲染，改了它两边的话会一起错位。
 */
export function auditIntentCoverage(
  intent: GameIntentSpec,
  design: GameDesignSpec
): MissingIntentItem[] {
  const out: MissingIntentItem[] = [];

  for (const e of intent.entities) {
    const bucket = ENTITY_BUCKETS[e.type];
    if (hasId(design[bucket], e.id)) continue;
    // ⚠️ 它是不是躺在**别的**桶里 —— 「放错桶」与「没做」是两种结论（见文件头三）。
    const foundIn = BUCKETS.find((b) => b !== bucket && hasId(design[b], e.id));
    out.push({
      kind: "entity", id: e.id, saidAs: e.role, type: e.type, bucket,
      ...(foundIn === undefined ? {} : { foundIn })
    });
  }

  for (const m of intent.mechanics)
    if (!hasId(design.mechanics, m.id))
      out.push({ kind: "mechanic", id: m.id, saidAs: m.name });

  return out;
}
