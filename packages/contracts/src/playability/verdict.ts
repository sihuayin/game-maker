// 可玩性判定的**结果词汇**（LP-02 建立；LP-03～LP-05 共用）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、三态是框架的纪律，不是措辞
//
//   `PROVEN_UNPLAYABLE`   有确定性证据证明走不通 ⇒ 硬拒；
//   `INSUFFICIENT_EVIDENCE` 当前判据证不了 ⇒ **不产 issue**；
//   `NO_PROVEN_BLOCKER`   执行过的判据没找到阻断 ⇒ **不等于**「可玩」。
//
//   ⚠️ `NO_PROVEN_BLOCKER` 永远不写成 `PROVEN_PLAYABLE`：本系统没有「可玩」这个态。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、**层内 verdict 与整关 aggregate 是两个层级**（plan R21(a)，用户 2026-11-05 批准）
//
//   矩阵里的 `expectedVerdict` 是「所属层 / 判据」的预期；整关聚合另测。
//   ⇒ `aggregateLayer` **不**因为 `coverage === "partial"` 就把层内 verdict 拉成
//     `INSUFFICIENT_EVIDENCE`：层内 verdict 回答「这一层找到阻断了吗」，
//     `coverage` 单独、诚实地记录这一层看得有多全。LP-05 做整关聚合时，
//     `partial` 才按 framework §3.3 把总 verdict 拉向 `INSUFFICIENT_EVIDENCE`。
//
//   ⚠️ 这不是把 partial 藏起来：`LayerResult.coverage` 与每条 evidence 的 `coverage`
//     都带着它；测试必须**同时**断言 verdict 与 coverage，不能只看 verdict。

import type { Aabb } from "./geometry.js";

export type PlayabilityVerdictState =
  | "PROVEN_UNPLAYABLE"
  | "INSUFFICIENT_EVIDENCE"
  | "NO_PROVEN_BLOCKER";

export type CoverageState = "checked" | "partial" | "not-checked";

/** 时序覆盖状态；与 I-00 §8 的 checked / partial / unknown 逐字一致。 */
export type TemporalCoverageState = "checked" | "partial" | "unknown";

/** 公共时序退化原因闭集（D9 内部原因码的 many-to-one 摘要）。 */
export type PublicTemporalDegradation =
  | "invalid-input" | "model-out" | "geometry-untrusted"
  | "budget-exhausted" | "witness-volume" | "hop-sample-budget"
  | "wall-clock-abort" | "lag-disagreement" | "no-witness"
  | "no-permanent-gate" | "graph-cut-incomplete"
  | "hop-doubling-changed" | "movement-model-unclosed";

/** 公共几何摘要；I-02 内恒为 manifest 元数据 + 未验证 Runtime 体。 */
export type PublicGeometryCoverage = {
  readonly chain: "manifest+atlas-metadata";
  readonly runtimeBody: "unverified";
  readonly coverage: "partial";
};

/** 公共 PU 条件摘要；只在 permanent-gate evidence 上出现。 */
export type PublicPuCondition = {
  readonly id:
    | "gate-coverage" | "geometry-checked" | "graph-cut"
    | "hop-doubling" | "model-out-excluded" | "lag-consistent";
  readonly status: "PASS" | "BLOCKED" | "INSUFFICIENT_EVIDENCE" | "NOT_RUN";
  readonly evidence?: string;
  readonly blockedReason?: string;
};

/** 公共时序模型摘要；不含完整 proof / witness / stats。 */
export type TemporalModelEvidence = {
  readonly conditional: true;
  readonly geometryCoverage: {
    readonly hazard: PublicGeometryCoverage;
    readonly player: PublicGeometryCoverage;
    readonly graph: PublicGeometryCoverage;
  };
  readonly movementModelClosure: "not-proven-air-control";
  /** 仅 permanent-gate 证据携带；NB / IE 缺省。 */
  readonly puConditions?: readonly PublicPuCondition[];
};

/** 单档 lag 结论摘要；不含逐档 Witness / proof / stats。 */
export type TemporalLagConclusion = {
  readonly lagMs: number;
  readonly internalResult: "nb-candidate" | "pu-candidate" | "insufficient-evidence";
  readonly certificateKind: "witness" | "permanent-gate" | "none";
  readonly certificateStatus: "COMPLETE" | "INCOMPLETE";
  readonly degradation: PublicTemporalDegradation | null;
};

/** 双档 lag 证据；`perLag` 恰好 [主档, 基准档]。 */
export type TemporalLagEvidence = {
  readonly mode: "gate-independent; witness-only";
  readonly invariantByConstruction: true;
  readonly perLag: readonly TemporalLagConclusion[];
};

/** 公共退化摘要；`COMPLETE` ⇒ reason=null、secondary=[]。 */
export type TemporalDegradationEvidence = {
  readonly reason: PublicTemporalDegradation | null;
  readonly secondary: readonly PublicTemporalDegradation[];
};

/** 紧凑预算 / 工作摘要；不含完整 Stats。 */
export type TemporalLimitsEvidence = {
  readonly budgetStatus: "complete" | "exhausted" | "aborted" | "invalid";
  readonly budgetKind:
    | "state-budget" | "edge-budget" | "cut-budget"
    | "witness-volume" | "hop-sample-budget" | "wall-clock-abort" | null;
  readonly witnessTransitions: number;
  readonly witnessBytes: number;
  readonly maxWitnessTransitions: number;
  readonly maxWitnessBytes: number;
  readonly hopSamplesChecked: number;
  readonly maxHopSamples: number;
  readonly geometryCoverage: "partial";
};

