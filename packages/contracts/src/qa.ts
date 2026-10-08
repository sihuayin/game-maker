// `qa-report/v1` —— **一次运行跑完三个 QA 之后留下的那一份东西**（R3 · 票 06）。
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **本文件是 V2 契约 ⇒ 用 `zod/v4`**，封口一律 `z.strictObject`（票 28 定的边界，
//   理由与代价见 `structured-call.ts` 里 `toolInputSchema` 那一段）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、一份产物，**两半在类型上分开**，且 `status` **不是一个字段**（票 06 Q1）
//
//   R3 那条底线是：**判据阻断、观察只报**，观察**不许**影响通过与否。
//   落实它的办法不是写一句注释，是**让「通过」那个位置根本不存在**：
//
//     `status` 是 `failures` 的纯函数 ⇒ **可派生的副本不进契约**
//     （票 04 砍 `bodyProportions`、票 05 砍 `cameraModel` / `genre`，同一条理由）。
//     做成字段，就是给它一个**能被写错的位置**；做成 `qaVerdict()`，写侧读侧共用一处
//     （`ledger.ts` 尾注那条纪律：**别在别处再算一遍**）。
//
//   ⇒ 一次运行**只有一份** `run/v<N>/qa-report.json`（`01 §13` 的九项之一）——
//     不是为了省文件，是因为**人只有一个检查点**（R9），他要读的是**一份**东西。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、六条判据，**一个枚举两用**（票 06 Q2 / Q10）
//
//   `QA_JUDGEMENTS` 是**判据名字的家**，同时被两处取用：
//     `QAReport.checked`     —— 这一次**跑过**哪几条；
//     `QAFailure.judgement`  —— 这一条失败**属于**哪一条。
//   ⇒「码的条数 = 判据的条数」**在类型上只有一份**，没有东西可以漂移。
//     若立两个互为镜像的枚举，就多了一处「必须一直相等」的东西 ——
//     而那正是本仓库反复砍掉的那一类（票 04 砍 `bodyProportions`：可派生的副本）。
//
//   ⚠️ **十二个 `QAFailureCode` 去了哪里**：`01 §12` 原来那十二个码是**数值越界的名字**
//     （`STYLE_MISMATCH` / `SILHOUETTE_MISMATCH` …），与 R3 正面冲突。逐条判法见
//     [票 06 的 Answer]；净结果：**六个留、六个出局**。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、`JudgementResult` **只有二态**，且「成功」不是一种状态（票 06 Q21）
//
//     { ran: true,  findings: QAFinding[] }   —— 跑了；**findings 空 = 成功**
//     { ran: false, reason: string }          —— 没跑
//
//   ⚠️ **「成功 / 失败」是读出来的，不是写出来的**：它就是 `findings` 空不空。
//     ⇒ 不许在 `ran: true` 那一支里再放一个 `ok: boolean` —— 那是可派生的副本。
//     ⇒ 不许把联合做成三个变体。
//   ⚠️ **`ran: false` 的 `reason` 不落盘**：落盘的形式是「**不在 `checked` 里**」，
//     而**为什么**不在，今天是**静态**的（链要么走到 QA、要么在到达之前就死了），
//     所以它写在 §四那段自白里，不逐次记。
//
// ─────────────────────────────────────────────────────────────────────────────
// 四、自白：**今天恒真的三件事**（票 06 Q17，写法照票 05）
//
//   ① **六条判据今天 6/6 全跑** ⇒ `qaVerdict` 的 `"incomplete"` **今天走不到**。
//      这不是「一条写坏了的判据」，是**给第二种玩法 / 第二个成员留的位**。
//      ⚠️ **[票 18] 把那个真口子答了**：横版**有**纯层那条路 ——「冒烟可达」落在
//        `auditReachability()`（见 `QA_JUDGEMENTS` 里那一条）。
//   ② **`severity: "warning"` 今天一条都不报**。类型**允许**它（`auditGameConfig`
//      那一档「精确可算、但不构成判决」的形状一字不改地搬过来），但**哪一条判据
//      真去报警告**是**装配侧**的事（[票 20] §3），不是本契约的事。
//   ③ **`checked` 今天恒等于全集，是链的性质、不是类型的要求。** 类型**允许**缺席 ——
//      把「允许」与「今天如此」分开写，是为了让下一个人在链变了的时候**看得见差别**。
//
//   ④ ⚠️ **一份「族结果」落盘会过不了本契约**（[票 18] 实测）。`superRefine` ④ 要求
//      **每个观察来源恰好一条**，而一个族只产**自己**那几条（票 17 的决定：不许拿
//      `unavailable` 表示「不归我」）⇒ **把三个族凑成一份 `qa-report.json` 的那一步
//      必须补齐那两条观察** —— 那是[票 20]的活。今天不会炸，只因为 `pipeline` 用
//      `writeJson` 直接落盘、**不 parse**。
//
// ─────────────────────────────────────────────────────────────────────────────
// 五、`target` **复用账的词汇**（票 06 Q8）
//
//   `QAFinding.target` 与 `LedgerCall.target`（`ledger.ts`）是**同一套说法**：
//   资源 id（生图带 `<id>.<动画|层名>`）/ `recipe` / `game-config` / `td-config`。
//   ⇒ 「哪条判据在**谁**身上失败」与「哪次调用作用在**谁**身上」能**对齐**，
//     而修复循环（[票 21]）要的正是这个对齐 —— 它得知道**重跑哪一段**。
//   ⚠️ **不是** `ConfigIssue.where` 那种人话（`entity "x"`）：那个**解析不了**，
//     而复用账的词汇是唯一能让下游**机器**读懂归因的办法
//     （`game-config.ts:233` 立过的规矩：**同一个事实在哪里说都是同一句话**）。
//
// [票 18]: ../../../.scratch/game-maker-v2/issues/18-qa-gameplay-judgements.md
// [票 20]: ../../../.scratch/game-maker-v2/issues/20-qa-report-assembly.md
// [票 21]: ../../../.scratch/game-maker-v2/issues/21-repair-loop.md

