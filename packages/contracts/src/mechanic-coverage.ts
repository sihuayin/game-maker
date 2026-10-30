// **机制覆盖报告**（票 07 / P0-02 v2 票 02）—— 意图→机制契约的收口：每个**设计声明要做的机制**，
//   在四层上各落一个状态（设计 / 运行时 / config / QA），合并成一份「哪些机制端到端齐了」的报告。
//
// ⚠️ v2（2026-10-29 用户裁定）：
//   · 新增 **config 层**：机制 → 必需 entity kind 的检查结果（显式可审计）；
//   · 新增 **probe 块**：是否执行、何时执行、摘要路径、逐机制结果；
//   · 新增 **subject**：报告绑定 pack/site/shell/config 六字段身份；
//   · 缺 probe 时 `qa=not-tested`，**绝不再默认 passed**；声明的受 probe 机制缺结果 ⇒ `qa=failed`。
//   · 生产代码不保留 v1 解析器；历史 v1 产物只作为历史文件存在。
//
// ⚠️ 单个必需机制失败不被总体通过掩盖（FR-07 末）：`verdict` 是「**全部**可阻断层 satisfied」，
//   不是「大多数」；门禁读它，任一机制任一格可阻断状态即失败。
import { z } from "zod/v4";
import {
  QA_PROBED_MECHANICS, RUNTIME_IMPLEMENTED_MECHANICS, deriveMechanicStatus,
  MechanicSchema, type Mechanic,
} from "./vocabulary.js";
import type { GameConfig } from "./game-config.js";
import type { GameDesignSpec } from "./game-design.js";

export const MECHANIC_COVERAGE_FORMAT = "mechanic-coverage/v2" as const;

/** 四层合用的封闭状态枚举（design/runtime/config：satisfied·missing·unsupported·not-tested；qa：satisfied·not-tested·failed）。 */
export const MECHANIC_COVERAGE_STATUSES = ["satisfied", "missing", "unsupported", "not-tested", "failed"] as const;
export const MechanicCoverageStatusSchema = z.enum(MECHANIC_COVERAGE_STATUSES);
export type MechanicCoverageStatus = z.infer<typeof MechanicCoverageStatusSchema>;

/** config 层只使用这三态：满足 / 缺必需实体 / 没有映射规则（未来机制；不阻断但必须可见）。 */
export const MECHANIC_CONFIG_STATUSES = ["satisfied", "missing", "not-tested"] as const;
export const MechanicConfigStatusSchema = z.enum(MECHANIC_CONFIG_STATUSES);
export type MechanicConfigStatus = z.infer<typeof MechanicConfigStatusSchema>;

export const MechanicConfigCheckSchema = z.strictObject({
  status: MechanicConfigStatusSchema,
  /** 需求 token：entity kind（`pickup` / `chest` / `danger` / `hazard` / `goal` / `terrain`）
   *  或能力 token（`motion:cycle` / `objective:collect-then-reach`）。 */
  requiredEntityKinds: z.array(z.string().min(1)),
  /** 每个 required token 在**实际 config** 里的读数（缺失记 0）。 */
  found: z.record(z.string(), z.number().int().nonnegative()),
});
export type MechanicConfigCheck = z.infer<typeof MechanicConfigCheckSchema>;

export const MechanicCoverageSchema = z.strictObject({
  /** 机制的封闭枚举 id（不是意图的自由文本）。 */
  mechanic: MechanicSchema,
  design: MechanicCoverageStatusSchema,
  runtime: MechanicCoverageStatusSchema,
  config: MechanicConfigCheckSchema,
  qa: MechanicCoverageStatusSchema,
}).strict();

const Sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/, "形如 sha256:<64 位小写十六进制>");

/** 报告身份：与正式证据清单 `subject` 同形（六字段）。 */
export const MechanicCoverageSubjectSchema = z.strictObject({
  packId: z.string().min(1),
  packVersion: z.number().int().positive(),
  siteVersion: z.number().int().positive(),
  shellVersion: z.string().min(1),
  manifestChecksum: Sha256,
  configChecksum: Sha256,
});
export type MechanicCoverageSubject = z.infer<typeof MechanicCoverageSubjectSchema>;

