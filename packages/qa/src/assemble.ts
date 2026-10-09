// 票 20 的落点：**三个族的汇合处** —— 谁把三份「族结果」凑成一份 `qa-report.json`。
//
// ⚠️ **本票的第一件事**：`QaRunner`（返回整份报告的那个）在票 17/18/19 把出口改成
//   「族结果」之后**没有实现者**了（`contracts/qa.ts` 的 `QaFamilyResult` 尾注点了这个名）。
//   **合成器**就是那个实现者 —— 它的形状**就是** `QaRunner`，票 15 的 `createGame` 收的
//   也是它（形状一个字没改，改的是**谁来填**）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、它做三件事，**不多不少**（票 20 的 Q1）
//
//   ① 三族**并发**跑（`Promise.all`）—— 它们只读文件、互不依赖，串行没有理由；
//   ② 把三份 `Partial<QAJudgementResults>` 拼成**完整的六条**；
//   ③ 补齐**两条观察**。
//
//   ⚠️ **它不落盘、不渲染、不判裁决**：写 `run/v<N>/qa-report.json` 的是 `pipeline`
//     （票 15 的 Q3），三值裁决的**唯一**那处是 `qaVerdict()`（契约里那两个函数）。
//     这里的产物**只有**一个 `QAReport` 对象。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、`layer-coverage` 由**本处**补一条 `ran: false`，而那不是缺口（票 19 改准的那条）
//
//   六条判据里，第五条不住在任何族里：**层覆盖**由**装配期**的硬失败保证（`pack.ts`）。
//   ⇒ `checked` 今天**恒为 5/6**、`qaVerdict` **恒为 `incomplete`**，而那是**说真话**
//     （有判据没由 QA 跑）—— ⚠️ **不要**为了让它变成 `pass` 去动 `checked`。
//
//   ⚠️ `ran: false` 的 `reason` **不落盘**（契约 §三：落盘的形式就是「不在 `checked` 里」）
//     ⇒ 这里写的那句话是给**产侧**读的，而它**自动**不进 `checked`（`buildQAReport` 只收
//     `ran: true` 的键）⇒ 5/6 是**结构**给的，不是手打的。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、观察那一栏：今天两条都是 `unavailable`（票 20 的 Q2，人类裁定）
//
//   契约的 `superRefine` ④ 要求**每个来源恰好一条**，今天两个来源 ⇒ **必须两条**
//   （票 18 实测：一份族结果直接落盘 `safeParse ⇒ false`）。而三个族**都不产**别人的观察
//   （票 17 的裁定：不许拿 `unavailable` 表示「不归我」）⇒ **补齐它是合成器唯一的活**。
//
//   ⇒ 今天合成器**只装配、不采集**：它够不着那两个家（`reviewPack` / `inspectPack` 住
//     `assets`，而本包的白名单只有 `contracts`），而契约也明写「观察**必须由上游算好传进来**，
//     装配**不许**顺手去调 `reviewPack`」（那要花一次视觉调用的钱）。
//     ⚠️ 于是两条都写 `unavailable` —— **那是契约给的词**：「『没试』与『试了没成』的差别
//       **钱已经答了**（账里那一笔）」，所以这里不必区分，也**不许**伪造一份 `summary`。
//     ⚠️ 它的意思**不是**「这两个命令跑失败了」，而是「这一次**没有可搬的引用**」——
//       理由那句话把这件事说清楚，否则读报告的人会把「没拿到」读成「比过了、没差异」。
//     ⚠️ 「把 `inspect` 的观察接进创建链」是**在范围内**的下一步，还没人开（见地图的
//       Not yet specified）；`review` 那条压在那张「视觉观察要喂原图」的票上。
//
// ─────────────────────────────────────────────────────────────────────────────
// 四、族**抛** ⇒ 本处**不接**（票 20 的 Q1）
//
//   「该跑却跑不了」（读不回来 / 不过契约）是**硬失败**，不是一条判据的失败 ——
//   三个族自己就是这么裁的（票 18 的 R3-Q1）。⇒ `Promise.all` 让它直接冒出去，
//   **不生成半截报告**。而 `pipeline` 的落盘在 runner **返回之后** ⇒ 失败时磁盘上
//   **不会**留下一份长得像完整结果的报告。
import {
  buildQAReport,
  type JudgementResult, type Observation, type QAJudgement, type QAJudgementResults,
  type QAReport, type QaContext, type QaFamilyResult, type QaRunner,
} from "@game-maker/contracts";
import { gameplayQaRunner } from "./gameplay.js";
import { intentQaRunner } from "./intent.js";
import { visualQaRunner } from "./visual.js";