import { z } from "zod/v4";

export const QA_REPORT_FORMAT = "qa-report/v1" as const;

// ─────────────────────────────────────────────────────────────────────────────
// 一、判据的家（**只此一份**）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 六条判据。R3 只收三类 —— **集合差 · 构造性约束 · 引用族**，都是
 * 「精确可算 **+ 错了一定不是设计**」（`CONTEXT.md` 的门槛：说不出后半句的，就是观察）。
 *
 * ⚠️ 每一条后面写着它**今天在哪儿**、以及它**为什么够得上判据**。
 * ⚠️ **语气是名词**（判据名），不是失败语气 —— 这个枚举**两用**（`checked` 与
 *   `QAFailure.judgement`），而 `checked: ["palette-binding"]` 必须是通顺的。见 §二。
 */
export const QA_JUDGEMENTS = [
  /** **色板绑定四值自洽**（`exact` / `composited` / `quantized` / `unbound`）。
   *  住 `assetpack.ts` / `quantize.ts`（票 36 定）。够得上判据：绑定值是**声明**，
   *  而声明的意思是「这个包的颜色与色板是什么关系」—— 报错了，下游读到的是**假的**。 */
  "palette-binding",
  /** **三条构造性约束**：`size` 与帧 bounds 一致 · `anchor` 落在 [0,1] · 九宫格只能在面板上读。
   *  住 `pack.ts` / 校验处。够得上判据：九宫格误写的代价**落在画上**，
   *  而画错了**不会自己报错**（`CONTEXT.md` 的九宫格那一段）。
   *  ⚠️ **asset 侧那一半归这里**；**config 侧**的尺寸关系（砖 == `arena.cell`）归
   *     `reference-resolution` —— 见票 06 Q2 的劈法。 */
  "constructive-constraint",
  /** **层覆盖**：不平铺的层 ≥ 视口，且**最远那层必须 100%**（视口 480×270 是外壳常量）。
   *  住装配期（`pack.ts` 已经硬失败），`backgroundCoverage` 是**共用的那一个** helper。
   *  够得上判据：最远层后面**没有东西**，没画满就是露底 —— 没有「另一条路」这回事。 */
  "layer-coverage",
  /** **引用族**：`hud.panel` 必须是 `ui` · 砖的尺寸必须**正好**等于 `arena.cell` ·
   *  资源引用解得到。住 `game-config.ts` 的 `auditReferences()` / `td-config.ts`。
   *  够得上判据：解不到就是解不到，没有哪一种设计意图能把它变成对的。
   *  ⚠️ **票 18 的两处收窄**：① 它只吃**引用族** —— `auditGameConfig` 的自洽族
   *     （东西摆在世界外 · 出生点卡在墙里）**不在这一条判据里**，那归 `compile-runtime` /
   *     `site` 的硬失败；② ⚠️ **`characterId` 不在这里**（`01-contracts.md §10` 曾把它列在
   *     本条名下，那是**串了侧**）：它住 `AssetSpec`（清单），而「必须命中一条 DNA」由 `pack` 抛
   *     （`pack.ts` 的 `dnaOrThrow`）—— 那是**资源侧**的事，config 侧碰不到它。 */
  "reference-resolution",
  /** **冒烟：`boot → spawn → goal` 可达**。⚠️ **怎么跑，票 18 已经定了**：「跑游戏」
   *  （Playwright / headless 那一簇）**本图不做**，改成在 `contracts` 的
   *  `auditReachability()` 里算一条**纯层的静态可达性** —— 从出生点出发，用**故意过宽**的
   *  移动模型（跳跃顶点 · 跑速 · 危险物当空气 · 下落不设限）做一次 BFS，**只报够不到**的
   *  终点与拾取物。⚠️ 过宽是**故意的**：可达集因此是上界，「不在里面」才可靠。 */
  "reachability",
  /** **集合差**：`GameIntentSpec` 里每个实体 / 机制在 `GameDesignSpec` 里有对应项。
   *  按 **id**（`entities` / `mechanics`）或**文本相等**（其余）。
   *  够得上判据：它是**可减的集合**。⚠️ 文本相等**是脆的**，那条已知噪声由票 19 写下。 */
  "intent-coverage"
] as const;

