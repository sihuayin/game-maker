// `delivery` —— **一次交付验收的检查项状态与最终结论**（FPVS-V1-P1 · 票 03 / 07）。
//
// ⚠️ **它是报告层（delivery layer）的词汇，不是 QA 层**：`qa.ts` 的 `QAVerdict` 回答
//   「三个 QA 族跑没跑满」，本文件的 `DeliveryVerdict` 回答「综合资源/配置/QA/站点/试玩/
//   视觉六类之后，这一版**能不能交付**」—— 前者是后者的**输入之一**（票 03 Q3 裁定：
//   同名不同义，不得互相复用字段）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、两个封闭枚举，**小写连字符**（票 03 Q1）
//
//   `DeliveryCheckStatus` —— 单个检查项的状态，五值：
//     `pass`          检查已执行，结果满足要求
//     `fail`          检查已执行，确定不满足要求
//     `incomplete`    检查结果不足以作出通过/失败结论，或检查未完成
//     `blocked`       检查因明确的前置条件缺失而无法执行
//     `not-required`  当前交付要求明确不要求此检查
//       ⚠️ `not-required` 必须来自**明确的适用性规则**，不能用来隐藏未执行/失败的检查。
//   `DeliveryVerdict` —— 最终交付状态，四值（`not-required` 不参与最终计算）：
//     `pass` / `fail` / `incomplete` / `blocked`
//
//   小写 + 连字符 = 仓库「not X」的既有约定（`not-tested` / `not-run`），
//   与 spec 文档里的大写 `FAIL`/`INCOMPLETE` 只是写法不同、语义同一。
import { z } from "zod/v4";

export const DeliveryCheckStatus = z.enum(["pass", "fail", "incomplete", "blocked", "not-required"]);
export type DeliveryCheckStatus = z.infer<typeof DeliveryCheckStatus>;

export const DeliveryVerdict = z.enum(["pass", "fail", "incomplete", "blocked"]);
export type DeliveryVerdict = z.infer<typeof DeliveryVerdict>;

// ─────────────────────────────────────────────────────────────────────────────
// 二、最终交付状态的**确定性计算**（票 03 Q2）
//
//   总序优先、先命中先赢：**`fail` > `blocked` > `incomplete` > `pass`**。
//   只对 `required: true` 的检查项计算；`not-required` 不参与最终状态。
//
//   §6 矩阵十二场景（A–L）全映射见 `tests/delivery.test.ts`。
//
//   ⚠️ 两条纪律：
//   ①「必需检查项却标 `not-required`」是**非法状态**（「必需」与「不要求」自相矛盾），
//     应由报告契约校验（票 08 的 schema）在**写之前**拒绝；本函数只做兜底抛错，
//     不把这种输入静默读成 `pass`（那是假绿）。
//   ②「必需检查项缺失」同样由票 08 的注册表 + schema 拒绝 —— 本函数只看到
//     「被标记 required 的那些」，看不到「本该 required 却没出现的那些」。
export function deriveDeliveryVerdict(
  checks: ReadonlyArray<{ status: DeliveryCheckStatus; required: boolean }>,
): DeliveryVerdict {
  const required = checks.filter((c) => c.required);
  if (required.some((c) => c.status === "fail")) return "fail";
  if (required.some((c) => c.status === "blocked")) return "blocked";
  if (required.some((c) => c.status === "incomplete")) return "incomplete";
  if (required.every((c) => c.status === "pass")) return "pass";
  // 走到这里 = 有必需检查项既非 pass 也非 fail/blocked/incomplete ⇒ 只能是 not-required。
  throw new Error("Invalid delivery check: a required check must be pass|fail|incomplete|blocked, never not-required");
}

// ─────────────────────────────────────────────────────────────────────────────
// 三、检查项注册表 + `delivery` 报告本体（票 08）
//
//   `delivery` 是 `qa-report/v1` 顶层那个**可选子对象**：QA 层记「三个 QA 族跑没跑满」，
//   `delivery` 记「综合资源/配置/QA/站点/试玩/视觉六类之后能不能交付」。两者住在**同一份文件**里
//   （票 04 Q1：不新增平行报告文件、不升版），但**不是同一层** —— 加 `delivery` 不碰 QA 层字段。
//
//   六个检查项（§FR-02 的六条判定规则 → 六个 key，全部**必需**）：
//     `asset-pack`     资源包确定性校验（verifyPack / 包完整性）
//     `config`         游戏配置编译（compileRuntime）
//     `qa`             三个 QA 族（qaVerdict，六判据）
//     `site`           站点构建（assembleSite）
//     `playable-smoke` 自动试玩（headless smoke，票 09 落地）
//     `visual-review`  视觉人工对照（HumanVerdict，票 10 落地）
//
//   ⚠️ **必需性不住在 `checks[]` 的每条里**（票 04 Q2 约束二）：`checks` 只有 `key/status/detail`，
//     哪个 key 必需、判定规则是什么，是**代码里这一张固定注册表**（`DELIVERY_REQUIRED_CHECKS`）说了算。
//     于是「必需检查项缺失」与「必需检查项标 `not-required`」都能在**写之前**被 schema 拒绝 ——
//     不靠 `not-required` 隐式绕过必需检查。

