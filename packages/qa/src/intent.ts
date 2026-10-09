// 票 19 的落点：**Intent QA 的判据那一半**（`docs/v2/03-claude-code.md §23`）。
//
// ⚠️ **本票的射程一句话**：把**意图 ⊆ 设计**那条集合差接进 QA —— 而它**只有 id 那一半**。
//   不新增文本判据 · 不重算上游判据 · 不报「设计多补了什么」· 不管 `ambiguity`。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、⚠️ **文本那一半是票 19 亲手砍掉的，别把它加回来**（票 19 的 Q1）
//
//   票 03 当年给这条判据定了两半，票 10 做掉了 id 那一半、并把「其余字段按**文本相等**」
//   播给了票 19。票 19 拿票 10 探针留下的 **4 发真输出**量了一遍：
//
//     `coreLoop` **0/3 · 0/3 · 0/3 · 0/3**   `winConditions` / `loseConditions` / `player.goals` 各 0/1 ×4
//     `player.role` · `world.theme` · `world.setting` —— 四条全是 ≠
//
//   意图 3 条 `coreLoop` → 设计 4 条，每条更长更具体。⇒ **设计层不复述意图层，它放大意图层**
//   （`game-design.ts` 要它「完整、可执行」，它照做了）。
//   ⇒ 接成判据的话，**每一个**游戏都会红 —— 包括那两发 R12 一条都挑不出来的。
//     那不是「脆」，是**恒错**：门槛是「**错了一定不是设计**」，而它错的时候设计恰恰是对的。
//   ⇒ 所以文本那一半在**两个调用方那里都不存在**（本族与 `build-design.ts` 共用
//     `contracts` 的那一个 `auditIntentCoverage()`）。理由与测量全在 `intent-coverage.ts` 的头一。
//
//   ⚠️ 于是本文件里**有一条特殊的钉子**（`qa/tests/intent.test.ts`）：一份**真**的、
//     覆盖成立的设计，它的 `coreLoop` 与意图层**完全不一样**，而这条判据**仍然绿**
//     —— 那不是漏测，那是**故意的**（它挡的就是「有人把文本那一半加回来」）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、**一条 finding，`target` 恒 `game-design`**（票 19 的 Q3）
//
//   契约的 `superRefine` ②：「**同一 `(judgement, target)` 不许重复** —— 细节并进 `detail`」，
//   而 `target` 复用**账的词汇**（`game-intent` / `game-design` / `game-config` / `recipe` / 资源 id）。
//   ⇒ 缺的可能是**好几项**，但出问题的只有**一份**东西（设计那一份，也正是 `compile-design`
//     那次调用的 `target`）⇒ 一条 finding，逐项落进 `detail` 的行里。
//   ⚠️ 逐项拆成多条会被契约拒（target 撞车），而且会**暗示**一个并不存在的
//     「只重跑这一项」的粒度 —— 与票 18 的 `merged()` 同一条理由。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、⚠️ **它在链上恒绿 —— 那是要写下来的自白，不是删掉它的理由**（照票 18 的体裁）
//
//   步序是 `理解段（含 compile-design）→ … → pack → config → qa`，而 `compile-design`
//   在 `intent-entity-missing` / `intent-mechanic-missing` 上**拒**（`build-design.ts` 的
//   `kind: "rejected"`）⇒ pipeline 当场停 ⇒ **能走到 QA 的那份设计，必然已经覆盖过意图**。
//   ⇒ 本判据在新链上**响不了**。为什么仍然接线（三条与票 18 一字不差）：
//     ① 判据的名字与家是票 06 定的（`qa.ts` 的 `QA_JUDGEMENTS` 里那一条）；
//     ② `incomplete` 若成为**恒态**，那个值就失去了信号（今天 `checked` 是 5/6，见 `qa.ts` 四①）；
//     ③ QA 是**交付态的自述**：它要能在一份**任意**的「intent + design」上说得出话，
//        `compile-design` 只是**其中一个**调用者。
//   ⚠️ 而它**真的会响**：`qa/tests/intent.test.ts` 拿一份**故意改坏**的设计证明了这件事
//     （拷出来再删掉一个实体 / 把它挪进错的桶）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 四、⚠️ **反向差集不在这里，`ambiguity` 也不在这里**（票 19 的 Q5 / Q7）
//
//   · 「设计里**多出来**的实体」是**合法的**（意图覆盖 + 需求补全，票 10 的 R2-Q1），
//     而「多出来的那个有没有依据」不可机械判定 ⇒ 它**不是判据**，本族**一个字都不报**。
//     ⚠️ 它今天在报告里**没有落点**，那是**知道**的：QA 的观察是两个**已有**家的原样引用
//       （`inspect` / `review`，票 06），而人真正看得见它的时刻是 **R9 的检查点**。
//     票 10 那句「反向差集**只能是观察**」的措辞已就地更正（票 19 的 Q7）。
//   · `ambiguity`（「**你没说**」）与缺项（「**我们没做**」）**不是一回事**：
//     前者指向用户、后者指向我们，混起来会让报错指错一方。而前者的消费者是
//     **R9 的检查点**（票 16 兑现：停的时候逐条打 `ambiguity[]`）—— 本族**一个字的歧义都不读**。
//   ⚠️ `03 §23` 那份输入清单里的第三样 `Playable Game` **用不上**：这条判据只看两份文书。
import fs from "node:fs";
import {
  auditIntentCoverage, formatIssues, GameDesignSpecSchema, GameIntentSpecSchema,
  type MissingIntentItem, type QAFinding, type QaContext, type QaFamilyResult, type QaFamilyRunner,
} from "@game-maker/contracts";