export const QAJudgementSchema = z.enum(QA_JUDGEMENTS);
export type QAJudgement = z.infer<typeof QAJudgementSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 二、失败怎么记（**两个形状**：内层不带 `judgement`，落盘那层才带）
// ─────────────────────────────────────────────────────────────────────────────

/** 严重度。**「精确可算、但不构成判决」的那一档**（`auditGameConfig` 的先例：
 *  「**精确的硬失败、上界的报警告**」）。
 *  ⚠️ **只有 `error` 决定 `qaVerdict`** —— `warning` 不阻断，与观察一样不阻断。 */
export const QA_SEVERITIES = ["error", "warning"] as const;
export const QASeveritySchema = z.enum(QA_SEVERITIES);
export type QASeverity = z.infer<typeof QASeveritySchema>;

/** 一条失败。⚠️ **不带 `judgement`** —— 它住在哪条判据底下，**由键说**（票 06 Q19）。
 *  让内层也带一个 `judgement`，就多一个**能被写错的位置**
 *  （`paletteBinding: { findings: [{ judgement: "reachability", … }] }` 能编过），
 *  而那要再写一条判据去拒它 —— 结构性优于判据。 */
export const QAFindingSchema = z.strictObject({
  /** 作用在**谁**身上。⚠️ 词汇与 `LedgerCall.target` **同一套**（文件头 §五）。 */
  target: z.string().min(1),
  /** 人话。⚠️ 与 `ConfigIssue.message` 同位。 */
  detail: z.string().min(1),
  severity: QASeveritySchema
});
export type QAFinding = z.infer<typeof QAFindingSchema>;

