// **机制覆盖报告**（票 07）—— 意图→机制契约的收口：每个**设计声明要做的机制**，
//   在三层上各落一个状态（设计 / 运行时 / QA），合并成一份「哪些机制端到端齐了」的报告。
//
// ⚠️ 它与 `qa.ts` 的六条判据**不是一回事**（票 06 裁定）：六判据是**产物级**判据
//   （`intent-coverage` 判的是「意图的实体/机制在设计里有没有对家」——**集合差**）；
//   这份报告是**机制级**的三层矩阵（那条机制在设计里 claimed 了、外壳实现了、probe 证过了）。
//   ⇒ 它**不做成第 7 判据**（`pixel.ts:56` 政策），是**独立报告 + 门禁**（[票 08] 消费）。
//
// ── 三层分别由什么填 ──────────────────────────────────────────────────────────
//   · **design（设计覆盖）**：`deriveMechanicStatus` —— 机制**状态**（supported 才能拿来做正式游戏）。
//     这是 R12 `mechanic-experimental` 那条硬约束的**结果**（`build-design.ts` 已用它拦）。
//   · **runtime（运行时覆盖）**：`RUNTIME_IMPLEMENTED_MECHANICS` —— **运行时实现见证**（源码转录）。
//   · **qa（QA 覆盖）**：`QA_PROBED_MECHANICS` —— **行为级 probe**（真 Chrome 里跑通），
//     或调用方传进来的 `probeResults`（probe 那一发真跑的结果，能分出 `failed`）。
//
// ⚠️ design 与 runtime **今天**等价（`DEPRECATED_MECHANICS` 为空 ⇒ supported ⟺ 有运行时实现），
//   但**不是同一个问题**：design 问「这一代能不能拿它做正式游戏」（状态），runtime 问
//   「外壳源码里有没有它那一行」（见证）。哪天有机制退役（deprecated），两格就分叉。
//
// ⚠️ **单个必需机制失败不被总体通过掩盖**（FR-07 末）：`verdict` 是「**全部**三层 satisfied」，
//   不是「大多数」；门禁读它，任一机制任一格非 satisfied 即失败。
import { z } from "zod/v4";
import {
  QA_PROBED_MECHANICS, RUNTIME_IMPLEMENTED_MECHANICS, deriveMechanicStatus,
  MechanicSchema, type Mechanic,
} from "./vocabulary.js";
import type { GameDesignSpec } from "./game-design.js";

export const MECHANIC_COVERAGE_FORMAT = "mechanic-coverage/v1" as const;

/** 三层合用的封闭状态枚举（FR-07 末要求的五态）。⚠️ 每层只用到它的一子集
 *  （design/runtime：satisfied·unsupported；qa：satisfied·not-tested·failed），
 *   但**枚举只有一个** —— 合并成一个五态，门禁那侧不用记「哪一层有哪几个值」。 */
export const MECHANIC_COVERAGE_STATUSES = ["satisfied", "missing", "unsupported", "not-tested", "failed"] as const;
export const MechanicCoverageStatusSchema = z.enum(MECHANIC_COVERAGE_STATUSES);
export type MechanicCoverageStatus = z.infer<typeof MechanicCoverageStatusSchema>;

export const MechanicCoverageSchema = z.object({
  /** 机制的封闭枚举 id（不是意图的自由文本）。 */
  mechanic: MechanicSchema,
  design: MechanicCoverageStatusSchema,
  runtime: MechanicCoverageStatusSchema,
  qa: MechanicCoverageStatusSchema,
}).strict();

export const MechanicCoverageReportSchema = z.object({
  format: z.literal(MECHANIC_COVERAGE_FORMAT),
  mechanics: z.array(MechanicCoverageSchema),
  /** `satisfied` = 每条机制三层全 satisfied；否则 `failed`。 */
  verdict: z.enum(["satisfied", "failed"]),
}).strict();

export type MechanicCoverage = z.infer<typeof MechanicCoverageSchema>;
export type MechanicCoverageReport = z.infer<typeof MechanicCoverageReportSchema>;

/** probe 结果（票 15 的 `{ mechanicId, passed }`）。缺省时回落到 `QA_PROBED_MECHANICS`（全当 passed）。 */
export type ProbeResult = { mechanic: Mechanic; passed: boolean };

/** 门禁语义（票 08）：**missing / unsupported / failed 阻断，`not-tested` 不阻断**。
 *  ⚠️ `not-tested` = 这条机制**没有行为级 probe**（基线机制，靠 witness + 既有金字塔盖住），
 *   不是「查漏了」—— 所以它过门禁；而 `failed` = **有 probe 却红了**，那是真失败。
 *  ⚠️ 「必须有通过的 probe」由**免费验收**强制（`pnpm test:mechanic` 对 `QA_PROBED_MECHANICS`
 *   全绿，红了非 0），不是门禁在这里再数一遍。 */
const isGateBlocking = (m: MechanicCoverage): boolean =>
  m.design !== "satisfied" || m.runtime !== "satisfied" || m.qa === "failed";

/**
 * 由**设计**（R12 已过的那份）产 per-mechanic 覆盖报告。
 *
 * ⚠️ 输入只有 `design` —— 因为这份报告活在**门禁**那一环（QA 之后），那时 R12 已经
 *   保证「意图 ⊆ 设计」（缺机制、串机制都在设计段被拒了）。所以这里的「必需机制」=
 *   `design.mechanics`（设计声明要做的机制），缺机制不是这份报告的事。
 */
export function buildMechanicCoverage(
  design: GameDesignSpec,
  probeResults: readonly ProbeResult[] = [],
): MechanicCoverageReport {
  const probed = new Map(probeResults.map((p) => [p.mechanic, p.passed]));
  const defaultProbed = probeResults.length === 0
    ? new Map(QA_PROBED_MECHANICS.map((m) => [m, true]))
    : null;

  const mechanics: MechanicCoverage[] = design.mechanics.map((m) => {
    const status = deriveMechanicStatus(m.mechanic);
    const qaPassed = defaultProbed
      ? defaultProbed.get(m.mechanic)
      : probed.get(m.mechanic);
    return {
      mechanic: m.mechanic,
      design: status === "supported" ? "satisfied" : "unsupported",
      runtime: RUNTIME_IMPLEMENTED_MECHANICS.includes(m.mechanic) ? "satisfied" : "unsupported",
      qa: qaPassed === undefined ? "not-tested" : qaPassed ? "satisfied" : "failed",
    };
  });

  return {
    format: MECHANIC_COVERAGE_FORMAT,
    mechanics,
    verdict: mechanics.every((m) => !isGateBlocking(m)) ? "satisfied" : "failed",
  };
}

/** 门禁那一半（票 08 消费）：哪条机制在哪一层掉了，**逐条**说清楚；全绿 = `undefined`。 */
export function mechanicCoverageProblem(report: MechanicCoverageReport): string | undefined {
  const bad = report.mechanics.filter(isGateBlocking);
  if (bad.length === 0) return undefined;
  const lines = bad.map((m) => {
    const parts = [
      m.design !== "satisfied" ? `设计层 ${m.design}` : null,
      m.runtime !== "satisfied" ? `运行时层 ${m.runtime}` : null,
      m.qa === "failed" ? `QA 层 ${m.qa}` : null,
    ].filter(Boolean);
    return `  · \`${m.mechanic}\`：${parts.join("；")}`;
  });
  return `机制覆盖没过（${bad.length}/${report.mechanics.length} 条端到端不齐）：\n${lines.join("\n")}`;
}