export const MechanicProbeResultSchema = z.strictObject({
  mechanic: MechanicSchema,
  passed: z.boolean(),
});
export type MechanicProbeResult = z.infer<typeof MechanicProbeResultSchema>;

export const MechanicProbeEvidenceSchema = z.strictObject({
  /** `true` = 这一版报告经历过 probe 执行（即使失败/缺结果）；`false` = 还没跑。 */
  executed: z.boolean(),
  ranAt: z.string().min(1).optional(),
  /** 相对 run 目录的摘要路径（例如 `mechanic-probe/summary.json`）。 */
  summaryPath: z.string().min(1).optional(),
  results: z.array(MechanicProbeResultSchema),
});
export type MechanicProbeEvidence = z.infer<typeof MechanicProbeEvidenceSchema>;

export const MechanicCoverageReportSchema = z.strictObject({
  format: z.literal(MECHANIC_COVERAGE_FORMAT),
  subject: MechanicCoverageSubjectSchema,
  mechanics: z.array(MechanicCoverageSchema),
  probe: MechanicProbeEvidenceSchema,
  /** `satisfied` = 每条机制的 design/runtime/config satisfied 且 qa 非 failed；否则 `failed`。 */
  verdict: z.enum(["satisfied", "failed"]),
}).strict();

export type MechanicCoverage = z.infer<typeof MechanicCoverageSchema>;
export type MechanicCoverageReport = z.infer<typeof MechanicCoverageReportSchema>;
/** 不含 subject 的「报告核心」：纯函数产出，写盘层补身份。 */
export type MechanicCoverageCore = Omit<MechanicCoverageReport, "subject">;

/** probe 结果（`{ mechanic, passed }`）。缺省 = 还没跑 probe（不是「全过」）。 */
export type ProbeResult = { mechanic: Mechanic; passed: boolean };

/** 门禁语义（票 02）：design/runtime/config `missing`/`unsupported` 与 qa `failed` 阻断；
 *  `not-tested` 不阻断（基线机制靠 witness + 既有金字塔盖住），但必须可见。 */
const isGateBlocking = (m: MechanicCoverage): boolean =>
  m.design !== "satisfied" || m.runtime !== "satisfied" || m.config.status === "missing" || m.qa === "failed";

type ConfigRule = {
  tokens: string[];
  satisfied: (found: Record<string, number>) => boolean;
};

/** 机制 → config 需求（票 02 Q2 的全套映射）。⚠️ 只读 config，不读意图/设计。 */
const CONFIG_RULES: Record<Mechanic, ConfigRule> = {
  run: { tokens: [], satisfied: () => true },
  jump: { tokens: [], satisfied: () => true },
  gravity: { tokens: [], satisfied: () => true },
  "collide-terrain": { tokens: ["terrain"], satisfied: (f) => (f["terrain"] ?? 0) > 0 },
  "collect-pickup": { tokens: ["pickup"], satisfied: (f) => (f["pickup"] ?? 0) > 0 },
  "moving-platform": { tokens: ["motion:cycle"], satisfied: (f) => (f["motion:cycle"] ?? 0) > 0 },
  "hazard-contact": { tokens: ["hazard"], satisfied: (f) => (f["hazard"] ?? 0) > 0 },
  "reach-goal": {
    tokens: ["goal", "objective:collect-then-reach"],
    satisfied: (f) => (f["goal"] ?? 0) > 0 && (f["objective:collect-then-reach"] ?? 0) > 0,
  },
  "open-chest": { tokens: ["chest"], satisfied: (f) => (f["chest"] ?? 0) > 0 },
  // ⚠️ 运行时 hazard 与 danger 都走 `hitHazard()`；设计 id 本身是 `dodge-hazards`。
  //   ⇒ 任一存在即满足 config 层（冻结 wasteland 的 2 个 hazard 因此为 satisfied）。
  "avoid-danger": {
    tokens: ["danger", "hazard"],
    satisfied: (f) => (f["danger"] ?? 0) > 0 || (f["hazard"] ?? 0) > 0,
  },
};