/** **落盘**那一条 = 内层 + 投影出来的 `judgement`。
 *  ⚠️ 这不是「第二份真相」，是**投影** —— 同一个 `summarizeCalls` 的位置：
 *  写入侧与读取侧共用一处，别在别处再算一遍。 */
export const QAFailureSchema = QAFindingSchema.extend({
  judgement: QAJudgementSchema
});
export type QAFailure = z.infer<typeof QAFailureSchema>;

/** 一条判据**这一次**跑出来的结果。**二态** —— 见文件头 §三。
 *  ⚠️ 定义在 `QAFindingSchema` **之后**，就是为了不必 `z.lazy` —— 惰性 schema 会让
 *    `toolInputSchema` 那一侧的转换多一处没必要的机关。 */
export const JudgementResultSchema = z.discriminatedUnion("ran", [
  z.strictObject({
    ran: z.literal(true),
    /** **空数组 = 通过**。⚠️ 「成功」不是一个变体，是**这个数组空着**。 */
    findings: z.array(QAFindingSchema)
  }),
  z.strictObject({
    ran: z.literal(false),
    /** ⚠️ **不落盘**（落盘的形式是「不在 `checked` 里」）—— 它是给**产侧**读的。 */
    reason: z.string().min(1)
  })
]);
export type JudgementResult = z.infer<typeof JudgementResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 三、观察（**只报，不阻断、不打分**）
// ─────────────────────────────────────────────────────────────────────────────

/** 观察**从哪来**。⚠️ 封闭枚举：加第三个来源 = 加一个值（`LedgerStep` 的先例）。
 *  今天两个，都是**已经存在的家**（票 06 §3）—— 观察**不许重算**，`qa.ts` 也
 *  **不 import 它们中的任何一个**（重算 = 第二份真相，而这两处的**措辞本身**
 *  就是裁决过的东西：`review.ts:6` 那句「只说差异、不说好坏……不要求打分」）。 */
export const OBSERVATION_SOURCES = ["inspect", "review"] as const;
export const ObservationSourceSchema = z.enum(OBSERVATION_SOURCES);
export type ObservationSource = z.infer<typeof ObservationSourceSchema>;

export const OBSERVATION_OUTCOMES = ["ok", "unavailable"] as const;
export const ObservationOutcomeSchema = z.enum(OBSERVATION_OUTCOMES);
export type ObservationOutcome = z.infer<typeof ObservationOutcomeSchema>;

/** 一条观察。
 *
 *  ⚠️ `lines` 是**产它那一处渲染好的话**（`inspect` 的 `summary` / `reviewPack` 的
 *    `observations`），**原样搬**，不是一个被重新定型的结构化副本 ——
 *    `CommandResult.data` 有它自己已经定型过的形状，再嵌一次就是**同一份数据定型第二次**
 *    （`ledger.ts` 拒绝把账塞进 manifest 是同一条理由：一进契约就得跟着契约走版本）。
 *
 *  ⚠️ **按 `outcome` 判别的二态联合**，与 `JudgementResult` 同一条纪律（文件头 §三）：
 *    拿到了就有 `lines`、**没有** `reason`；没拿到就有 `reason`、**没有** `lines`。
 *    ⚠️ 第一版写成扁平的 `{ source, outcome, lines, reason? }`，落盘前当场撞上它自己的病：
 *      `unavailable` 被逼着带一个**无意义的 `lines: []`** —— 那就是 `ledger.ts` 明令
 *      禁止的「**不许填 0 冒充「测到了 0」**」。联合让那个字段**根本不存在**，
 *      于是「没拿到」不必靠一个空数组冒充。
 *
 *  ⚠️ **`outcome` 不许省**：`unavailable` 的意思是「这一条**没拿到**」——
 *    今天 `reviewPack` 拿不到视觉上游时返回 `{ok:false}`，若这里不表达，
 *    那一半会**静默地是空的**，而「空」读起来正像「比过了，没差异」。
 *    这是 `ledger.ts` 那条「**缺席 == 一次都没失败**」纪律的**反面**。
 *  ⚠️ 只有**两值**，不是三值：「没试」与「试了没成」的差别**钱已经答了**
 *    （账里那一笔，`CallFailure`），报告不必再答一遍。
 */