/**
 * **合成器**：三族 → 一份 `qa-report.json` 的内容。
 *
 * ⚠️ 它**只返回、不落盘**（落盘归 `pipeline`，票 15 的 Q3）——
 *   与三个族自己的纪律一字不差，只是它交出去的是**整份**。
 */
export const qaRunner: QaRunner = async (ctx: QaContext): Promise<QAReport> => {
  // ① 三族并发。⚠️ 它们只**读**磁盘上那几份产物（票 15 的 Q12：QA 跑在各步落盘**之后**），
  //   彼此没有边 ⇒ 并发没有顺序问题。
  const [visual, gameplay, intent] = await Promise.all([
    visualQaRunner(ctx), gameplayQaRunner(ctx), intentQaRunner(ctx),
  ]);

  // ② 拼成完整的六条。⚠️ **显式逐个取**，不是一个 `...spread` 加一个 cast：
  //   目标类型 `QAJudgementResults` 要求**六条都在**，于是
  //     · 漏写一条 ⇒ **编译错误**（与 `QA_JUDGEMENT_LABELS` 同一条纪律）；
  //     · 一条判据被两个族声明过 ⇒ 这里**读不到**那个重复（各族的键是写死的字面量，
  //       同名键在**它们自己**那里就是编译错误）⇒ 运行时**不需要**再查一遍重复。
  const judgements: QAJudgementResults = {
    "constructive-constraint": declared(visual, "constructive-constraint"),
    "palette-binding": declared(visual, "palette-binding"),
    // ⚠️ 这一条**没有族**（见文件头二）：它由装配期的硬失败保证，而报告仍要说得出它没被跑。
    "layer-coverage": { ran: false, reason: "归装配期硬失败（pack.ts）—— 没有族声明它" },
    "reference-resolution": declared(gameplay, "reference-resolution"),
    "reachability": declared(gameplay, "reachability"),
    "intent-coverage": declared(intent, "intent-coverage"),
  };

  // ③ 两条观察（见文件头三）。
  return buildQAReport(judgements, NOT_COLLECTED);
};

/**
 * 取一条**这一族声明过**的判据。
 *
 * ⚠️ 取不到就是**我们自己的 bug**（一个族丢了自己那一格），不是模型/输入的错 ——
 *   所以这里是**抛**，而不是补一条 `ran: false` 混过去：
 *   一个静默变成 3/6 的报告会把这件事故意藏起来，而 `checked` 的差集**本来就是**
 *   「这一次真跑过哪几条」的意思（票 06）—— 拿它去吸收一个 bug，就等于让那句话开始说谎。
 * ⚠️ 类型那一侧只有 `Partial`（一个族**只声明自己那几条**是它的权利）⇒ 完整性的责任
 *   在**本处**：上面那张表就是那个责任，而它由**编译器**守着。
 */
function declared(family: QaFamilyResult, judgement: QAJudgement): JudgementResult {
  const got = family.judgements[judgement];
  if (got === undefined)
    throw new Error(
      `装配：这一族没有声明它自己那条判据「${judgement}」—— 这是合成器与被调族的约定被打破了，不是输入的错`,
    );
  return got;
}

/**
 * 两条观察 —— **今天都是 `unavailable`**（见文件头三）。
 *
 * ⚠️ 理由是**给人读的**，而它要说清两件事：这一条**没人去拿**（而不是拿失败了），
 *   以及「留空 ≠ 比过了、没差异」。第二条尤其要紧 —— 契约把 `unavailable` 立成一个
 *   必须带理由的分支，为的就是挡住那个误读。
 * ⚠️ 措辞里**不写票号**：票号是**过程**的词，报告是**产物**的词（它会跟着产物一起被
 *   归档、被人读），而「哪一天接上」不改变「今天为什么空着」这句话的真假。
 */
const NOT_COLLECTED: readonly Observation[] = [
  {
    source: "inspect",
    outcome: "unavailable",
    reason: "这次创建链没有跑 `inspect`（它是诊断命令，链上没有人调它）—— 没有可原样搬来的观察，"
      + "而**空不等于「比过了、没差异」**",
  },
  {
    source: "review",
    outcome: "unavailable",
    reason: "这次创建链没有跑 `reviewPack`（它要花一次视觉调用的钱，而它今天比的是联系表、不是参考图）"
      + " —— 没有可原样搬来的观察，而**空不等于「比过了、没差异」**",
  },
];
