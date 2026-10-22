// 票 04（P0-05b）：票 03 裁定 A+ 的**唯一**阈值落点。
//
// 裁定原文（2026-10-21，用户逐字；完整六条见票 03 的 `## 裁定`）：
//   · 长宽比：`|ΔAR| ≥ 25%` ⇒ error；对**全部** `sourceSizes`（背景层、母版、精灵、动画）生效；
//     `24.9%` 不触发、`25.0%` 触发；无可用 `sourceSizes` ⇒ 「没跑（unavailable）」，不得判绿。
//   · 色板外：`share ≥ 25% 且不透明像素 ≥ 16` ⇒ error；
//     `share ≥ 10% 且不透明像素 ≥ 16` ⇒ observation（只报，不阻断）；
//     `9.9%` 不观察、`10.0%` 观察；`15 px` 不判、`16 px` 参与。
//   · 已知坏例 `health-icon`（41/256 = 16.02%）与 `tile-wall`（29/225 = 12.89%）只作 observation。
//   · 背景层覆盖率**不新增 P0 阈值**（保持 observation；本文件不碰它）。
//
// 阈值来源：票 03 的只读测量（7 个包 / 89 个资源 / 47 条长宽比样本 / 17 层覆盖），
//   全部分布见 `.scratch/p0-construction-v1/research/pixel-metrics-distribution.md`。
// ⚠️ 这里**只落地裁定**：任何偏离都要单独立票、单独裁定（票 04 的边界）。
// ⚠️ 本文件不读 PNG、不 import `assets`（`packages/qa` 的白名单只有 `contracts`）——
//   度量由上游 `inspectPack` 算好，本文件只做**阈值化**，所以不会有第二份像素真相。
import {
  QA_JUDGEMENTS, buildQAReport,
  type QAFinding, type QAJudgement, type QAReport,
} from "@game-maker/contracts";

/**
 * ⚠️ **唯一**的阈值表（票 03 裁定 A+）。改这里 = 改裁定，必须重新报批。
 * 百分比用整数保存，比较时用交叉相乘，避免浮点边界（24.9 / 25.0、9.9 / 10.0）说谎。
 */
export const PIXEL_INTEGRITY_THRESHOLDS = {
  aspectRatio: { errorDeltaArPct: 25 },
  offPalette: { errorSharePct: 25, observationSharePct: 10, minOpaquePixels: 16 },
} as const;

/** 上游 `InspectData` 里本文件需要的两格（结构类型，不 import `assets`）。 */
export type PixelMetricsInput = {
  sourceSizes?: readonly { id: string; unit: string; deltaAr: number }[];
  paletteUsage?: {
    perAsset?: readonly { id: string; opacityPixels: number; offPalettePixels: number }[];
  };
};

export type PixelIntegrityFinding = { judgement: QAJudgement; finding: QAFinding };
export type PixelIntegrity = {
  findings: readonly PixelIntegrityFinding[];
  /** 追加到 `inspect` 观察里的行（observation 档 + unavailable）—— **不影响裁决**。 */
  observationLines: readonly string[];
};

const T = PIXEL_INTEGRITY_THRESHOLDS;
const sharePct = (off: number, opaque: number) => (off / opaque) * 100;
/** `off / opaque >= pct / 100`，用整数交叉相乘钉住边界。 */
const atLeastPct = (off: number, opaque: number, pct: number) => off * 100 >= opaque * pct;
const signedPct = (d: number) => `${d > 0 ? "+" : ""}${d.toFixed(1)}%`;

/**
 * 把 `inspectPack` 已算好的度量**阈值化**成「判据失败 + 观察行」。
 *
 * - error 挂到既有判据：长宽比 → `constructive-constraint`；色板外 → `palette-binding`
 *   （契约对后者的原话就是「颜色 ∈ 色板」）。**不新增第七判据**。
 * - 10%–25% 色板外与「没有 sourceSizes」只进观察行（契约里「只报、不阻断」的那一栏）。
 */