export const ObservationSchema = z.discriminatedUnion("outcome", [
  z.strictObject({
    source: ObservationSourceSchema,
    outcome: z.literal("ok"),
    lines: z.array(z.string())
  }),
  z.strictObject({
    source: ObservationSourceSchema,
    outcome: z.literal("unavailable"),
    /** ⚠️ **必须说为什么** —— 由联合保证（没有它连对象都不成形），不是靠一条判据守。 */
    reason: z.string().min(1)
  })
]);
export type Observation = z.infer<typeof ObservationSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 四、报告本体
// ─────────────────────────────────────────────────────────────────────────────

/** `run/v<N>/qa-report.json`。
 *
 *  ⚠️ **三个字段，没有 `status`、没有 `repairAttempts`、没有 `createdAt`**：
 *    `status`         —— 派生（`qaVerdict`）；给了它就是给一个能被写错的位置。
 *    `repairAttempts` —— 它描述的是**循环**，不是**这一次 QA**：修复循环会让 QA 跑 N+1 次，
 *                        于是 N+1 份报告各自对**同一个字段**报不同的数。⇒ 落点开给票 21。
 *    `createdAt`      —— 「哪一次运行」由**目录**答了（`run/v<N>/`，R8 禁止覆盖）。
 */
export const QAReportSchema = z.strictObject({
  format: z.literal(QA_REPORT_FORMAT),
  /** 这一次**跑过**哪几条判据。⚠️ **是链报的事实，不是类型的要求** —— 见文件头 §四③。
   *  ⚠️ 它**由装配器投影出来**（`buildQAReport`），**不手打**。 */
  checked: z.array(QAJudgementSchema),
  /** 判据的全部结论。**空 = 通过**（在 `checked` 齐的前提下 —— 见 `qaVerdict`）。 */
  failures: z.array(QAFailureSchema),
  /** 观察。**不许影响成败**，它只是报给人看。 */
  observations: z.array(ObservationSchema)
}).superRefine((r, ctx) => {
  // ① `checked` 不许重复
  const seen = new Set<QAJudgement>();
  for (const [i, j] of r.checked.entries()) {
    if (seen.has(j))
      ctx.addIssue({ code: "custom", path: ["checked", i], message: `判据重复：${j} —— 一条判据只跑得了一次` });
    seen.add(j);
  }
  // ② **同一 `(judgement, target)` 不许重复**（票 06 Q16(ii)）——
  //    修复循环拿它派活，重复条目会让**同一个资源被派两次**。
  const pairs = new Set<string>();
  for (const [i, f] of r.failures.entries()) {
    const key = `${f.judgement} ${f.target}`;
    if (pairs.has(key))
      ctx.addIssue({
        code: "custom",
        path: ["failures", i],
        message: `(${f.judgement}, ${f.target}) 重复 —— 同一条判据在同一个目标上只报一次，细节并进 detail`
      });
    pairs.add(key);
  }
  // ③ 每条失败所属的判据**必须真跑过** —— 没跑的判据产不出失败，产得出就是文件坏了。
  for (const [i, f] of r.failures.entries())
    if (!seen.has(f.judgement))
      ctx.addIssue({
        code: "custom",
        path: ["failures", i, "judgement"],
        message: `判据 "${f.judgement}" 不在 checked 里 —— 没跑过的判据产不出失败`
      });
  // ④ **每个来源恰好一条**（票 06 Q14）—— 于是「这一条观察没拿到」**永远**是
  //    `outcome: "unavailable"`，**不是条目不见了**。一个**忘了写进去**的条目
  //    与一个「比过了、没差异」的条目，否则在文件里长得一样。
  //    ⚠️ 「unavailable 必须说为什么」**不在这里** —— 那个由观察自己的联合保证
  //      （没有 `reason` 连对象都不成形）。判据**只在结构做不到的地方**才立。
  const bySource = new Map<ObservationSource, number>();
  for (const [i, o] of r.observations.entries()) {
    const n = (bySource.get(o.source) ?? 0) + 1;
    bySource.set(o.source, n);
    if (n > 1)
      ctx.addIssue({ code: "custom", path: ["observations", i, "source"], message: `观察来源重复：${o.source} —— 每个来源恰好一条` });
  }
  for (const s of OBSERVATION_SOURCES)
    if (!bySource.has(s))
      ctx.addIssue({ code: "custom", path: ["observations"], message: `缺 ${s} 这一条 —— 每个来源恰好一条（没拿到是 outcome: "unavailable"，不是不写）` });
});
export type QAReport = z.infer<typeof QAReportSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 五、装配与派生（两个纯函数 —— **就这两处**）
// ─────────────────────────────────────────────────────────────────────────────

