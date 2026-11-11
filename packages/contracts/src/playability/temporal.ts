// **时序分析的输入与编排词汇**（I-01）—— 纯函数，不读盘。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、I-01 只建立输入可信度与两档编排，不做时序算法
//
//   `stubTemporalAnalyzer` 是**显式占位实现**：对任何适用输入只返回
//   `INSUFFICIENT_EVIDENCE`，永不返回 `PROVEN_UNPLAYABLE` / `NO_PROVEN_BLOCKER`。
//   它不是能力声明；I-02 才在同一入口替换实现。
//
// 二、两档只比 verdict
//
//   `16.67ms` 与 `200ms` 两次调用；`verdict` 不同 ⇒ IE + `lag-disagreement`。
//   非法 lag ⇒ IE + `lag-invalid`，优先于 disagreement。`0` 合法（有限非负数）。
//
// 三、适用性与范围
//
//   只要存在 `kind === "hazard"` 且带 `motion` 的实体就适用；Y 轴与多移动 Hazard
//   保守 IE，不判为不适用。验证范围 = player + 配置引用的 hazard / pickup / goal。
// ─────────────────────────────────────────────────────────────────────────────
import type { AssetPackManifest } from "../assetpack.js";
import type { GameConfig } from "../game-config.js";
import type { PlayabilityVerdictState } from "./verdict.js";
import { isTrustedAtlasInput, type TrustedAtlasInput } from "./temporal-input.js";
import type { InternalBudget, TemporalInternalResult } from "./temporal-result.js";

/** 逐帧延迟（约 60Hz）。I01-04：唯一具名常量，不复用 mechanic.ts 的帧余量常量。 */
export const TEMPORAL_LAG_MS = 16.67;

/** 基准延迟：`smoothStep` 下 `delta ≤ 200ms` 的源码上界推导值，不是实测延迟。 */
export const TEMPORAL_LAG_BASELINE_MS = 200;

export type TemporalAuditResult =
  | { readonly applicable: false }
  | {
      readonly applicable: true;
      readonly verdict: PlayabilityVerdictState;
      readonly degradation?: "lag-invalid" | "lag-disagreement";
    };

export type TemporalAnalyzer = (args: {
  readonly config: GameConfig;
  readonly manifest: AssetPackManifest;
  readonly lagMs: number;
  readonly trustedInput: TrustedAtlasInput;
}) => TemporalAuditResult;

export type TemporalScope = {
  readonly applicable: boolean;
  /** player + 引用的 hazard / pickup / goal；去重、稳定排序。 */
  readonly assetIds: readonly string[];
};

/**
 * 适用性与验证范围的**唯一来源**：三处生产调用方都经由 `runTemporalAudit`，
 * 不各自重写一遍。
 */
export function temporalScope(config: GameConfig): TemporalScope {
  const ids = new Set<string>([config.player.asset]);
  let applicable = false;
  for (const entity of config.entities) {
    if (entity.kind === "hazard" && entity.motion !== undefined) applicable = true;
    if (entity.kind === "hazard" || entity.kind === "pickup" || entity.kind === "goal") ids.add(entity.asset);
  }
  return { applicable, assetIds: [...ids].sort((a, b) => a.localeCompare(b)) };
}

/** 显式生产 stub：只返回 IE，永不 NB / PU。它不是时序算法的能力声明。 */
export function stubTemporalAnalyzer(_args: Parameters<TemporalAnalyzer>[0]): TemporalAuditResult {
  return { applicable: true, verdict: "INSUFFICIENT_EVIDENCE" };
}

const lagInvalid = (): TemporalAuditResult => ({
  applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-invalid",
});

const insufficient = (): TemporalAuditResult => ({
  applicable: true, verdict: "INSUFFICIENT_EVIDENCE",
});

const isLagInvalid = (result: TemporalAuditResult): boolean =>
  result.applicable && result.degradation === "lag-invalid";

/**
 * 单档时序入口。
 *
 * 顺序：先校验 lag，再判 brand，再判适用性。非法 lag 即使配置没有移动 Hazard
 * 也返回 `applicable:true` + `lag-invalid`（I01-04 §6）。
 */