export function pixelIntegrity(input: PixelMetricsInput): PixelIntegrity {
  const findings: PixelIntegrityFinding[] = [];
  const observationLines: string[] = [];

  // ── 长宽比：全部 sourceSizes 条目，背景层不豁免 ──────────────────────────
  const sizes = input.sourceSizes ?? [];
  for (const e of sizes) {
    // ⚠️ 非有限数（源图/目标为 0 宽高的坏数据）不当成「超过阈值」—— 那是度量坏了，不是图坏了。
    if (!Number.isFinite(e.deltaAr)) continue;
    if (Math.abs(e.deltaAr) < T.aspectRatio.errorDeltaArPct) continue;
    findings.push({
      judgement: "constructive-constraint",
      finding: {
        target: e.unit === "" ? e.id : `${e.id}.${e.unit}`,
        severity: "error",
        detail: `源图 → 目标长宽比差 ${signedPct(e.deltaAr)}（|ΔAR| ≥ ${T.aspectRatio.errorDeltaArPct}%）`
          + " —— 交付图被拉伸 / 压扁，不是设计能解释的差异；"
          + "阈值来源：票 03 裁定（7 包 / 47 条样本，正常帧间 ≤ 9.1%）",
      },
    });
  }
  if (sizes.length === 0)
    observationLines.push(
      "  源图 / 目标尺寸：没跑（unavailable）—— 包内没有 authoring 位图；不计入通过（票 03 裁定 5）",
    );

  // ── 色板外：error / observation 两档（小于 10% 或不足 16 个不透明像素 ⇒ 不判）──
  const observed: string[] = [];
  for (const a of input.paletteUsage?.perAsset ?? []) {
    const opaque = a.opacityPixels, off = a.offPalettePixels;
    if (opaque < T.offPalette.minOpaquePixels) continue;
    if (atLeastPct(off, opaque, T.offPalette.errorSharePct)) {
      findings.push({
        judgement: "palette-binding",
        finding: {
          target: a.id,
          severity: "error",
          detail: `色板外像素 ${off}/${opaque}（${sharePct(off, opaque).toFixed(2)}%）`
            + ` —— 阈值 ≥ ${T.offPalette.errorSharePct}% 且不透明像素 ≥ ${T.offPalette.minOpaquePixels}`
            + "（票 03 裁定 A+；语料 7 包 / 89 资产）；交付态颜色明显越出色板，不是设计能解释的差异",
        },
      });
    } else if (atLeastPct(off, opaque, T.offPalette.observationSharePct)) {
      observed.push(`  ${a.id} · 色板外 ${off}/${opaque}（${sharePct(off, opaque).toFixed(2)}%）`);
    }
  }
  if (observed.length > 0)
    observationLines.push(
      "像素完整性观察（票 03 裁定 A+；来源：7 包 / 89 资产 / 47 长宽比样本 / 17 层覆盖）—— 只报，不阻断：",
      ...observed.map((l) => `${l} · 观察（≥10% 且 <25%）`),
    );

  return { findings, observationLines };
}

/**
 * 把阈值结论挂回**已跑过的**判据。
 *
 * ⚠️ 用 `buildQAReport` 重建，而不是往 `report.failures` 里 push —— 投影（`judgement` 字段）
 *   只在契约那一处做，别在这里再造第二份。`ran:false` 的 reason 不落盘，重建时给一句内部说明即可
 *   （`buildQAReport` 只读 `ran`，那句话不会进产物）。
 * ⚠️ 挂到**没跑过**的判据上 ⇒ **抛**（没跑过的判据产不出失败）。
 *   同一 `(judgement, target)` 已有失败 ⇒ **并进 detail**（契约 §四②），不产出重复条目。
 */
export function withPixelFindings(report: QAReport, extra: readonly PixelIntegrityFinding[]): QAReport {
  if (extra.length === 0) return report;

  const results = {} as Record<QAJudgement, ReturnType<typeof resultOf>>;
  for (const j of QA_JUDGEMENTS) results[j] = resultOf(report, j);

  for (const { judgement, finding } of extra) {
    const r = results[judgement];
    if (!r.ran)
      throw new Error(`像素完整性判据「${judgement}」本次没有跑 —— 没跑过的判据产不出失败（票 03 裁定不能挂空）`);
    // ⚠️ 契约 §四②：同一 `(judgement, target)` 只留一条，**细节并进 detail** ——
    //   同一个资源既犯构造性约束、又犯长宽比时，报告必须仍然产得出来。
    const same = r.findings.find((f) => f.target === finding.target);
    if (same === undefined) r.findings.push(finding);
    else {
      same.detail = `${same.detail}\n${finding.detail}`;
      if (finding.severity === "error") same.severity = "error";
    }
  }
  return buildQAReport(results, report.observations);
}

function resultOf(report: QAReport, j: QAJudgement) {
  if (!report.checked.includes(j))
    return { ran: false as const, reason: "报告投影重建：这一条本次没跑（原因不落盘）" };
  return {
    ran: true as const,
    findings: report.failures.filter((f) => f.judgement === j)
      .map(({ judgement: _judgement, ...f }) => f),
  };
}