/** 装配的入参：**六条判据一条都不能少**。
 *
 *  ⚠️ 这是「结构性」落地的地方（票 06 Q13）：**漏跑一条是编译错误**，不是等到读报告
 *    时才发现。⚠️ 键就取自 `QA_JUDGEMENTS` —— 不再另立一套名字，见文件头 §二。
 *  ⚠️ **`checked` 是从这里投影出来的**，不是手打的。 */
export type QAJudgementResults = { readonly [K in QAJudgement]: JudgementResult };

/**
 * 把六个结果与观察**装成**一份报告。**纯函数** —— 不调上游、不扫像素、不 import
 * `review.ts` / `ops.ts`（票 06 Q3：QA **只装配、不分析**）。
 *
 * ⚠️ 特别地：`reviewPack` **要花钱**（一次视觉调用）。观察**必须由上游算好传进来**，
 *   这个函数**绝不能顺手再调一次**。
 */
export function buildQAReport(
  results: QAJudgementResults,
  observations: readonly Observation[]
): QAReport {
  const checked: QAJudgement[] = [];
  const failures: QAFailure[] = [];
  for (const j of QA_JUDGEMENTS) {
    const r = results[j];
    if (!r.ran) continue;
    checked.push(j);
    // 投影：把键上的 `judgement` 落到条目上（不是复制，是**加**）
    for (const f of r.findings) failures.push({ ...f, judgement: j });
  }
  return { format: QA_REPORT_FORMAT, checked, failures, observations: [...observations] };
}

/** 三值裁决。⚠️ **`"pass"` / `"fail"` / `"incomplete"` 三个字面量只在这一处出现** ——
 *  别在别处再判一次（`ledger.ts` 尾注那条纪律）。 */
export type QAVerdict = "pass" | "fail" | "incomplete";

/**
 * **派生意义上的 `status`。**
 *
 *   `fail`       —— 有一条 `severity: "error"` 的失败。**它赢过 `incomplete`**：
 *                   已知的阻断是**可行动的**，而「还有一条没查」不会让那次失败消失。
 *   `incomplete` —— 没有 error，但**有判据没跑**（`checked` 不全）。
 *                   今天走不到（文件头 §四①）—— 它存在的理由是**「没查」必须有名字**，
 *                   否则它会读成 `pass`，那是**一行假绿**。
 *                   （先例：`PaletteBinding` 的 `unbound` 被专门保留 ——
 *                    「删掉它就等于让这类包**在结构上无法诚实**」。）
 *   `pass`       —— 六条判据全跑，且一条 error 都没有。
 *                   ⚠️ **观察与 warning 都影响不了它** —— 那是 R3 的底线，而这里
 *                   是它唯一的落点：这两个字面上**根本不看** `observations`。
 */
export function qaVerdict(report: QAReport): QAVerdict {
  if (report.failures.some((f) => f.severity === "error")) return "fail";
  if (report.checked.length < QA_JUDGEMENTS.length) return "incomplete";
  return "pass";
}

/** 判据 → 人话的名字。渲染用；**不住在 `QA_JUDGEMENTS` 里**（那是名字的家，
 *  不是文案的家）。⚠️ 键必须穷尽 —— 这个对象是 `Record<QAJudgement, string>` 字面量，
 *  漏一个键就是**编译错误**。 */