/**
 * **意图族**的 `QaFamilyRunner` —— 本包的第三份实现（`visual.ts` · `gameplay.ts` 之后）。
 *
 * ⚠️ 它**只声明自己那一条**（`intent-coverage`），其余五格缺席 = 不归我。
 * ⚠️ 两份文书读不回来 / 不过契约 = **抛**（「该跑却跑不了」是硬失败，不是一条判据的失败）
 *   —— 与 `visual.ts` 读不到清单、`gameplay.ts` 读不到配置同款（票 18 的 R3-Q1）。
 * ⚠️ **两份都重过一次契约**：它们可能是**手改过**的（`run/v<N>/` 是人看得见、摸得着的），
 *   而两份契约都带着「同时管从磁盘上读回来的那一份」那条 gate ⇒ 手改坏的文件在这里就该响。
 */
export const intentQaRunner: QaFamilyRunner = async (ctx: QaContext): Promise<QaFamilyResult> => {
  // ⚠️ 用 `safeParse` + `formatIssues`，**不是** `parseWith` —— 后者签名锚在 **zod v3** 的
  //   `ZodType` 上，而这两份是 **v4** 契约（票 28 的边界：两套 Zod 不许互相嵌套）。
  //   `formatIssues` 收的是**结构类型**（`{issues}`），两边都吃 ✓ —— 它是本仓库唯一那份格式化器。
  const intent = GameIntentSpecSchema.safeParse(read(ctx.intentPath, "意图"));
  if (!intent.success)
    throw new Error(`意图读不回来或不过契约：${formatIssues(intent.error).slice(0, 4).join("；")}`);
  const design = GameDesignSpecSchema.safeParse(read(ctx.designPath, "设计"));
  if (!design.success)
    throw new Error(`设计读不回来或不过契约：${formatIssues(design.error).slice(0, 4).join("；")}`);

  const missing = auditIntentCoverage(intent.data, design.data);
  return {
    judgements: {
      // ⚠️ **空数组 = 通过**（票 06 §三：「成功」不是一个变体，是这个数组空着）。
      "intent-coverage": { ran: true, findings: missing.length === 0 ? [] : [finding(missing)] }
    },
    // ⚠️ **空着** —— 本族不产观察（`inspect` 归票 20、`review` 归票 22），
    //   而**不许**拿 `unavailable` 表示「不归我」（见 `visual.ts` 文件头五）。
    observations: []
  };
};

/** ⚠️ 坏 JSON 要说得清**是哪一样东西、哪个文件**（`JSON.parse` 的原话里只有后者）。 */
function read(p: string, what: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`${what}读不出来或不是 JSON：${p} —— ${(e as Error).message}`);
  }
}

/**
 * 缺项 → **一条** finding（见文件头二）。
 *
 * ⚠️ `severity` **恒 `error`**：用户点名要的一个实体 / 机制在设计层没有对家，**没有哪一种设计意图
 *   能把它变成对的**（R3 那半句门槛）。⇒ 本族不产 `warning`（票 06 那句「今天一条都不报」仍成立）。
 * ⚠️ 每一行都**点名用户自己的话**（`saidAs`）与那一个 id —— 那一行是给人读的，
 *   而「哪一项」要一眼看得出来。
 */
function finding(missing: readonly MissingIntentItem[]): QAFinding {
  return {
    // ⚠️ **账的词汇**：出问题的是设计那一份，也正是 `compile-design` 那次调用的 `target`
    //   （票 06 §五：`target` 与 `LedgerCall.target` 同一套说法，票 21 靠它对齐）。
    target: "game-design",
    severity: "error",
    detail: missing.map(describe).join("\n")
  };
}

/** 一项缺项的人话。⚠️ 串桶与「没做」**分开说** —— 前者人找错了地方会白找一圈（票 19 的 Q12）。 */
function describe(m: MissingIntentItem): string {
  if (m.kind === "mechanic")
    return `意图里的机制「${m.saidAs}」（\`${m.id}\`）：设计层没有对家` +
      "（设计层的机制是**封闭枚举**，只有外壳真做得了的那几条 —— 要么做不了它、要么把它丢了）";
  return `意图里的 ${m.type}「${m.saidAs}」（\`${m.id}\`）：设计层的 \`${m.bucket}\` 里没有它` +
    (m.foundIn === undefined
      ? ""
      : ` —— ⚠️ 但它**其实在 \`${m.foundIn}\` 里**：这是**串桶**（同一个 id 换了 \`type\`），不是没做`);
}