/** 从实际 config 读每个规则 token 的计数。 */
function configCounts(config: GameConfig): Record<string, number> {
  const kinds: Record<string, number> = {};
  for (const e of config.entities ?? []) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
  const motionCycle = (config.entities ?? []).filter((e) => (e as { motion?: { kind?: string } }).motion?.kind === "cycle").length;
  return {
    terrain: config.terrain?.length ?? 0,
    pickup: kinds["pickup"] ?? 0,
    chest: kinds["chest"] ?? 0,
    hazard: kinds["hazard"] ?? 0,
    danger: kinds["danger"] ?? 0,
    goal: kinds["goal"] ?? 0,
    "motion:cycle": motionCycle,
    "objective:collect-then-reach": config.objective?.kind === "collect-then-reach" ? 1 : 0,
  };
}

function configCheckOf(mechanic: Mechanic, counts: Record<string, number>): MechanicConfigCheck {
  const rule = CONFIG_RULES[mechanic];
  if (rule === undefined)
    return { status: "not-tested", requiredEntityKinds: [], found: {} };
  const found = Object.fromEntries(rule.tokens.map((t) => [t, counts[t] ?? 0]));
  return {
    status: rule.satisfied(found) ? "satisfied" : "missing",
    requiredEntityKinds: [...rule.tokens],
    found,
  };
}

/**
 * 由**设计** + **实际 config** 产 per-mechanic 覆盖核心。
 *
 * ⚠️ `probeResults` 缺省（`undefined`）⇒ `probe.executed=false`、所有机制 `qa=not-tested`；
 *   **不会**再把 `QA_PROBED_MECHANICS` 默认当 passed。
 * ⚠️ 传入 `probeResults`（哪怕是空数组）⇒ `probe.executed=true`；设计声明的受 probe 机制
 *   若缺结果 ⇒ `qa=failed`（「应有 probe 却缺失」不能吸收进 not-tested）。
 */
export function buildMechanicCoverage(
  design: GameDesignSpec,
  config: GameConfig,
  probeResults?: readonly ProbeResult[],
): MechanicCoverageCore {
  const counts = configCounts(config);
  const probed = probeResults === undefined ? undefined : new Map(probeResults.map((p) => [p.mechanic, p.passed]));

  const mechanics: MechanicCoverage[] = design.mechanics.map((m) => {
    const status = deriveMechanicStatus(m.mechanic);
    let qa: MechanicCoverageStatus;
    if (probed === undefined) qa = "not-tested";
    else if (!QA_PROBED_MECHANICS.includes(m.mechanic)) qa = "not-tested";
    else {
      const passed = probed.get(m.mechanic);
      qa = passed === undefined ? "failed" : passed ? "satisfied" : "failed";
    }
    return {
      mechanic: m.mechanic,
      design: status === "supported" ? "satisfied" : "unsupported",
      runtime: RUNTIME_IMPLEMENTED_MECHANICS.includes(m.mechanic) ? "satisfied" : "unsupported",
      config: configCheckOf(m.mechanic, counts),
      qa,
    };
  });

  return {
    format: MECHANIC_COVERAGE_FORMAT,
    mechanics,
    probe: {
      executed: probeResults !== undefined,
      results: [...(probeResults ?? [])],
    },
    verdict: mechanics.every((m) => !isGateBlocking(m)) ? "satisfied" : "failed",
  };
}

/** 门禁那一半：哪条机制在哪一层掉了，**逐条**说清楚；全绿 = `undefined`。 */
export function mechanicCoverageProblem(report: Pick<MechanicCoverageReport, "mechanics">): string | undefined {
  const bad = report.mechanics.filter(isGateBlocking);
  if (bad.length === 0) return undefined;
  const lines = bad.map((m) => {
    const parts = [
      m.design !== "satisfied" ? `设计层 ${m.design}` : null,
      m.runtime !== "satisfied" ? `运行时层 ${m.runtime}` : null,
      m.config.status === "missing" ? `config 层缺 ${m.config.requiredEntityKinds.join(" / ")}` : null,
      m.qa === "failed" ? `QA 层 ${m.qa}` : null,
    ].filter(Boolean);
    return `  · \`${m.mechanic}\`：${parts.join("；")}`;
  });
  return `机制覆盖没过（${bad.length}/${report.mechanics.length} 条端到端不齐）：\n${lines.join("\n")}`;
}