export const QA_JUDGEMENT_LABELS: Record<QAJudgement, string> = {
  "palette-binding": "色板绑定自洽",
  "constructive-constraint": "构造性约束（尺寸 / 锚点 / 九宫格）",
  "layer-coverage": "层覆盖",
  "reference-resolution": "引用族",
  "reachability": "可达性（boot → spawn → goal）",
  "intent-coverage": "意图覆盖（集合差）"
};

// ── QA 的**扩展点**（票 15 的 Q12）──────────────────────────────────────────
//
// ⚠️ **这两个类型住这里、不住 `pipeline`**：`packages/qa` 的白名单只有 `contracts`
//   （`check-deps.mjs`）—— 类型住 pipeline，实现者就得**反向依赖**。
// ⚠️ 而 `pipeline` 的白名单里**有** `qa`：所以那一侧将来 import 的是**实现**，
//   两边共用的**形状**留在这里。

/**
 * **一个「QA 族」产出的那一份**（票 18 的 R2-Q4）。
 *
 * ⚠️ **族 ≠ 判据**（`CONTEXT.md`）：判据是**格子**（六条，`QA_JUDGEMENTS` 是名字的家），
 *   族是**谁填它们** —— 视觉（`03 §21`）· 玩法（`§22`）· 意图（`§23`）各是一族。
 *   ⇒ `judgements` 是 **`Partial`**：一个族**只声明自己那几条**。
 * ⚠️ **缺席 = 不归本族**（票 18 的 R3-Q1），而**不是**「我没跑」。一个族**该跑却跑不了**
 *   （输入读不回来 / 格式不对）是**抛** —— 那是硬失败，不是一份报告
 *   （`visual.ts` 读不到清单时就是这么做的）。
 * ⚠️ 于是 `ran: false` 在家族形状里只剩「**我确实没跑这一条**」一种合法用法，而那种情况
 *   今天不存在（`CONFIG_SHAPES` 只有一行）。真出现时是**加一个值**，不是现在替它开口。
 *
 * ⚠️ **谁来凑成一份 `QAReport`**：合成器（[票 20]）—— 它要保证六条判据**每条恰好被一个族
 *   声明一次**，并补齐上面 §四④ 那两条观察。本类型**不住 pipeline**：`packages/qa` 的白名单
 *   只有 `contracts`，类型住 pipeline 会逼出一次反向依赖（与 `QaRunner` / `QaContext` 同一条理由）。
 */
export type QaFamilyResult = {
  judgements: Partial<QAJudgementResults>;
  observations: readonly Observation[];
};

/** 一个族的出口。⚠️ 拿 `Partial` 说话的 `QaRunner`（合成器**是**一个 `QaRunner`）。 */
export type QaFamilyRunner = (ctx: QaContext) => Promise<QaFamilyResult>;

/** 一次 QA 要看的四样东西。⚠️ **全是路径**：QA 跑在各步的产物都落盘**之后**（票 15 的 Q12）。 */
export type QaContext = {
  /** `run/v<N>/` 的绝对路径（设计 / 基因 / 清单都在里面）。 */
  runDir: string;
  /** `pack/v<N>/` 的绝对路径。 */
  packDir: string;
  /** 已落盘的 `game-config.json` 的绝对路径。 */
  configPath: string;
  gameId: string;
};

/**
 * QA 的**扩展点** —— `createGame` 收一个可选的它（票 15 的 Q7「γ + α」）。
 *
 * ⚠️ **它只返回、不落盘**：写 `run/v<N>/qa-report.json` 的是 pipeline（票 15 的 Q3）。
 * ⚠️ **它是可缺席的**：今天 `packages/qa` 还是空骨架（票 17-20）⇒ `createGame` 的返回里
 *   **要说得出这一格缺席**，而不是假装查过。
 */
export type QaRunner = (ctx: QaContext) => Promise<QAReport>;