export type PlayabilityCoverage = {
  readonly spatial: CoverageState;
  readonly mechanic: CoverageState;
  readonly completion: CoverageState;
  /** 仅时序 evidence 设置；缺省由消费者按 unknown 处理。 */
  readonly temporal?: TemporalCoverageState;
  /** 几何汇总；明细在 model.geometryCoverage。 */
  readonly geometry?: CoverageState;
};

/**
 * `witness` 形状：
 *   no-path       —— 可达集摘要（`reachableSet`）+ 是否被某个位置挡死（`blockedAt`）；
 *   blocked       —— 目标盒 / 可重叠脚点矩形 / 参与封堵的实心体或 hazard id；
 *   coverage-gap  —— 缺哪条语义（`missing`）；
 *   count         —— 完成性的 collected / required；
 *   no-safe-window—— LP-03 B 的全高 danger 闭式下界（idle / active / required）。
 */
export type PlayabilityWitness =
  | {
      readonly kind: "no-path"; readonly reachableSet: string; readonly blockedAt?: string;
      readonly targetsReached?: readonly string[];
      /** LP-04 完成性：必需集合 / 能单独取得的目标 / gate 前缀 / 是否建模复位边。 */
      readonly required?: readonly string[];
      readonly collectableAlone?: readonly string[];
      readonly gatePre?: boolean;
      readonly usedResetEdges?: boolean;
    }
  | {
      readonly kind: "blocked"; readonly rect: Aabb; readonly overlapFoot: Aabb;
      readonly solids: readonly string[];
      /** LP-03 A：封路的静止 hazard（`solids` 字段名沿用 framework 的 blocked 形状）。 */
      readonly blockers?: readonly { readonly id: string; readonly rect: Aabb }[];
    }
  | { readonly kind: "coverage-gap"; readonly missing: string }
  | { readonly kind: "count"; readonly required: number; readonly collected: number }
  /** LP-03 B：全高 danger 的安全窗口下界（闭式，可机检）。 */
  | {
      readonly kind: "no-safe-window"; readonly dangerId: string; readonly box: Aabb;
      readonly idleMs: number; readonly activeMs: number; readonly requiredMs: number;
      readonly speed: number; readonly playerWidth: number;
      readonly side: "near->far"; readonly fullColumnCut: true;
      readonly targetRegion: Aabb;
    }
  | {
      readonly kind: "temporal";
      readonly result: "nb-candidate" | "pu-candidate" | "insufficient-evidence";
      readonly certificateKind: "witness" | "permanent-gate" | "none";
      readonly certificateStatus: "COMPLETE" | "INCOMPLETE";
      readonly degradation: PublicTemporalDegradation | null;
    };

export type PlayabilityEvidence = {
  /** 稳定判据 id（framework §5.1）。不改名；废弃走新 id。 */
  readonly judgmentId: string;
  /** 沿用 `ConfigIssue.where` 的格式：`entity "<id>"` / `player.at` / `objective.gate`。 */
  readonly target: string;
  /** 人话定位；**不写 judgmentId**。 */
  readonly detail: string;
  readonly witness: PlayabilityWitness;
  readonly coverage: PlayabilityCoverage;
  readonly assetId?: string;
  /** 仅 temporal evidence 设置；非时序 evidence 不出现这些字段。 */
  readonly model?: TemporalModelEvidence;
  readonly lag?: TemporalLagEvidence;
  readonly degradation?: TemporalDegradationEvidence;
  readonly limits?: TemporalLimitsEvidence;
  readonly expected?: unknown;
  readonly actual?: unknown;
};

export type LayerResult = {
  readonly verdict: PlayabilityVerdictState;
  readonly evidence: readonly PlayabilityEvidence[];
  readonly coverage: CoverageState;
};

/**
 * 层内三态聚合。
 *
 * 1. 任一**阻断型** evidence ⇒ `PROVEN_UNPLAYABLE`（覆盖缺口不能推翻确定性证据）；
 * 2. 否则任一**非阻断** evidence（仅诊断 / coverage-gap）或显式 gap ⇒ `INSUFFICIENT_EVIDENCE`；
 * 3. 否则 ⇒ `NO_PROVEN_BLOCKER`。
 *
 * ⚠️ `coverage === "partial"` 本身**不**改变层内 verdict —— 见文件头二。
 *   调用方必须把 `coverage` 一并带出去，别让「没找到阻断」看起来像「看全了」。
 */
export function aggregateLayer(input: {
  readonly coverage: CoverageState;
  readonly evidence: readonly PlayabilityEvidence[];
  readonly nonBlocking?: ReadonlySet<string>;
  readonly gaps?: readonly string[];
}): PlayabilityVerdictState {
  const nonBlocking = input.nonBlocking ?? new Set<string>();
  if (input.evidence.some((e) => !nonBlocking.has(e.judgmentId))) return "PROVEN_UNPLAYABLE";
  if (input.evidence.length > 0) return "INSUFFICIENT_EVIDENCE";
  if ((input.gaps?.length ?? 0) > 0) return "INSUFFICIENT_EVIDENCE";
  return "NO_PROVEN_BLOCKER";
}