export function auditPlayabilityTemporal(
  config: GameConfig,
  manifest: AssetPackManifest,
  options: {
    readonly lagMs: number;
    readonly trustedInput: TrustedAtlasInput;
    readonly analyze: TemporalAnalyzer;
  },
): TemporalAuditResult {
  const { lagMs, trustedInput, analyze } = options;
  if (typeof lagMs !== "number" || !Number.isFinite(lagMs) || lagMs < 0) return lagInvalid();
  if (!isTrustedAtlasInput(trustedInput)) return insufficient();
  if (!temporalScope(config).applicable) return { applicable: false };
  return analyze({ config, manifest, lagMs, trustedInput });
}

/**
 * 两档比较。只比 `verdict`；`lag-invalid` 优先于 `lag-disagreement`。
 */
export function resolveTwoLagResults(a: TemporalAuditResult, b: TemporalAuditResult): TemporalAuditResult {
  if (isLagInvalid(a) || isLagInvalid(b)) return lagInvalid();
  if (!a.applicable && !b.applicable) return { applicable: false };
  if (!a.applicable || !b.applicable) {
    return { applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-disagreement" };
  }
  if (a.verdict === b.verdict) return { applicable: true, verdict: a.verdict };
  return { applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-disagreement" };
}

// ── I-02：内部入口词汇与确定性签名（U1，@internal）────────────────────────────
//
// ⚠️ 这些符号**不**进 `playability/index.ts` / `contracts/src/index.ts`：`api.ts` 只按
//   名字转出 I-01 的公共编排，不转出内部入口。`testHooks` 不是生产参数。
//
// ⚠️ `analyzeTemporalInternal` **不在 U1 实现**：本票只建立入口类型与签名辅助，
//   不新增任何分析结果、不接生产 Verdict。U1 的 `certificate` 恒为 `{ kind: "none" }`。

/** @internal I-02 内部入口输入；`start / goal / corridor` 由 `GameConfig` + profile 派生。 */
export type TemporalInternalInput = {
  readonly config: GameConfig;
  readonly manifest: AssetPackManifest;
  readonly lagMs: number;
  readonly trustedInput: TrustedAtlasInput;
  /**
   * @internal 仅用于 I-02 专项测试。
   * `budget` 不得高于硬上限；`now` 只参与 wall-clock abort，不参与相位 / 移动 /
   * 碰撞 / Witness / 策略选择。
   */
  readonly testHooks?: {
    readonly budget?: InternalBudget;
    readonly now?: () => number;
  };
};

/** @internal I-02 内部分析器类型；具体实现不在 U1。 */
export type TemporalInternalAnalyzer =
  (input: TemporalInternalInput) => TemporalInternalResult;

/** 规范化 JSON：对象键排序、数组保留语义顺序；不引入 `Map` / `Set` / class。 */
const stableStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, val) => {
    if (val === null || typeof val !== "object" || Array.isArray(val)) return val;
    const record = val as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = record[key];
    return sorted;
  });

/** FNV-1a 32-bit（UTF-16 code units），输出 8 位十六进制串。 */
const fnv1a32 = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

/**
 * @internal 确定性指纹（FNV-1a 32-bit）。
 *
 * 覆盖：`grid`、`work` 计数、`internalResult`、`certificate`、`diagnostics` 原因码、
 * `stats.budget` 状态。排除：`stats.timing.wallClockMs`、`diagnostics.detail`、
 * 时间戳与 `testHooks`。
 *
 * ⚠️ 32-bit 只是**指纹**，不是无碰撞证明。确定性测试必须同时比较签名与剔除
 * `wallClockMs` / `detail` 后的规范化完整序列化；不得仅凭签名相等判定结果相同。
 */
export function determinismSignature(result: TemporalInternalResult): string {
  return fnv1a32(stableStringify({
    internalResult: result.internalResult,
    certificate: result.certificate,
    grid: result.stats.grid,
    work: result.stats.work,
    budget: {
      budgetStatus: result.stats.budget.budgetStatus,
      budgetKind: result.stats.budget.budgetKind,
    },
    diagnostics: {
      degradationReason: result.diagnostics.degradationReason,
      secondaryReasons: result.diagnostics.secondaryReasons,
    },
  }));
}