/** 六个交付检查项的 key —— **名字只住这一处**（与 `QA_JUDGEMENTS` 同一条规矩）。 */
export const DELIVERY_CHECK_KEYS = [
  "asset-pack",
  "config",
  "qa",
  "site",
  "playable-smoke",
  "visual-review",
] as const;
export type DeliveryCheckKey = (typeof DELIVERY_CHECK_KEYS)[number];

/** 检查项 → 人话名字（渲染用；**不在 `DELIVERY_CHECK_KEYS` 里**，那是名字的家）。键穷尽 = 编译期。 */
export const DELIVERY_CHECK_LABELS: Record<DeliveryCheckKey, string> = {
  "asset-pack": "资源包校验",
  "config": "配置编译",
  "qa": "QA 六判据",
  "site": "站点构建",
  "playable-smoke": "自动试玩",
  "visual-review": "视觉人工对照",
};

/** **必需检查项**（§FR-02 六条判定规则：资源/配置/QA/站点/试玩/视觉**全部必需**）。
 *  ⚠️ 六项都是必需 —— 缺任何一项（或标 `not-required`）都到不了 `pass`。 */
export const DELIVERY_REQUIRED_CHECKS: readonly DeliveryCheckKey[] = [...DELIVERY_CHECK_KEYS];

export const DeliveryCheckSchema = z.strictObject({
  key: z.string().min(1),
  status: DeliveryCheckStatus,
  detail: z.string().min(1).optional(),
});
export type DeliveryCheck = z.infer<typeof DeliveryCheckSchema>;

/** 视觉评审三态。⚠️ 值同 `animation-acceptance.ts` 的 `HumanVerdict`（pending/pass/fail），
 *  但**不复用那份 schema**：那个文件是 `zod`（v3），本文件是 `zod/v4` —— 跨实例嵌套会被 v4 当成「不是 schema」
 *  （qa.ts 里 `Checksum` 那条注释记过同一个坑）。票 06 Q1 裁「复用 HumanVerdict 三值、不加取消/无效/重评」。 */
export const DeliveryVisualReviewStatus = z.enum(["pending", "pass", "fail"]);
export type DeliveryVisualReviewStatus = z.infer<typeof DeliveryVisualReviewStatus>;

export const DeliveryVisualReviewSchema = z.strictObject({
  status: DeliveryVisualReviewStatus,
  reviewer: z.string().min(1).optional(),
  reviewedAt: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});
export type DeliveryVisualReview = z.infer<typeof DeliveryVisualReviewSchema>;

export const DeliveryEvidenceSchema = z.strictObject({
  /** 证据是什么（人话标签，如 `smoke-result` / `smoke-screenshot` / `console-log`）。 */
  ref: z.string().min(1),
  /** 证据文件的路径。 */
  path: z.string().min(1),
});
export type DeliveryEvidence = z.infer<typeof DeliveryEvidenceSchema>;

/** `delivery` 里那条校验和的正则 —— 与 qa.ts 的 `subject.manifestChecksum` **逐字相同**（v4 不复用 v3 的 `Checksum`）。 */
const MANIFEST_CHECKSUM = /^sha256:[0-9a-f]{64}$/;

export const DeliveryReportSchema = z.strictObject({
  /** 这次运行的标识。复用 run/v<N> 命名（目录身份，见 `run-ledger.ts` 的 invariant 1）。 */
  runId: z.string().min(1),
  /** 包身份 —— **复用 `subject`**（票 04 Q2/Q3），不新造一套。 */
  pack: z.strictObject({
    packId: z.string().min(1),
    packVersion: z.number().int().positive(),
    manifestChecksum: z.string().regex(MANIFEST_CHECKSUM, "形如 sha256:<64 位小写十六进制>").optional(),
  }),
  /** 实际使用的配置（指向那份 game-config 文件）。 */
  config: z.strictObject({ file: z.string().min(1) }),
  /** 站点身份 —— **仅在已装配（拿到了版本号）时填**（票 04 Q2）。未装配省略，不伪造版本。 */
  site: z.strictObject({
    version: z.number().int().positive(),
    shell: z.string().min(1),
  }).optional(),
  /** 各检查项状态。⚠️ **没有 `required` 字段** —— 必需性由 `DELIVERY_REQUIRED_CHECKS` 决定。 */
  checks: z.array(DeliveryCheckSchema),
  /** 最终交付结论 —— **派生量**，但**落盘成字段**（票 04 Q2 明确列了它）⇒ 用 superRefine 保证它
   *  与 `deriveDeliveryVerdict` 一致，写错的位置会被拒。 */
  verdict: DeliveryVerdict,
  /** 视觉评审状态（独立于 QA/结构验收，票 04 Q2）。 */
  visualReview: DeliveryVisualReviewSchema,
  /** 证据引用（日志/试玩/截图），可追溯。 */
  evidence: z.array(DeliveryEvidenceSchema),
  /** 确认的限制（不代替状态）。 */
  knownLimitations: z.array(z.string().min(1)).optional(),
}).superRefine((r, ctx) => {
  // ① `checks` 不许重复 key（一条检查项只报一次）。
  const seen = new Set<string>();
  for (const [i, c] of r.checks.entries()) {
    if (seen.has(c.key)) ctx.addIssue({ code: "custom", path: ["checks", i, "key"], message: `检查项重复：${c.key}` });
    seen.add(c.key);
  }
  // ② 每个必需 key 都必须**在 `checks` 里**（票 07 注：纯函数看不到「本该 required 却没出现的」，这一条在这里补上）。
  for (const key of DELIVERY_REQUIRED_CHECKS) {
    if (!seen.has(key)) ctx.addIssue({ code: "custom", path: ["checks"], message: `缺必需检查项：${key}` });
  }
  // ③ 必需 key 不得标 `not-required`（「必需」与「不要求」自相矛盾，写前即拒）。
  const required = r.checks.filter((c) => DELIVERY_REQUIRED_CHECKS.includes(c.key as DeliveryCheckKey));
  for (const [i, c] of r.checks.entries()) {
    if (DELIVERY_REQUIRED_CHECKS.includes(c.key as DeliveryCheckKey) && c.status === "not-required")
      ctx.addIssue({ code: "custom", path: ["checks", i, "status"], message: `必需检查项 "${c.key}" 不得标 not-required` });
  }
  // ④ `verdict` 与确定性计算一致（§9.2 确定性）。只在没有非法输入时才算（非法输入已由②③拦住）。
  const hasNotRequiredRequired = required.some((c) => c.status === "not-required");
  if (!hasNotRequiredRequired && required.length === DELIVERY_REQUIRED_CHECKS.length) {
    const expected = deriveDeliveryVerdict(required.map((c) => ({ status: c.status, required: true })));
    if (r.verdict !== expected)
      ctx.addIssue({ code: "custom", path: ["verdict"], message: `verdict 与检查项不一致：应为 ${expected}，实际 ${r.verdict}` });
  }
  // ⑤ `site` 字段与 `site` 检查项**一致**（票 04 Q2：已装配填真实、未装配省略）。
  const siteCheck = r.checks.find((c) => c.key === "site");
  const hasSite = r.site !== undefined;
  if (hasSite && siteCheck?.status !== "pass")
    ctx.addIssue({ code: "custom", path: ["site"], message: "有 site 版本却记 site 未通过 —— 只能记已装配那一次的通过" });
  if (!hasSite && siteCheck?.status === "pass")
    ctx.addIssue({ code: "custom", path: ["checks"], message: "site 检查项 pass 却没有 site 版本 —— 版本号丢失" });
});
export type DeliveryReport = z.infer<typeof DeliveryReportSchema>;

/** 用注册表把 `checks` 折成最终结论。⚠️ **只这一处**把「哪个 key 必需」接到 `deriveDeliveryVerdict` 上。 */
export function deliveryVerdictOf(checks: readonly DeliveryCheck[]): DeliveryVerdict {
  return deriveDeliveryVerdict(
    checks
      .filter((c) => DELIVERY_REQUIRED_CHECKS.includes(c.key as DeliveryCheckKey))
      .map((c) => ({ status: c.status, required: true })),
  );
}

export type DeliveryReportInput = {
  runId: string;
  pack: { packId: string; packVersion: number; manifestChecksum?: string };
  config: { file: string };
  site?: { version: number; shell: string };
  checks: readonly DeliveryCheck[];
  visualReview?: DeliveryVisualReview;
  evidence?: readonly DeliveryEvidence[];
  knownLimitations?: readonly string[];
};

/**
 * 装成一份 `delivery`。**纯函数** —— 不算 verdict 以外的任何东西，不碰文件系统。
 *
 * ⚠️ `verdict` 由 `checks` + 注册表**算出来**（不是调用方顺手打的布尔）；缺必需项 / `not-required`
 *   绕过 / verdict 不符都会在 `DeliveryReportSchema.parse` 这一步**抛**（写之前拒绝，不落一份假绿）。
 */
export function buildDeliveryReport(input: DeliveryReportInput): DeliveryReport {
  return DeliveryReportSchema.parse({
    runId: input.runId,
    pack: input.pack,
    config: input.config,
    ...(input.site === undefined ? {} : { site: input.site }),
    checks: input.checks.map((c) => ({ ...c })),
    verdict: deliveryVerdictOf(input.checks),
    visualReview: input.visualReview ?? { status: "pending" },
    evidence: input.evidence === undefined ? [] : input.evidence.map((e) => ({ ...e })),
    ...(input.knownLimitations === undefined ? {} : { knownLimitations: [...input.knownLimitations] }),
  });
}
